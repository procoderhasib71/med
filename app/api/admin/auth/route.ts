import { NextRequest, NextResponse } from 'next/server';
import { checkPassword, clearAdminCookie, hasAdminSession, isConfigured, setAdminCookie, setPassword } from '@/lib/adminAuth';
import { adminEmails, fail, getUser } from '@/lib/serverAuth';
import { reqT } from '@/lib/serverLang';

// admin প্যানেলের পাসওয়ার্ড: লগইন, প্রথমবার সেট, বদলানো, লগআউট

const MIN_LEN = 8;

export async function GET(req: NextRequest) {
    return NextResponse.json({ success: true, configured: await isConfigured(), loggedIn: await hasAdminSession(req) });
}

// body: { action: 'login' | 'setup' | 'change', password, current? }
export async function POST(req: NextRequest) {
    const { action, password, current } = await req.json().catch(() => ({}));
    const pw = String(password || '');
    const t = reqT(req);

    if (action === 'login') {
        const ok = await checkPassword(pw);
        if (ok === 'locked') return fail(t('অনেকবার ভুল হয়েছে। ১৫ মিনিট পরে আবার চেষ্টা করুন।', 'Too many wrong attempts. Try again in 15 minutes.'), 429);
        if (!ok) return fail(t('পাসওয়ার্ড ভুল', 'Wrong password'), 401);
        return setAdminCookie(NextResponse.json({ success: true }), req);
    }

    if (pw.length < MIN_LEN) return fail(t(`পাসওয়ার্ড অন্তত ${MIN_LEN} অক্ষরের দিন`, `Password must be at least ${MIN_LEN} characters`));

    if (action === 'setup') {
        // প্রথমবার শুধু ADMIN_EMAILS এর অ্যাকাউন্টে লগইন করা অবস্থায় (নইলে যে কেউ আগে এসে সেট করে ফেলতে পারত)
        if (await isConfigured()) return fail(t('পাসওয়ার্ড আগেই সেট করা আছে', 'Password is already set'), 409);
        const user = await getUser(req);
        if (!user?.email || !adminEmails().includes(user.email)) return fail(t('প্রথমবার সেট করতে admin ইমেইলে লগইন করে আসুন', 'Sign in with an admin email to set it the first time'), 403);
        await setPassword(pw);
        return setAdminCookie(NextResponse.json({ success: true }), req);
    }

    if (action === 'change') {
        if (!(await hasAdminSession(req))) return fail(t('আগে admin হিসেবে লগইন করুন', 'Sign in as admin first'), 401);
        const ok = await checkPassword(String(current || ''));
        if (ok === 'locked') return fail(t('অনেকবার ভুল হয়েছে। ১৫ মিনিট পরে আবার চেষ্টা করুন।', 'Too many wrong attempts. Try again in 15 minutes.'), 429);
        if (!ok) return fail(t('এখনকার পাসওয়ার্ড ভুল', 'Current password is wrong'), 401);
        await setPassword(pw);   // নতুন চাবি: অন্য সব জায়গার admin লগইন বাতিল
        return setAdminCookie(NextResponse.json({ success: true }), req);
    }

    return fail(t('কাজটা বোঝা যায়নি', 'Unknown action'));
}

export async function DELETE() {
    return clearAdminCookie(NextResponse.json({ success: true }));
}
