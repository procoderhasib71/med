import { NextRequest, NextResponse } from 'next/server';
import { CLASSROOM_URL, hostPlatform } from '@/lib/platform';

// NEXT_PUBLIC_CLASSROOM_URL দেওয়া থাকলে med/ka/kha/eng.admcq.com এর পেজে ঢুকলে ক্লাসরুমে পাঠাই,
// সেই কোর্স চালু করে একই পেজে (পুরনো লিংক ভাঙে না)। API আর ফাইল আগের মতোই চলে।
export function proxy(req: NextRequest) {
    const p = hostPlatform(req.headers.get('x-forwarded-host') || req.headers.get('host'));
    if (!CLASSROOM_URL || !p || req.method !== 'GET') return NextResponse.next();
    const to = `${req.nextUrl.pathname}${req.nextUrl.search}`;
    return NextResponse.redirect(`${CLASSROOM_URL}/course/${p}?to=${encodeURIComponent(to)}`, 307);
}

export const config = {
    // api, Next এর নিজের ফাইল আর ছবি/manifest এর মতো ফাইল বাদে সব পেজ
    matcher: ['/((?!api/|_next/|.*\\..*).*)'],
};
