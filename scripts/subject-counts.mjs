// প্রশ্ন যোগ/লুকানোর পরে চালান: node scripts/subject-counts.mjs
// প্রতিটা কোর্সের বিষয়ভিত্তিক প্রশ্নসংখ্যা গুনে app/constants/subjectCounts.json এ লেখে।
// হোম পেজ এই ফাইল থেকেই সংখ্যা দেখায়, তাই ছাত্ররা পেজ খুললে Turso তে কোনো read হয় না।
// (এই স্ক্রিপ্ট নিজে একবার পুরো টেবিল পড়ে: মেডিকেল ~২৮ হাজার, ক ~১৫ হাজার, খ ~২৫ হাজার read)
import fs from 'node:fs';
import { createClient } from '@libsql/client';

const env = Object.fromEntries(fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const db = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
const VISIBLE = "(error IS NULL OR NOT (error LIKE 'Error:%' OR error LIKE 'pre-explain error:%'))"; // lib/questionVisibility.ts এর নিয়ম
const TABLES = { med: 'questions', ka: 'ka_questions', kha: 'kha_questions', ssc: 'ssc_questions' };

const out = {};
for (const [p, table] of Object.entries(TABLES)) {
    const r = await db.execute({ sql: `SELECT subject, COUNT(*) n FROM ${table} WHERE platform = ? AND subject <> '' AND ${VISIBLE} GROUP BY subject ORDER BY n DESC`, args: [p] });
    out[p] = Object.fromEntries(r.rows.map((x) => [String(x.subject), Number(x.n)]));
    console.log(p, Object.values(out[p]).reduce((a, b) => a + b, 0), 'questions in', r.rows.length, 'subjects');
}
fs.writeFileSync(new URL('../app/constants/subjectCounts.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
console.log('wrote app/constants/subjectCounts.json');
