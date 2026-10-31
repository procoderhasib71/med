import { turso } from '@/lib/turso';
import type { Platform } from '@/lib/platform';
import type { SignedInUser } from '@/lib/serverAuth';

// ছাত্রদের সব ডাটা Turso তে (টেবিল বানায় Hermes2/migrations/008, 009)। লগইন শুধু Firebase Auth এ।
// অ্যাকাউন্ট একটাই (site_users), কিন্তু হিসাব প্ল্যাটফর্ম অনুযায়ী আলাদা (med, ka, kha, eng)।
// Firestore এর আগের আকারেই ফেরত দিই (subjects/chapters/items ম্যাপ), যাতে পেজগুলোতে কম বদলাতে হয়।

type Stmt = { sql: string; args: (string | number | null)[] };
const MISTAKE_CAP = 500;
const MAX_PER_SYNC = 200;

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
const nowIso = () => new Date().toISOString();

const scoreStmt = (uid: string, p: Platform, attempted: number, correct: number, score: number): Stmt => ({
    sql: `INSERT INTO site_scores (uid, platform, attempted, correct, score) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(uid, platform) DO UPDATE SET attempted = attempted + excluded.attempted,
          correct = correct + excluded.correct, score = score + excluded.score`,
    args: [uid, p, attempted, correct, score],
});

const mistakeStmt = (uid: string, p: Platform, id: string, answer: string, at: number): Stmt => ({
    sql: `INSERT INTO site_mistakes (uid, question_id, user_answer, at, platform) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(uid, question_id) DO UPDATE SET user_answer = excluded.user_answer, at = excluded.at`,
    args: [uid, id, answer, at, p],
});

export async function ensureUser(u: SignedInUser & { phone?: string }) {
    await turso.execute({
        sql: `INSERT INTO site_users (uid, email, name, phone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(uid) DO UPDATE SET email = CASE WHEN excluded.email <> '' THEN excluded.email ELSE site_users.email END,
              name = CASE WHEN COALESCE(site_users.name, '') = '' THEN excluded.name ELSE site_users.name END,
              phone = COALESCE(NULLIF(excluded.phone, ''), site_users.phone)`,
        args: [u.uid, u.email, u.name, u.phone || '', nowIso(), nowIso()],
    });
}

export async function setName(uid: string, name: string) {
    await turso.execute({ sql: 'UPDATE site_users SET name = ?, updated_at = ? WHERE uid = ?', args: [name.trim().slice(0, 60), nowIso(), uid] });
}

// ---------------- প্রোফাইল ----------------

/** ছাত্র কোন কোর্সগুলো নিয়েছে (admcq.com এর প্রোফাইল থেকে নেয়; টেবিল Hermes2/migrations/010) */
export async function getEnrollments(uid: string): Promise<Platform[]> {
    const r = await turso.execute({ sql: 'SELECT platform FROM site_enrollments WHERE uid = ? ORDER BY created_at', args: [uid] });
    return r.rows.map((x) => String(x.platform) as Platform);
}

export async function getMe(uid: string, p: Platform) {
    const [user, score, bm, mc, done] = await turso.batch([
        { sql: 'SELECT * FROM site_users WHERE uid = ?', args: [uid] },
        { sql: 'SELECT attempted, correct, score FROM site_scores WHERE uid = ? AND platform = ?', args: [uid, p] },
        { sql: 'SELECT question_id FROM site_bookmarks WHERE uid = ? AND platform = ? ORDER BY created_at DESC', args: [uid, p] },
        { sql: 'SELECT COUNT(*) AS n FROM site_mistakes WHERE uid = ? AND platform = ?', args: [uid, p] },
        { sql: 'SELECT test_id FROM site_exam_results WHERE uid = ? AND platform = ?', args: [uid, p] },
    ], 'read');
    const r = user.rows[0] || {};
    const s = score.rows[0] || {};
    return {
        uid,
        platform: p,
        email: String(r.email || ''),
        phone: String(r.phone || ''),
        name: String(r.name || ''),
        displayName: String(r.name || ''),
        role: String(r.role || 'student'),
        totalAttempted: n(s.attempted),
        totalCorrect: n(s.correct),
        totalScore: n(s.score),
        totalStudySeconds: n(r.total_study_seconds),
        currentStreak: n(r.current_streak),
        bookmarks: bm.rows.map((x) => String(x.question_id)),
        mistakeCount: n(mc.rows[0]?.n),
        completed_exams: done.rows.map((x) => String(x.test_id)),
    };
}

/** প্রোফাইল পেজের জন্য: চার প্ল্যাটফর্মের মোট হিসাব */
export async function allScores(uid: string) {
    const r = await turso.execute({ sql: 'SELECT platform, attempted, correct, score FROM site_scores WHERE uid = ?', args: [uid] });
    return Object.fromEntries(r.rows.map((x) => [String(x.platform), { attempted: n(x.attempted), correct: n(x.correct), score: n(x.score) }]));
}

export async function getProgress(uid: string, p: Platform) {
    const r = await turso.execute({ sql: 'SELECT subject, chapter, attempted, correct FROM site_progress WHERE uid = ? AND platform = ?', args: [uid, p] });
    const subjects: Record<string, { subject: string; totalAttempted: number; correctAnswers: number }> = {};
    const chapters: Record<string, { subject: string; chapter: string; totalAttempted: number; correctAnswers: number }> = {};
    for (const row of r.rows) {
        const subject = String(row.subject), chapter = String(row.chapter || '');
        const v = { totalAttempted: n(row.attempted), correctAnswers: n(row.correct) };
        if (chapter) chapters[`${subject}_${chapter}`] = { subject, chapter, ...v };
        else subjects[subject] = { subject, ...v };
    }
    return { subjects, chapters };
}

// ---------------- ভুল, সমাধান, বুকমার্ক ----------------

export async function getMistakes(uid: string, p: Platform) {
    const r = await turso.execute({ sql: 'SELECT question_id, user_answer, at FROM site_mistakes WHERE uid = ? AND platform = ? ORDER BY at DESC', args: [uid, p] });
    const items: Record<string, { id: string; userAnswer: string; timestamp: number }> = {};
    for (const row of r.rows) items[String(row.question_id)] = { id: String(row.question_id), userAnswer: String(row.user_answer || ''), timestamp: n(row.at) };
    return { items };
}

export async function removeMistakes(uid: string, ids: string[]) {
    const list = ids.map(String).slice(0, 500);
    if (!list.length) return;
    await turso.execute({ sql: `DELETE FROM site_mistakes WHERE uid = ? AND question_id IN (${list.map(() => '?').join(',')})`, args: [uid, ...list] });
}

export async function getSolved(uid: string, subject: string, p: Platform) {
    const r = await turso.execute({ sql: 'SELECT question_id FROM site_solved WHERE uid = ? AND subject = ? AND platform = ?', args: [uid, subject, p] });
    return r.rows.map((x) => String(x.question_id));
}

export async function setBookmark(uid: string, questionId: string, on: boolean, p: Platform) {
    await turso.execute(on
        ? { sql: 'INSERT OR IGNORE INTO site_bookmarks (uid, question_id, created_at, platform) VALUES (?, ?, ?, ?)', args: [uid, questionId, Date.now(), p] }
        : { sql: 'DELETE FROM site_bookmarks WHERE uid = ? AND question_id = ?', args: [uid, questionId] });
}

// ---------------- উত্তর জমা (সাইটের qbank; বটের একই হিসাব Hermes2/core/site.py তে) ----------------

export type AnswerQueue = {
    attempted: number;
    correct: number;
    score: number;
    solvedBySubject: Record<string, string[]>;
    subjects: Record<string, { subject: string; attempted: number; correct: number }>;
    chapters: Record<string, { subject: string; chapter: string; attempted: number; correct: number }>;
    mistakes: Record<string, { id: string; userAnswer: string; timestamp: number }>;
};

/** qbank এর ৫টা-৫টা উত্তরের ব্যাচ। ব্রাউজার থেকে আসে, তাই সংখ্যাগুলো সীমার মধ্যে রাখি। */
export async function applyQueue(uid: string, q: AnswerQueue, p: Platform) {
    const attempted = Math.min(Math.max(0, Math.floor(n(q.attempted))), MAX_PER_SYNC);
    if (!attempted) return 0;
    const correct = Math.min(Math.max(0, Math.floor(n(q.correct))), attempted);
    const score = Math.min(Math.max(0, n(q.score)), correct);
    const now = Date.now();
    const stmts: Stmt[] = [scoreStmt(uid, p, attempted, correct, score),
                           { sql: 'UPDATE site_users SET updated_at = ? WHERE uid = ?', args: [nowIso(), uid] }];
    for (const [subject, ids] of Object.entries(q.solvedBySubject || {})) {
        for (const id of (ids || []).slice(0, MAX_PER_SYNC)) {
            stmts.push({ sql: 'INSERT OR IGNORE INTO site_solved (uid, question_id, subject, solved_at, platform) VALUES (?, ?, ?, ?, ?)',
                         args: [uid, String(id), subject.trim(), now, p] });
        }
    }
    const progress = (subject: string, chapter: string, a: number, c: number) => stmts.push({
        sql: `INSERT INTO site_progress (uid, platform, subject, chapter, attempted, correct) VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(uid, platform, subject, chapter) DO UPDATE SET attempted = attempted + excluded.attempted, correct = correct + excluded.correct`,
        args: [uid, p, subject, chapter, Math.min(Math.max(0, Math.floor(a)), attempted), Math.min(Math.max(0, Math.floor(c)), attempted)],
    });
    for (const v of Object.values(q.subjects || {})) if (v?.subject) progress(String(v.subject).trim(), '', n(v.attempted), n(v.correct));
    for (const v of Object.values(q.chapters || {})) if (v?.subject) progress(String(v.subject), String(v.chapter || ''), n(v.attempted), n(v.correct));
    for (const v of Object.values(q.mistakes || {}).slice(0, MAX_PER_SYNC)) {
        if (v?.id) stmts.push(mistakeStmt(uid, p, String(v.id), String(v.userAnswer || '').slice(0, 4), Math.min(n(v.timestamp) || now, now)));
    }
    // ভুলের লিস্ট প্রতি প্ল্যাটফর্মে ৫০০ তে সীমিত (পুরনোগুলো বাদ)
    stmts.push({
        sql: `DELETE FROM site_mistakes WHERE uid = ? AND platform = ? AND question_id IN (
                SELECT question_id FROM site_mistakes WHERE uid = ? AND platform = ? ORDER BY at DESC LIMIT -1 OFFSET ${MISTAKE_CAP})`,
        args: [uid, p, uid, p],
    });
    for (let i = 0; i < stmts.length; i += 100) await turso.batch(stmts.slice(i, i + 100), 'write');
    return attempted;
}

// ---------------- লিডারবোর্ড (প্রতি প্ল্যাটফর্মে আলাদা) ----------------

export async function leaderboard(p: Platform, limit = 50, uid?: string) {
    const top = await turso.execute({
        sql: `SELECT s.uid, u.name, u.email, s.score FROM site_scores s JOIN site_users u ON u.uid = s.uid
              WHERE s.platform = ? AND s.score > 0 ORDER BY s.score DESC LIMIT ?`,
        args: [p, limit],
    });
    const label = (name: unknown, email: unknown) => String(name || '') || (email ? String(email).split('@')[0] : 'Candidate');
    const rows = top.rows.map((r) => ({ id: String(r.uid), name: label(r.name, r.email), score: n(r.score) }));
    let me = null;
    if (uid && !rows.some((r) => r.id === uid)) {
        const m = await turso.execute({
            sql: `SELECT u.name, u.email, COALESCE(s.score, 0) AS score,
                  (SELECT COUNT(*) FROM site_scores o WHERE o.platform = ? AND o.score > COALESCE(s.score, 0)) + 1 AS rank
                  FROM site_users u LEFT JOIN site_scores s ON s.uid = u.uid AND s.platform = ? WHERE u.uid = ?`,
            args: [p, p, uid],
        });
        const r = m.rows[0];
        if (r) me = { id: uid, name: label(r.name, r.email), score: n(r.score), rank: n(r.rank) };
    }
    return { rows, me };
}

// ---------------- মডেল টেস্ট ----------------

export async function listModelTests(p: Platform, limit = 50) {
    const r = await turso.execute({ sql: 'SELECT id, data FROM site_model_tests WHERE platform = ? ORDER BY created_at DESC LIMIT ?', args: [p, limit] });
    return r.rows.map((row) => ({ ...JSON.parse(String(row.data)), id: String(row.id) }));
}

export async function getModelTest(id: string) {
    const r = await turso.execute({ sql: 'SELECT data, platform FROM site_model_tests WHERE id = ?', args: [id] });
    return r.rows[0] ? { ...JSON.parse(String(r.rows[0].data)), id, platform: String(r.rows[0].platform) } : null;
}

export async function saveModelTest(id: string, payload: Record<string, unknown>, by: string, p: Platform) {
    const createdAt = Date.now();
    const data = { ...payload, id, createdBy: by, createdAt: new Date(createdAt).toISOString() };
    await turso.execute({
        sql: `INSERT OR REPLACE INTO site_model_tests (id, title, subject, type, is_live, is_archive, start_time, end_time, created_by, created_at, data, platform)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [id, String(payload.title || ''), String(payload.subject || ''), String(payload.type || ''), payload.is_live ? 1 : 0,
               payload.is_archive ? 1 : 0, String(payload.start_time || ''), String(payload.end_time || ''), by, createdAt, JSON.stringify(data), p],
    });
}

export async function listExamResults(uid: string, p: Platform) {
    const r = await turso.execute({ sql: 'SELECT test_id, score, total_marks, correct, wrong, submitted_at FROM site_exam_results WHERE uid = ? AND platform = ?', args: [uid, p] });
    return Object.fromEntries(r.rows.map((x) => [String(x.test_id), {
        score: n(x.score), totalMarks: n(x.total_marks), correct: n(x.correct), wrong: n(x.wrong), submittedAt: n(x.submitted_at),
    }]));
}

export async function getExamResult(uid: string, testId: string) {
    const r = await turso.execute({ sql: 'SELECT data FROM site_exam_results WHERE uid = ? AND test_id = ?', args: [uid, testId] });
    return r.rows[0] ? JSON.parse(String(r.rows[0].data)) : null;
}

type TestQuestion = { id: string | number; correct_option?: string };

/** নম্বর সার্ভারে হিসাব হয়। একই টেস্ট আবার দিলে আগের ফল বদলায়, মোট স্কোরে দুবার যোগ হয় না। স্কোর যায় টেস্টের নিজের প্ল্যাটফর্মে। */
export async function submitExam(uid: string, testId: string, answers: Record<string, string>, retake: boolean) {
    const test = await getModelTest(testId);
    if (!test) throw new Error('পরীক্ষা পাওয়া যায়নি');
    const p = test.platform as Platform;
    const questions: TestQuestion[] = Array.isArray(test.questions) ? test.questions : [];
    const neg = n(test.negative_marking) || 0.25;
    let correct = 0, wrong = 0;
    const mistakes: Record<string, string> = {};
    const clean: Record<string, string> = {};
    for (const q of questions) {
        const id = String(q.id);
        const chosen = String(answers?.[id] || '').toLowerCase();
        if (!chosen) continue;
        clean[id] = chosen;
        if (chosen === String(q.correct_option || '').toLowerCase()) correct++;
        else {
            wrong++;
            mistakes[id] = chosen;
        }
    }
    const score = parseFloat((correct - wrong * neg).toFixed(2));
    const prev = await getExamResult(uid, testId);
    const isLive = Boolean(test.is_live && !retake);
    const result = { testId, examTitle: test.title || 'মডেল টেস্ট', score, totalMarks: questions.length, correct, wrong,
                     answers: clean, is_live: isLive, submittedAt: Date.now() };
    const stmts: Stmt[] = [{
        sql: `INSERT OR REPLACE INTO site_exam_results (uid, test_id, score, total_marks, correct, wrong, submitted_at, data, platform)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [uid, testId, score, questions.length, correct, wrong, result.submittedAt, JSON.stringify(result), p],
    }];
    if (!prev) stmts.push(scoreStmt(uid, p, Object.keys(clean).length, correct, score));
    for (const [id, chosen] of Object.entries(mistakes)) stmts.push(mistakeStmt(uid, p, id, chosen, Date.now()));
    await turso.batch(stmts, 'write');
    return result;
}

// ---------------- রিপোর্ট ----------------

export async function createReport(questionId: string, reason: string, by: { uid: string; email: string; name: string }, p: Platform) {
    const id = `${questionId}_${by.uid}`.replace(/[^A-Za-z0-9_\-]/g, '');
    await turso.execute({
        sql: `INSERT INTO site_reports (id, question_id, reported_by, email, name, reason, via, status, created_at, platform)
              VALUES (?, ?, ?, ?, ?, ?, 'site', 'pending', ?, ?)
              ON CONFLICT(id) DO UPDATE SET reason = excluded.reason, status = 'pending', created_at = excluded.created_at`,
        args: [id, questionId, by.uid, by.email, by.name, reason.slice(0, 1000), Date.now(), p],
    });
    return id;
}
