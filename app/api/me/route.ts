import { NextRequest, NextResponse } from 'next/server';
import { fail, requireUser } from '@/lib/serverAuth';
import { getMe, setName } from '@/lib/siteData';

// প্রোফাইল: মোট স্কোর, বুকমার্ক, ভুলের সংখ্যা, দেওয়া পরীক্ষা
export async function GET(req: NextRequest) {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;
    return NextResponse.json({ success: true, user: await getMe(user.uid) });
}

// নাম বদলানো (ফোনে প্রথমবার লগইন করলে নাম থাকে না), body: { name }
export async function PATCH(req: NextRequest) {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;
    const { name } = await req.json().catch(() => ({}));
    if (typeof name !== 'string' || name.trim().length < 2) return fail('নাম লিখুন');
    await setName(user.uid, name);
    return NextResponse.json({ success: true });
}
