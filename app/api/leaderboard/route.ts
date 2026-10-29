import { NextRequest, NextResponse } from 'next/server';
import { getUser, platformOf } from '@/lib/serverAuth';
import { leaderboard } from '@/lib/siteData';

// সবার জন্য খোলা; লগইন থাকলে নিজের র‍্যাংকও (প্রথম ৫০ এর বাইরে হলে)
export async function GET(req: NextRequest) {
    const user = await getUser(req);
    return NextResponse.json({ success: true, ...(await leaderboard(platformOf(req), 50, user?.uid)) });
}
