import { NextRequest, NextResponse } from 'next/server';
import { fail, platformOf, requireUser } from '@/lib/serverAuth';
import { getSolved } from '@/lib/siteData';

export async function GET(req: NextRequest) {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;
    const subject = (new URL(req.url).searchParams.get('subject') || '').trim();
    if (!subject) return fail('subject নেই');
    return NextResponse.json({ success: true, ids: await getSolved(user.uid, subject, platformOf(req)) });
}
