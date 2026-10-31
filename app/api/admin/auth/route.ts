import { NextRequest, NextResponse } from 'next/server';
import { checkPassword, clearAdminCookie, hasAdminSession, isConfigured, setAdminCookie, setPassword } from '@/lib/adminAuth';
import { adminEmails, fail, getUser } from '@/lib/serverAuth';

// admin প্যানেলের পাসওয়ার্ড: লগইন, প্রথমবার সেট, বদলানো, লগআউট

const MIN_LEN = 8;

export async function GET(req: NextRequest) {
    return NextResponse.json({ success: true, configured: await isConfigured(), loggedIn: await hasAdminSession(req) });
}

// body: { action: 'login' | 'setup' | 'change', password, current? }
export async function POST(req: NextRequest) {
    const { action, password, current } = await req.json().catch(() => ({}));
    const pw = String(password || '');

    if (action === 'login') {
        const ok = await checkPassword(pw);
        if (ok === 'locked') return fail('অনেকবার ভুল হয়েছে। ১৫ মিনিট পরে আবার চেষ্টা করুন।', 429);
        if (!ok) return fail('পাসওয়ার্ড ভুল', 401);
        return setAdminCookie(NextResponse.json({ success: true }), req);
    }

    if (pw.length < MIN_LEN) return fail(`পাসওয়ার্ড অন্তত ${MIN_LEN} অক্ষরের দিন`);

    if (action === 'setup') {
        // প্রথমবার শুধু ADMIN_EMAILS এর অ্যাকাউন্টে লগইন করা অবস্থায় (নইলে যে কেউ আগে এসে সেট করে ফেলতে পারত)
        if (await isConfigured()) return fail('পাসওয়ার্ড আগেই সেট করা আছে', 409);
        const user = await getUser(req);
        if (!user?.email || !adminEmails().includes(user.email)) return fail('প্রথমবার সেট করতে admin ইমেইলে লগইন করে আসুন', 403);
        await setPassword(pw);
        return setAdminCookie(NextResponse.json({ success: true }), req);
    }

    if (action === 'change') {
        if (!(await hasAdminSession(req))) return fail('আগে admin হিসেবে লগইন করুন', 401);
        const ok = await checkPassword(String(current || ''));
        if (ok === 'locked') return fail('অনেকবার ভুল হয়েছে। ১৫ মিনিট পরে আবার চেষ্টা করুন।', 429);
        if (!ok) return fail('এখনকার পাসওয়ার্ড ভুল', 401);
        await setPassword(pw);   // নতুন চাবি: অন্য সব জায়গার admin লগইন বাতিল
        return setAdminCookie(NextResponse.json({ success: true }), req);
    }

    return fail('কাজটা বোঝা যায়নি');
}

export async function DELETE() {
    return clearAdminCookie(NextResponse.json({ success: true }));
}
