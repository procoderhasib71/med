import { NextResponse } from 'next/server';

// Pomodoro/Money (অন্য ঠিকানা) থেকে ডাকা API গুলোর জন্য। শুধু Authorization: Bearer <Firebase টোকেন> চলে;
// cookie পাঠানো হয় না (credentials ছাড়া CORS), তাই যেকোনো origin খোলা রাখলেও অন্য কেউ কারো ডাটা পায় না।
export const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
};

export const withCors = (res: NextResponse) => {
    Object.entries(CORS).forEach(([k, v]) => res.headers.set(k, v));
    return res;
};

export const corsPreflight = () => new NextResponse(null, { status: 204, headers: CORS });
