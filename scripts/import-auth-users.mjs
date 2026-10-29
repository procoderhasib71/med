// পুরনো Firebase প্রজেক্টের লগইন অ্যাকাউন্ট নতুন প্রজেক্টে তোলা (uid আর পাসওয়ার্ড একই থাকে)।
// চালাও:  HASH_KEY=... HASH_SALT_SEP=... node scripts/import-auth-users.mjs <নতুন-প্রজেক্টের-key.json> <auth-export.json>
// HASH_KEY আর HASH_SALT_SEP: পুরনো প্রজেক্টের Authentication → Users → ⋮ → Password hash parameters থেকে
// (base64_signer_key আর base64_salt_separator)। rounds আর mem_cost ও সেখান থেকে (ডিফল্ট ৮ আর ১৪)।
import { readFileSync } from 'fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const [keyPath, exportPath] = process.argv.slice(2);
const { HASH_KEY, HASH_SALT_SEP, HASH_ROUNDS = '8', HASH_MEM_COST = '14' } = process.env;
if (!keyPath || !exportPath || !HASH_KEY || !HASH_SALT_SEP) throw new Error('key, export ফাইল আর HASH_KEY/HASH_SALT_SEP লাগবে');

const sa = JSON.parse(readFileSync(keyPath, 'utf8'));
initializeApp({ credential: cert(sa), projectId: sa.project_id });
const auth = getAuth();
const { project, users } = JSON.parse(readFileSync(exportPath, 'utf8'));
if (project === sa.project_id) throw new Error('পুরনো আর নতুন প্রজেক্ট একই!');

// আগের চেষ্টায় ভুলভাবে ওঠা অ্যাকাউন্ট থাকলে আগে মুছি (একই uid তে আবার তোলা যায় না)
if (process.env.REIMPORT_UIDS) await auth.deleteUsers(process.env.REIMPORT_UIDS.split(','));

const records = users.filter((u) => !process.env.REIMPORT_UIDS || process.env.REIMPORT_UIDS.split(',').includes(u.uid)).map((u) => ({
    uid: u.uid,
    email: u.email || undefined,
    emailVerified: Boolean(u.emailVerified),
    displayName: u.displayName || undefined,
    photoURL: u.photoURL || undefined,
    disabled: Boolean(u.disabled),
    passwordHash: u.passwordHash ? Buffer.from(u.passwordHash, 'base64') : undefined,
    passwordSalt: u.passwordSalt ? Buffer.from(u.passwordSalt, 'base64') : undefined,
    // ফোন নম্বরের লগইন providerData তে নয়, phoneNumber ঘরে যায়
    phoneNumber: u.phoneNumber || u.providerData.find((p) => p.providerId === 'phone')?.uid || undefined,
    providerData: u.providerData
        .filter((p) => p.providerId !== 'password' && p.providerId !== 'phone')
        .map((p) => ({ uid: p.uid, providerId: p.providerId, email: p.email || undefined, displayName: p.displayName || undefined, photoURL: p.photoURL || undefined })),
    metadata: { creationTime: u.metadata.creationTime, lastSignInTime: u.metadata.lastSignInTime || undefined },
}));

const result = await auth.importUsers(records, {
    hash: {
        algorithm: 'SCRYPT',
        key: Buffer.from(HASH_KEY, 'base64'),
        saltSeparator: Buffer.from(HASH_SALT_SEP, 'base64'),
        rounds: Number(HASH_ROUNDS),
        memoryCost: Number(HASH_MEM_COST),
    },
});
console.log(`✅ তোলা হলো: ${result.successCount}, ব্যর্থ: ${result.failureCount}`);
for (const e of result.errors) console.log(`   ❌ #${e.index}: ${e.error.message}`);

// মিলিয়ে দেখা: সব uid আছে কিনা, কার কোন লগইন
let found = 0, pw = 0, google = 0;
for (const u of users) {
    if (process.env.REIMPORT_UIDS && !process.env.REIMPORT_UIDS.split(',').includes(u.uid)) { found++; continue; }
    const got = await auth.getUser(u.uid).catch(() => null);
    if (!got) continue;
    found++;
    if (got.passwordHash || got.providerData.some((p) => p.providerId === 'password')) pw++;
    if (got.providerData.some((p) => p.providerId === 'google.com')) google++;
}
console.log(`🔍 নতুন প্রজেক্টে: ${found}/${users.length} জন (পাসওয়ার্ড: ${pw}, Google: ${google})`);
