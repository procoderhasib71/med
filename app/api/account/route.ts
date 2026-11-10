import { NextRequest, NextResponse } from 'next/server';
import { botLinks, getAccount, isComplete, updateAccount } from '@/lib/account';
import { corsPreflight, withCors } from '@/lib/cors';
import { requireUser } from '@/lib/serverAuth';
import { reqT } from '@/lib/serverLang';
import { adminAuth } from '@/lib/firebaseAdmin';
import { deleteAccount } from '@/lib/deleteAccount';

// এক প্রোফাইল: AdMCQ নিজে আর Pomodoro/Money (অন্য ঠিকানা থেকে) পড়ে, লেখে আর মোছে।
export const OPTIONS = corsPreflight;

const reply = async (uid: string) => {
    const [account, bots] = await Promise.all([getAccount(uid), botLinks(uid)]);
    return NextResponse.json({
        success: true, account, botLinks: bots,
        complete: { money: isComplete(account, 'money'), full: isComplete(account, 'full') },
    });
};

export async function GET(req: NextRequest) {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return withCors(user);
    return withCors(await reply(user.uid));
}

// body: { name?, gender?, studyLevel?, institution?, hscBatch? }
export async function PATCH(req: NextRequest) {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return withCors(user);
    const body = await req.json().catch(() => ({}));
    const err = await updateAccount(user.uid, body && typeof body === 'object' ? body : {});
    if (err) return withCors(NextResponse.json({ success: false, error: reqT(req)(...err) }, { status: 400 }));
    return withCors(await reply(user.uid));
}

// অ্যাকাউন্ট পুরো মোছা (AdMCQ, Pomodoro, Money সব)। অন্য কেউ খোলা ফোন হাতে পেয়ে যেন মুছতে না পারে,
// তাই গত ১০ মিনিটের মধ্যে লগইন (বা পাসওয়ার্ড দিয়ে আবার যাচাই) লাগে: না হলে 401 + recentLogin: true।
const RECENT_LOGIN_SECONDS = 10 * 60;

export async function DELETE(req: NextRequest) {
    const header = req.headers.get('authorization') || '';
    if (!header.startsWith('Bearer ')) return withCors(NextResponse.json({ success: false, error: 'Not signed in' }, { status: 401 }));
    let uid: string;
    let authTime: number;
    try {
        const t = await adminAuth.verifyIdToken(header.slice(7), true);
        uid = t.uid;
        authTime = Number(t.auth_time) || 0;
    } catch {
        return withCors(NextResponse.json({ success: false, error: 'Not signed in' }, { status: 401 }));
    }
    if (Date.now() / 1000 - authTime > RECENT_LOGIN_SECONDS) {
        return withCors(NextResponse.json({ success: false, recentLogin: true, error: 'Please sign in again to delete your account.' }, { status: 401 }));
    }
    try {
        const result = await deleteAccount(uid);
        return withCors(NextResponse.json({ success: true, ...result }));
    } catch (e) {
        console.error('Account delete failed', uid, e);
        return withCors(NextResponse.json({ success: false, error: 'Could not delete the account. Please try again.' }, { status: 500 }));
    }
}
