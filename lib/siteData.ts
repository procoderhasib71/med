import { turso } from '@/lib/turso';
import type { SignedInUser } from '@/lib/serverAuth';

// ছাত্রদের সব ডাটা Turso তে (টেবিল বানায় Hermes2/migrations/008_site_data.sql)। লগইন শুধু Firebase Auth এ।
// Firestore এর আগের আকারেই ফেরত দিই (subjects/chapters/items ম্যাপ), যাতে পেজগুলোতে কম বদলাতে হয়।

type Stmt = { sql: string; args: (string | number | null)[] };
const MISTAKE_CAP = 500;
const MAX_PER_SYNC = 200;

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
const nowIso = () => new Date().toISOString();

export async function ensureUser(u: SignedInUser) {
    await turso.execute({
        sql: `INSERT INTO site_users (uid, email, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(uid) DO UPDATE SET email = CASE WHEN excluded.email <> '' THEN excluded.email ELSE site_users.email END,
              name = CASE WHEN COALESCE(site_users.name, '') = '' THEN excluded.name ELSE site_users.name END`,
        args: [u.uid, u.email, u.name, nowIso(), nowIso()],
    });
}

// ---------------- প্রোফাইল ----------------

export async function getMe(uid: string) {
    const [user, bm, mc, done] = await turso.batch([
        { sql: 'SELECT * FROM site_users WHERE uid = ?', args: [uid] },
        { sql: 'SELECT question_id FROM site_bookmarks WHERE uid = ? ORDER BY created_at DESC', args: [uid] },
        { sql: 'SELECT COUNT(*) AS n FROM site_mistakes WHERE uid = ?', args: [uid] },
        { sql: 'SELECT test_id FROM site_exam_results WHERE uid = ?', args: [uid] },
    ], 'read');
    const r = user.rows[0] || {};
    return {
        uid,
        email: String(r.email || ''),
        name: String(r.name || ''),
        displayName: String(r.name || ''),
        role: String(r.role || 'student'),
        totalAttempted: n(r.total_attempted),
        totalCorrect: n(r.total_correct),
        totalScore: n(r.total_score),
        totalStudySeconds: n(r.total_study_seconds),
        currentStreak: n(r.current_streak),
        bookmarks: bm.rows.map((x) => String(x.question_id)),
        mistakeCount: n(mc.rows[0]?.n),
        completed_exams: done.rows.map((x) => String(x.test_id)),
    };
}

export async function getProgress(uid: string) {
    const r = await turso.execute({ sql: 'SELECT subject, chapter, attempted, correct FROM site_progress WHERE uid = ?', args: [uid] });
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

export async function getMistakes(uid: string) {
    const r = await turso.execute({ sql: 'SELECT question_id, user_answer, at FROM site_mistakes WHERE uid = ? ORDER BY at DESC', args: [uid] });
    const items: Record<string, { id: string; userAnswer: string; timestamp: number }> = {};
    for (const row of r.rows) items[String(row.question_id)] = { id: String(row.question_id), userAnswer: String(row.user_answer || ''), timestamp: n(row.at) };
    return { items };
}

export async function removeMistakes(uid: string, ids: string[]) {
    const list = ids.map(String).slice(0, 500);
    if (!list.length) return;
    await turso.execute({ sql: `DELETE FROM site_mistakes WHERE uid = ? AND question_id IN (${list.map(() => '?').join(',')})`, args: [uid, ...list] });
}

export async function getSolved(uid: string, subject: string) {
    const r = await turso.execute({ sql: 'SELECT question_id FROM site_solved WHERE uid = ? AND subject = ?', args: [uid, subject] });
    return r.rows.map((x) => String(x.question_id));
}

export async function setBookmark(uid: string, questionId: string, on: boolean) {
    await turso.execute(on
        ? { sql: 'INSERT OR IGNORE INTO site_bookmarks (uid, question_id, created_at) VALUES (?, ?, ?)', args: [uid, questionId, Date.now()] }
        : { sql: 'DELETE FROM site_bookmarks WHERE uid = ? AND question_id = ?', args: [uid, questionId] });
}

// ---------------- উত্তর জমা (সাইটের qbank আর মাছরাঙা বট দুটোই) ----------------

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
export async function applyQueue(uid: string, q: AnswerQueue) {
    const attempted = Math.min(Math.max(0, Math.floor(n(q.attempted))), MAX_PER_SYNC);
    if (!attempted) return 0;
    const correct = Math.min(Math.max(0, Math.floor(n(q.correct))), attempted);
    const score = Math.min(Math.max(0, n(q.score)), correct);
    const now = Date.now();
    const stmts: Stmt[] = [{
        sql: `UPDATE site_users SET total_attempted = total_attempted + ?, total_correct = total_correct + ?,
              total_score = total_score + ?, updated_at = ? WHERE uid = ?`,
        args: [attempted, correct, score, nowIso(), uid],
    }];
    for (const [subject, ids] of Object.entries(q.solvedBySubject || {})) {
        for (const id of (ids || []).slice(0, MAX_PER_SYNC)) {
            stmts.push({ sql: 'INSERT OR IGNORE INTO site_solved (uid, question_id, subject, solved_at) VALUES (?, ?, ?, ?)', args: [uid, String(id), subject.trim(), now] });
        }
    }
    const progress = (subject: string, chapter: string, a: number, c: number) => stmts.push({
        sql: `INSERT INTO site_progress (uid, subject, chapter, attempted, correct) VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(uid, subject, chapter) DO UPDATE SET attempted = attempted + excluded.attempted, correct = correct + excluded.correct`,
        args: [uid, subject, chapter, Math.min(Math.max(0, Math.floor(a)), attempted), Math.min(Math.max(0, Math.floor(c)), attempted)],
    });
    for (const v of Object.values(q.subjects || {})) if (v?.subject) progress(String(v.subject).trim(), '', n(v.attempted), n(v.correct));
    for (const v of Object.values(q.chapters || {})) if (v?.subject) progress(String(v.subject), String(v.chapter || ''), n(v.attempted), n(v.correct));
    for (const v of Object.values(q.mistakes || {}).slice(0, MAX_PER_SYNC)) {
        if (!v?.id) continue;
        stmts.push({
            sql: `INSERT INTO site_mistakes (uid, question_id, user_answer, at) VALUES (?, ?, ?, ?)
                  ON CONFLICT(uid, question_id) DO UPDATE SET user_answer = excluded.user_answer, at = excluded.at`,
            args: [uid, String(v.id), String(v.userAnswer || '').slice(0, 4), Math.min(n(v.timestamp) || now, now)],
        });
    }
    // ভুলের লিস্ট ৫০০ তে সীমিত (পুরনোগুলো বাদ), আগে Firestore এ ব্রাউজার এটা করত
    stmts.push({
        sql: `DELETE FROM site_mistakes WHERE uid = ? AND question_id IN (
                SELECT question_id FROM site_mistakes WHERE uid = ? ORDER BY at DESC LIMIT -1 OFFSET ${MISTAKE_CAP})`,
        args: [uid, uid],
    });
    for (let i = 0; i < stmts.length; i += 100) await turso.batch(stmts.slice(i, i + 100), 'write');
    return attempted;
}

// ---------------- লিডারবোর্ড ----------------

export async function leaderboard(limit = 50, uid?: string) {
    const top = await turso.execute({
        sql: "SELECT uid, name, email, total_score FROM site_users WHERE total_score > 0 ORDER BY total_score DESC LIMIT ?",
        args: [limit],
    });
    const rows = top.rows.map((r) => ({
        id: String(r.uid),
        name: String(r.name || '') || (r.email ? String(r.email).split('@')[0] : 'Candidate'),
        score: n(r.total_score),
    }));
    let me = null;
    if (uid && !rows.some((r) => r.id === uid)) {
        const m = await turso.execute({
            sql: `SELECT uid, name, email, total_score, (SELECT COUNT(*) FROM site_users o WHERE o.total_score > u.total_score) + 1 AS rank
                  FROM site_users u WHERE uid = ?`,
            args: [uid],
        });
        const r = m.rows[0];
        if (r) me = { id: uid, name: String(r.name || '') || String(r.email || '').split('@')[0], score: n(r.total_score), rank: n(r.rank) };
    }
    return { rows, me };
}

// ---------------- মডেল টেস্ট ----------------

export async function listModelTests(limit = 50) {
    const r = await turso.execute({ sql: 'SELECT id, data FROM site_model_tests ORDER BY created_at DESC LIMIT ?', args: [limit] });
    return r.rows.map((row) => ({ ...JSON.parse(String(row.data)), id: String(row.id) }));
}

export async function getModelTest(id: string) {
    const r = await turso.execute({ sql: 'SELECT data FROM site_model_tests WHERE id = ?', args: [id] });
    return r.rows[0] ? { ...JSON.parse(String(r.rows[0].data)), id } : null;
}

export async function saveModelTest(id: string, payload: Record<string, unknown>, by: string) {
    const createdAt = Date.now();
    const data = { ...payload, id, createdBy: by, createdAt: new Date(createdAt).toISOString() };
    await turso.execute({
        sql: `INSERT OR REPLACE INTO site_model_tests (id, title, subject, type, is_live, is_archive, start_time, end_time, created_by, created_at, data)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [id, String(payload.title || ''), String(payload.subject || ''), String(payload.type || ''), payload.is_live ? 1 : 0,
               payload.is_archive ? 1 : 0, String(payload.start_time || ''), String(payload.end_time || ''), by, createdAt, JSON.stringify(data)],
    });
}

export async function listExamResults(uid: string) {
    const r = await turso.execute({ sql: 'SELECT test_id, score, total_marks, correct, wrong, submitted_at FROM site_exam_results WHERE uid = ?', args: [uid] });
    return Object.fromEntries(r.rows.map((x) => [String(x.test_id), {
        score: n(x.score), totalMarks: n(x.total_marks), correct: n(x.correct), wrong: n(x.wrong), submittedAt: n(x.submitted_at),
    }]));
}

export async function getExamResult(uid: string, testId: string) {
    const r = await turso.execute({ sql: 'SELECT data FROM site_exam_results WHERE uid = ? AND test_id = ?', args: [uid, testId] });
    return r.rows[0] ? JSON.parse(String(r.rows[0].data)) : null;
}

type TestQuestion = { id: string | number; correct_option?: string };

/** নম্বর সার্ভারে হিসাব হয় (আগে ব্রাউজারে হতো, বদলে দেওয়া যেত)। একই টেস্ট আবার দিলে আগের ফল বদলায়, মোট স্কোরে দুবার যোগ হয় না। */
export async function submitExam(uid: string, testId: string, answers: Record<string, string>, retake: boolean) {
    const test = await getModelTest(testId);
    if (!test) throw new Error('পরীক্ষা পাওয়া যায়নি');
    const questions: TestQuestion[] = Array.isArray(test.questions) ? test.questions : [];
    const neg = n(test.negative_marking) || 0.25;
    let correct = 0, wrong = 0;
    const mistakes: Record<string, { id: string; userAnswer: string; timestamp: number }> = {};
    const clean: Record<string, string> = {};
    for (const q of questions) {
        const id = String(q.id);
        const chosen = String(answers?.[id] || '').toLowerCase();
        if (!chosen) continue;
        clean[id] = chosen;
        if (chosen === String(q.correct_option || '').toLowerCase()) correct++;
        else {
            wrong++;
            mistakes[id] = { id, userAnswer: chosen, timestamp: Date.now() };
        }
    }
    const score = parseFloat((correct - wrong * neg).toFixed(2));
    const prev = await getExamResult(uid, testId);
    const isLive = Boolean(test.is_live && !retake);
    const result = { testId, examTitle: test.title || 'মডেল টেস্ট', score, totalMarks: questions.length, correct, wrong,
                     answers: clean, is_live: isLive, submittedAt: Date.now() };
    const stmts: Stmt[] = [{
        sql: `INSERT OR REPLACE INTO site_exam_results (uid, test_id, score, total_marks, correct, wrong, submitted_at, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [uid, testId, score, questions.length, correct, wrong, result.submittedAt, JSON.stringify(result)],
    }];
    if (!prev) {
        stmts.push({
            sql: `UPDATE site_users SET total_score = total_score + ?, total_attempted = total_attempted + ?, total_correct = total_correct + ?, updated_at = ? WHERE uid = ?`,
            args: [score, Object.keys(clean).length, correct, nowIso(), uid],
        });
    }
    for (const m of Object.values(mistakes)) {
        stmts.push({
            sql: `INSERT INTO site_mistakes (uid, question_id, user_answer, at) VALUES (?, ?, ?, ?)
                  ON CONFLICT(uid, question_id) DO UPDATE SET user_answer = excluded.user_answer, at = excluded.at`,
            args: [uid, m.id, m.userAnswer, m.timestamp],
        });
    }
    await turso.batch(stmts, 'write');
    return result;
}

// ---------------- রিপোর্ট ----------------

export async function createReport(questionId: string, reason: string, by: { uid: string; email: string; name: string },
                                   via = 'site', ai?: { verdict?: string; option?: string }) {
    const id = `${questionId}_${via === 'site' ? by.uid : `bot_${by.uid}`}`.replace(/[^A-Za-z0-9_\-]/g, '');
    await turso.execute({
        sql: `INSERT INTO site_reports (id, question_id, reported_by, email, name, reason, via, ai_verdict, ai_option, status, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
              ON CONFLICT(id) DO UPDATE SET reason = excluded.reason, status = 'pending', created_at = excluded.created_at`,
        args: [id, questionId, by.uid, by.email, by.name, reason.slice(0, 1000), via, ai?.verdict || null, ai?.option || null, Date.now()],
    });
    return id;
}

export async function setName(uid: string, name: string) {
    await turso.execute({ sql: 'UPDATE site_users SET name = ?, updated_at = ? WHERE uid = ?', args: [name.trim().slice(0, 60), nowIso(), uid] });
}
