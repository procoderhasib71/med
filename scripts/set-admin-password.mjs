// admin প্যানেলের পাসওয়ার্ড সেট বা রিসেট (প্রথমবার, বা পাসওয়ার্ড ভুলে গেলে)। নিজের কম্পিউটারে চালাও:
//   node scripts/set-admin-password.mjs
// পাসওয়ার্ড লেখার সময় স্ক্রিনে দেখা যায় না। .env.local এর TURSO_DATABASE_URL আর TURSO_AUTH_TOKEN লাগে।
// সেট করলে আগের সব admin লগইন বাতিল হয়। lib/adminAuth.ts এর একই নিয়মে hash হয়।
import { randomBytes, scrypt as scryptCb } from 'crypto';
import fs from 'fs';
import readline from 'readline';
import { promisify } from 'util';
import { createClient } from '@libsql/client';

const scrypt = promisify(scryptCb);
const env = Object.fromEntries(fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]));

function ask(question) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
        rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s); };   // টাইপ করা অক্ষর দেখাই না
        rl.question(question, (answer) => { rl.close(); process.stdout.write('\n'); resolve(answer); });
    });
}

const pw = await ask('নতুন admin পাসওয়ার্ড (অন্তত ৮ অক্ষর): ');
const again = await ask('আবার লিখুন: ');
if (pw.length < 8) { console.error('❌ অন্তত ৮ অক্ষর দিন'); process.exit(1); }
if (pw !== again) { console.error('❌ দুইবারের পাসওয়ার্ড মেলেনি'); process.exit(1); }

const salt = randomBytes(16);
const hash = await scrypt(pw, salt, 64);
const values = {
    password_hash: `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`,
    session_secret: randomBytes(32).toString('base64'),
    fail_count: '0',
    lock_until: '0',
    updated_at: new Date().toISOString(),
};
const db = createClient({ url: env.TURSO_DATABASE_URL, authToken: env.TURSO_AUTH_TOKEN });
await db.batch(Object.entries(values).map(([k, v]) => ({
    sql: 'INSERT INTO site_admin (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    args: [k, v],
})), 'write');
console.log('✅ admin পাসওয়ার্ড সেট হয়েছে। app.admcq.com/admin এ গিয়ে এটা দিয়ে ঢুকুন।');
