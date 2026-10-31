import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin';
import { fail } from '@/lib/serverAuth';

// রেজিস্ট্রেশন বা "পাসওয়ার্ড ভুলে গেছি" এর আগে: এই নম্বরে পাসওয়ার্ডসহ অ্যাকাউন্ট আছে কিনা, যাতে অযথা SMS না যায়।
// আগে শুধু OTP দিয়ে ঢোকা অ্যাকাউন্টে পাসওয়ার্ড নেই, তাই সেটা "নেই" ধরা হয় (রেজিস্টার করে পাসওয়ার্ড বানাবে)।
// ব্যবহারকারী খোঁজার অনুমতি না থাকলে registered: null, তখন ব্রাউজার আগের মতো OTP পাঠায়।
export async function GET(req: NextRequest) {
    const phone = req.nextUrl.searchParams.get('phone') || '';
    if (!/^\+8801[3-9]\d{8}$/.test(phone)) return fail('ফোন নম্বরটা ঠিক নেই');
    try {
        await adminAuth.getUserByEmail(`${phone.replace(/\D/g, '')}@phone.admcq.com`);
        return NextResponse.json({ success: true, registered: true });
    } catch (e) {
        const code = String((e as { code?: string })?.code || '');
        if (code === 'auth/user-not-found') return NextResponse.json({ success: true, registered: false });
        console.error('phone lookup failed', code || e);
        return NextResponse.json({ success: true, registered: null });
    }
}
