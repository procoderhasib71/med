import { NextRequest, NextResponse } from 'next/server';
import { fail, requireUser } from '@/lib/serverAuth';
import { getProgress } from '@/lib/siteData';

export async function GET(req: NextRequest) {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;
    return NextResponse.json({ success: true, ...(await getProgress(user.uid)) });
}
