import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import type { NextRequest, NextResponse } from 'next/server';
import { turso } from '@/lib/turso';

// admin প্যানেলের আলাদা পাসওয়ার্ড (ছাত্রের লগইন লাগে না)। টেবিল: Hermes2/migrations/011 (site_admin)।
// পাসওয়ার্ড scrypt hash হয়ে থাকে; লগইনে ১২ ঘণ্টার সই করা cookie। পাসওয়ার্ড বদলালে চাবি বদলায়, পুরনো সব লগইন বাতিল।
// ৫ বার ভুল দিলে ১৫ মিনিট আটকানো।

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
export const ADMIN_COOKIE = 'admcq_admin';
const SESSION_HOURS = 12;
const MAX_FAILS = 5;
const LOCK_MIN = 15;

async function getAll(): Promise<Record<string, string>> {
    const r = await turso.execute('SELECT key, value FROM site_admin');
    return Object.fromEntries(r.rows.map((x) => [String(x.key), String(x.value)]));
}

const put = (pairs: Record<string, string>) =>
    turso.batch(Object.entries(pairs).map(([k, v]) => ({
        sql: 'INSERT INTO site_admin (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        args: [k, v],
    })), 'write');

export const isConfigured = async () => Boolean((await getAll()).password_hash);

export async function setPassword(password: string) {
    const salt = randomBytes(16);
    const hash = await scrypt(password, salt, 64);
    await put({
        password_hash: `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`,
        session_secret: randomBytes(32).toString('base64'),
        fail_count: '0',
        lock_until: '0',
        updated_at: new Date().toISOString(),
    });
}

/** ঠিক হলে true; ভুল হলে গুনে রাখে, বেশি ভুলে আটকায়। আটকানো থাকলে 'locked' */
export async function checkPassword(password: string): Promise<boolean | 'locked'> {
    const all = await getAll();
    if (!all.password_hash) return false;
    if (Number(all.lock_until || 0) > Date.now()) return 'locked';
    const [, saltB64, hashB64] = all.password_hash.split('$');
    const expected = Buffer.from(hashB64, 'base64');
    const got = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length);
    if (timingSafeEqual(got, expected)) {
        if (all.fail_count !== '0') await put({ fail_count: '0', lock_until: '0' });
        return true;
    }
    const fails = Number(all.fail_count || 0) + 1;
    await put(fails >= MAX_FAILS
        ? { fail_count: '0', lock_until: String(Date.now() + LOCK_MIN * 60 * 1000) }
        : { fail_count: String(fails) });
    return false;
}

const sign = (secret: string, payload: string) => createHmac('sha256', secret).update(payload).digest('base64url');

export async function setAdminCookie(res: NextResponse, req: NextRequest) {
    const { session_secret } = await getAll();
    const payload = String(Date.now() + SESSION_HOURS * 3600 * 1000);
    res.cookies.set(ADMIN_COOKIE, `${payload}.${sign(session_secret, payload)}`, {
        httpOnly: true, sameSite: 'strict', path: '/', maxAge: SESSION_HOURS * 3600,
        secure: req.nextUrl.protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https',
    });
    return res;
}

export function clearAdminCookie(res: NextResponse) {
    res.cookies.set(ADMIN_COOKIE, '', { path: '/', maxAge: 0 });
    return res;
}

/** admin পাসওয়ার্ড দিয়ে লগইন করা cookie ঠিক আছে কিনা */
export async function hasAdminSession(req: NextRequest) {
    const raw = req.cookies.get(ADMIN_COOKIE)?.value || '';
    const [payload, sig] = raw.split('.');
    if (!payload || !sig || Number(payload) < Date.now()) return false;
    const { session_secret } = await getAll().catch(() => ({} as Record<string, string>));
    if (!session_secret) return false;
    const want = Buffer.from(sign(session_secret, payload));
    const have = Buffer.from(sig);
    return want.length === have.length && timingSafeEqual(want, have);
}
