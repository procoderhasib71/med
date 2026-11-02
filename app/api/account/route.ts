import { NextRequest, NextResponse } from 'next/server';
import { botLinks, getAccount, isComplete, updateAccount } from '@/lib/account';
import { corsPreflight, withCors } from '@/lib/cors';
import { requireUser } from '@/lib/serverAuth';
import { reqT } from '@/lib/serverLang';

// এক প্রোফাইল: AdMCQ নিজে আর Pomodoro/Money (অন্য ঠিকানা থেকে) পড়ে আর লেখে।
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
