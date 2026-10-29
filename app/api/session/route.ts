import { NextRequest, NextResponse } from 'next/server';
import { getUser, SESSION_COOKIE } from '@/lib/serverAuth';
import { ROOT_DOMAIN } from '@/lib/platform';

// ব্রাউজার জানতে চায় admcq.com এর লগইন (session cookie) আছে কিনা
export async function GET(req: NextRequest) {
    const user = await getUser(req);
    return NextResponse.json({ success: Boolean(user), user });
}

// লগআউট: চার subdomain এর একই cookie মুছে দেয়
export async function DELETE(req: NextRequest) {
    const res = NextResponse.json({ success: true });
    const host = (req.headers.get('x-forwarded-host') || req.headers.get('host') || '').split(':')[0];
    res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0, ...(host.endsWith(ROOT_DOMAIN) ? { domain: `.${ROOT_DOMAIN}` } : {}) });
    return res;
}
