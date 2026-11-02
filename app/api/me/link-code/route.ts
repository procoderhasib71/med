import { randomInt } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { asBotApp } from '@/lib/account';
import { corsPreflight, withCors } from '@/lib/cors';
import { requireUser } from '@/lib/serverAuth';
import { turso } from '@/lib/turso';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // O/0, I/1/L বাদ, যাতে পড়তে ভুল না হয়
const TTL_MIN = 15;

export const OPTIONS = corsPreflight;

// লগইন করা ছাত্র মাছরাঙা বটের সাথে জোড়ার কোড নেয়। body.app: কোন অ্যাপ (medical = AdMCQ, money, pomodoro), প্রতিটা আলাদা যুক্ত হয়।
// t.me/বট?start=কোড খুললে বট নিজেই যুক্ত করে; হাতে লিখলে /site কোড (বট একই Turso থেকে কোড মেলায়)
export async function POST(req: NextRequest) {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return withCors(user);
    const app = asBotApp((await req.json().catch(() => ({})))?.app);
    const code = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
    await turso.batch([
        { sql: 'DELETE FROM site_link_codes WHERE uid = ? OR expires_at < ?', args: [user.uid, Date.now()] },
        { sql: 'INSERT INTO site_link_codes (code, uid, email, name, expires_at, app) VALUES (?, ?, ?, ?, ?, ?)',
          args: [code, user.uid, user.email, user.name, Date.now() + TTL_MIN * 60 * 1000, app] },
    ], 'write');
    return withCors(NextResponse.json({ success: true, code, minutes: TTL_MIN }));
}
