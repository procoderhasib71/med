// পুরনো Firebase প্রজেক্টের Firestore থেকে সব ডাটা Turso তে (একবারের কাজ, বারবার চালালেও একই ফল)।
// চালাও:  node scripts/migrate-firestore-to-turso.mjs <পুরনো প্রজেক্টের service-account.json> <auth-export আউটপুট .json>
// Turso এর ঠিকানা আর টোকেন .env.local থেকে নেয়। টেবিলগুলো Hermes2/migrations/008_site_data.sql বানায়।
import { readFileSync, writeFileSync } from 'fs';
import { createClient } from '@libsql/client';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const [keyPath, authOut] = process.argv.slice(2);
if (!keyPath || !authOut) throw new Error('ব্যবহার: node scripts/migrate-firestore-to-turso.mjs <key.json> <auth-export.json>');

const env = Object.fromEntries(
    readFileSync('.env.local', 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l))
        .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')]),
);
const turso = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
const sa = JSON.parse(readFileSync(keyPath, 'utf8'));
initializeApp({ credential: cert(sa), projectId: sa.project_id });
const fs = getFirestore();

const now = new Date().toISOString();
const ms = (v) => (v?.toMillis ? v.toMillis() : typeof v === 'number' ? v : v ? Date.parse(v) || null : null);
const plain = (v) => JSON.parse(JSON.stringify(v, (_, x) => (x && typeof x === 'object' && typeof x.toDate === 'function' ? x.toDate().toISOString() : x)));
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

const stmts = [];
const add = (sql, args) => stmts.push({ sql, args });
const count = {};
const bump = (k, n = 1) => { count[k] = (count[k] || 0) + n; };

// প্রশ্নের বিষয় (পুরনো solved লিস্টে বিষয় ছিল না) আর কোন id আছে
const qsub = new Map((await turso.execute('SELECT id, subject FROM questions')).rows.map((r) => [String(r.id), String(r.subject || '')]));

// ---- ১. হুবহু ব্যাকআপ: সব কালেকশন আর সাব-কালেকশন ----
async function backup(col) {
    const snap = await col.get();
    for (const d of snap.docs) {
        add('INSERT OR REPLACE INTO site_firestore_backup (path, data, exported_at) VALUES (?, ?, ?)', [d.ref.path, JSON.stringify(plain(d.data())), now]);
        bump('backup');
        for (const sub of await d.ref.listCollections()) await backup(sub);
    }
}
for (const c of await fs.listCollections()) await backup(c);

// ---- ২. ছাত্র ----
const progress = new Map();   // uid|subject|chapter → {attempted, correct}
const setProgress = (uid, subject, chapter, attempted, correct) => {
    if (!subject) return;
    const k = `${uid}\u0000${subject}\u0000${chapter || ''}`;
    const p = progress.get(k) || { uid, subject, chapter: chapter || '', attempted: 0, correct: 0 };
    p.attempted = Math.max(p.attempted, num(attempted));
    p.correct = Math.max(p.correct, num(correct));
    progress.set(k, p);
};
const addSolved = (uid, id, subject, at) => {
    id = String(id);
    add('INSERT OR IGNORE INTO site_solved (uid, question_id, subject, solved_at) VALUES (?, ?, ?, ?)', [uid, id, subject || qsub.get(id) || '', at]);
    bump('solved');
};
const addMistake = (uid, id, answer, at) => {
    id = String(id);
    if (!qsub.has(id)) return bump('mistake_unknown_question');
    add(`INSERT INTO site_mistakes (uid, question_id, user_answer, at) VALUES (?, ?, ?, ?)
         ON CONFLICT(uid, question_id) DO UPDATE SET user_answer = excluded.user_answer, at = excluded.at WHERE excluded.at > site_mistakes.at`,
        [uid, id, String(answer || ''), at || Date.now()]);
    bump('mistakes');
};

const users = await fs.collection('users').get();
for (const u of users.docs) {
    const d = u.data();
    const uid = u.id;
    add(`INSERT OR REPLACE INTO site_users (uid, email, name, role, total_attempted, total_correct, total_score, total_study_seconds,
         current_streak, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uid, d.email || '', d.name || d.displayName || '', d.role || 'student', num(d.totalAttempted), num(d.totalCorrect),
         num(d.totalScore), num(d.totalStudySeconds), num(d.currentStreak), String(plain({ c: d.createdAt }).c || now), now]);
    bump('users');
    for (const id of d.bookmarks || []) {
        add('INSERT OR IGNORE INTO site_bookmarks (uid, question_id, created_at) VALUES (?, ?, ?)', [uid, String(id), Date.now()]);
        bump('bookmarks');
    }
    for (const id of d.solved || []) addSolved(uid, id, '', null);                       // পুরনো ফরম্যাট
    for (const m of d.mistakes || []) if (m?.id) addMistake(uid, m.id, m.userAnswer, ms(m.timestamp));

    for (const s of (await u.ref.collection('solved_by_subject').get()).docs) {
        for (const id of s.get('ids') || []) addSolved(uid, id, s.id, null);
    }
    for (const s of (await u.ref.collection('stats').get()).docs) {
        const data = s.data();
        if (s.id === 'mistakes') {
            const items = data.items && typeof data.items === 'object' ? data.items : data;
            for (const [id, v] of Object.entries(items)) if (v && typeof v === 'object') addMistake(uid, v.id || id, v.userAnswer, ms(v.timestamp));
        }
        if (s.id === 'progress') {
            for (const v of Object.values(data.subjects || {})) setProgress(uid, v.subject, '', v.totalAttempted, v.correctAnswers);
            for (const v of Object.values(data.chapters || {})) setProgress(uid, v.subject, v.chapter, v.totalAttempted, v.correctAnswers);
            // পুরনো বাগ: "chapters.X.subject" নামের ঘর (বিন্দুসহ নাম), এগুলো এক করে পড়ি
            const dotted = {};
            for (const [k, v] of Object.entries(data)) {
                const m = k.match(/^(subjects|chapters)\.(.+)\.(subject|chapter|totalAttempted|correctAnswers)$/);
                if (m) (dotted[`${m[1]}|${m[2]}`] ||= { kind: m[1] })[m[3]] = v;
            }
            for (const v of Object.values(dotted)) setProgress(uid, v.subject, v.kind === 'chapters' ? v.chapter : '', v.totalAttempted, v.correctAnswers);
        }
    }
    for (const m of (await u.ref.collection('mistakes').get()).docs) addMistake(uid, m.id, m.get('userAnswer'), ms(m.get('timestamp')));   // পুরনো ফরম্যাট
    for (const r of (await u.ref.collection('exam_results').get()).docs) {
        const x = r.data();
        add(`INSERT OR REPLACE INTO site_exam_results (uid, test_id, score, total_marks, correct, wrong, submitted_at, data)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [uid, x.testId || r.id, num(x.score), num(x.totalMarks), num(x.correct), num(x.wrong), ms(x.submittedAt), JSON.stringify(plain(x))]);
        bump('exam_results');
    }
}
for (const p of progress.values()) {
    add('INSERT OR REPLACE INTO site_progress (uid, subject, chapter, attempted, correct) VALUES (?, ?, ?, ?, ?)', [p.uid, p.subject, p.chapter, p.attempted, p.correct]);
    bump('progress');
}

// ---- ৩. মডেল টেস্ট আর রিপোর্ট ----
for (const t of (await fs.collection('model_tests').get()).docs) {
    const x = t.data();
    add(`INSERT OR REPLACE INTO site_model_tests (id, title, subject, type, is_live, is_archive, start_time, end_time, created_by, created_at, data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [t.id, x.title || '', x.subject || '', x.type || '', x.is_live ? 1 : 0, x.is_archive ? 1 : 0, x.start_time || '', x.end_time || '',
         x.createdBy || '', ms(x.createdAt), JSON.stringify({ ...plain(x), id: x.id || t.id })]);
    bump('model_tests');
}
for (const r of (await fs.collection('reported_questions').get()).docs) {
    const x = r.data();
    add(`INSERT OR REPLACE INTO site_reports (id, question_id, reported_by, email, name, reason, via, ai_verdict, ai_option, status,
         fixed_from, fixed_to, resolved_by, created_at, resolved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [r.id, String(x.questionId || ''), x.reportedBy || '', x.reportedByEmail || '', x.reportedByName || '', x.reason || '', x.via || 'site',
         x.aiVerdict || null, x.aiOption || null, x.status || 'pending', x.fixedFrom || null, x.fixedTo || null, x.resolvedBy || null,
         ms(x.createdAt), ms(x.resolvedAt)]);
    bump('reports');
}

// ---- ৪. লগইন অ্যাকাউন্ট: নতুন প্রজেক্টে তোলার জন্য ফাইলে (পাসওয়ার্ড hash সহ, গোপন রাখো) ----
const exported = [];
let page;
do {
    page = await getAuth().listUsers(1000, page?.pageToken);
    for (const u of page.users) {
        exported.push({
            uid: u.uid, email: u.email, emailVerified: u.emailVerified, displayName: u.displayName, photoURL: u.photoURL,
            disabled: u.disabled, passwordHash: u.passwordHash, passwordSalt: u.passwordSalt,
            providerData: u.providerData.map((p) => ({ uid: p.uid, providerId: p.providerId, email: p.email, displayName: p.displayName, photoURL: p.photoURL })),
            metadata: { creationTime: u.metadata.creationTime, lastSignInTime: u.metadata.lastSignInTime },
        });
        // Firestore এ doc না থাকা অ্যাকাউন্টও site_users এ (লিডারবোর্ড/প্রোফাইলের জন্য)
        add(`INSERT OR IGNORE INTO site_users (uid, email, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
            [u.uid, u.email || '', u.displayName || '', new Date(u.metadata.creationTime).toISOString(), now]);
    }
} while (page.pageToken);
writeFileSync(authOut, JSON.stringify({ project: sa.project_id, exportedAt: now, users: exported }, null, 2));
count.auth_users = exported.length;

for (let i = 0; i < stmts.length; i += 100) await turso.batch(stmts.slice(i, i + 100), 'write');
console.log('✅ Turso তে লেখা হলো:', count);
