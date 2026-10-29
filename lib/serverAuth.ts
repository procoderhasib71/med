import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { ensureUser } from '@/lib/siteData';

// ADMIN_EMAILS: koma diye alada kora email, hosting er environment e bosano
const adminEmails = () =>
    (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);

export type SignedInUser = { uid: string; email: string; name: string };

export async function getUser(req: NextRequest): Promise<SignedInUser | null> {
    const header = req.headers.get('authorization') || '';
    if (!header.startsWith('Bearer ')) return null;
    try {
        const t = await adminAuth.verifyIdToken(header.slice(7));
        return { uid: t.uid, email: (t.email || '').toLowerCase(), name: String(t.name || '') };
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
