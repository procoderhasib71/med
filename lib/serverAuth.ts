import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { platformFromHost, type Platform } from '@/lib/platform';
import { ensureUser } from '@/lib/siteData';

// ADMIN_EMAILS: koma diye alada kora email, hosting er environment e bosano
const adminEmails = () =>
    (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

export const SESSION_COOKIE = '__session';   // admcq.com এর লগইন বসায় (.admcq.com), চার subdomain ই পড়ে

export type SignedInUser = { uid: string; email: string; name: string; phone?: string };

/** কোন প্ল্যাটফর্মের সাইট থেকে request (ঠিকানা দেখে) */
export const platformOf = (req: NextRequest): Platform =>
    platformFromHost(req.headers.get('x-forwarded-host') || req.headers.get('host'));

/** লগইন: ব্রাউজারের Firebase টোকেন (Authorization header) অথবা admcq.com এর session cookie */
export async function getUser(req: NextRequest): Promise<SignedInUser | null> {
    const header = req.headers.get('authorization') || '';
    try {
        const t = header.startsWith('Bearer ')
            ? await adminAuth.verifyIdToken(header.slice(7))
            : req.cookies.get(SESSION_COOKIE)?.value
                ? await adminAuth.verifySessionCookie(req.cookies.get(SESSION_COOKIE)!.value)
                : null;
        if (!t) return null;
        // ফোন-পাসওয়ার্ডের অ্যাকাউন্টে ইমেইলটা বানানো (8801XXXXXXXXX@phone.admcq.com), আসল ইমেইল নয়
        const email = (t.email || '').toLowerCase();
        const synthetic = email.endsWith('@phone.admcq.com');
        return { uid: t.uid, email: synthetic ? '' : email, name: String(t.name || ''),
                 phone: String(t.phone_number || (synthetic ? `+${email.split('@')[0]}` : '')) };
    } catch {
        return null;
    }
}

export const fail = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });

/** লগইন না থাকলে 401। প্রথমবার এলে site_users এ সারি বানায়। */
export async function requireUser(req: NextRequest): Promise<SignedInUser | NextResponse> {
    const user = await getUser(req);
    if (!user) return fail('লগইন করুন', 401);
    await ensureUser(user);
    return user;
}

/** Admin না হলে 401/403 response ferot dey, hole user. */
export async function requireAdmin(req: NextRequest): Promise<SignedInUser | NextResponse> {
    const user = await getUser(req);
    if (!user) return fail('লগইন করুন', 401);
    if (!user.email || !adminEmails().includes(user.email)) return fail('অনুমতি নেই', 403);
    return user;
}
