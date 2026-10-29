import { NextRequest, NextResponse } from 'next/server';
import { fail, platformOf, requireUser } from '@/lib/serverAuth';
import { setBookmark } from '@/lib/siteData';

// body: { id, on }
export async function POST(req: NextRequest) {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;
    const { id, on } = await req.json().catch(() => ({}));
    if (!id) return fail('id নেই');
    await setBookmark(user.uid, String(id), Boolean(on), platformOf(req));
    return NextResponse.json({ success: true });
}
