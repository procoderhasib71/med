import { NextRequest, NextResponse } from 'next/server';
import { fail, requireUser } from '@/lib/serverAuth';
import { applyQueue } from '@/lib/siteData';

// qbank এর উত্তরের ব্যাচ (আগে Firestore writeBatch)
export async function POST(req: NextRequest) {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;
    const queue = await req.json().catch(() => null);
    if (!queue || typeof queue !== 'object') return fail('ফাঁকা');
    try {
        return NextResponse.json({ success: true, saved: await applyQueue(user.uid, queue) });
    } catch (e: unknown) {
        console.error('sync error', e);
        return fail('সেভ করা যায়নি', 500);
    }
}
