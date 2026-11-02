import { NextRequest, NextResponse } from 'next/server';
import { getAccount, isComplete, updateAccount } from '@/lib/account';
import { requireUser } from '@/lib/serverAuth';
import { reqT } from '@/lib/serverLang';

// এক প্রোফাইল: AdMCQ নিজে আর Pomodoro/Money (অন্য ঠিকানা থেকে) পড়ে আর লেখে।
// অন্য ঠিকানা থেকে শুধু Authorization: Bearer <Firebase টোকেন> চলে; cookie পাঠানো হয় না (credentials ছাড়া CORS),
// তাই যেকোনো origin খোলা রাখলেও অন্য কেউ কারো প্রোফাইল পড়তে পারে না।
const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
};
const withCors = (res: NextResponse) => {
    Object.entries(CORS).forEach(([k, v]) => res.headers.set(k, v));
    return res;
};

export function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return withCors(user);
    const account = await getAccount(user.uid);
    return withCors(NextResponse.json({
        success: true, account,
        complete: { money: isComplete(account, 'money'), full: isComplete(account, 'full') },
    }));
}

// body: { name?, gender?, studyLevel?, institution?, hscBatch? }
export async function PATCH(req: NextRequest) {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return withCors(user);
    const body = await req.json().catch(() => ({}));
    const err = await updateAccount(user.uid, body && typeof body === 'object' ? body : {});
    if (err) return withCors(NextResponse.json({ success: false, error: reqT(req)(...err) }, { status: 400 }));
    const account = await getAccount(user.uid);
    return withCors(NextResponse.json({
        success: true, account,
        complete: { money: isComplete(account, 'money'), full: isComplete(account, 'full') },
    }));
}
