import { NextRequest, NextResponse } from 'next/server';
import { fail, requireUser } from '@/lib/serverAuth';
import { getMe } from '@/lib/siteData';

// প্রোফাইল: মোট স্কোর, বুকমার্ক, ভুলের সংখ্যা, দেওয়া পরীক্ষা
export async function GET(req: NextRequest) {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;
    return NextResponse.json({ success: true, user: await getMe(user.uid) });
}
