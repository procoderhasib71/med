import { randomInt } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/serverAuth';
import { turso } from '@/lib/turso';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // O/0, I/1/L বাদ, যাতে পড়তে ভুল না হয়
const TTL_MIN = 15;

// লগইন করা ছাত্র মাছরাঙা বটের সাথে জোড়ার কোড নেয়। বটে লিখবে: /site কোড (বট একই Turso থেকে কোড মেলায়)
export async function POST(req: NextRequest) {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;
    const code = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
    await turso.batch([
        { sql: 'DELETE FROM site_link_codes WHERE uid = ? OR expires_at < ?', args: [user.uid, Date.now()] },
        { sql: 'INSERT INTO site_link_codes (code, uid, email, name, expires_at) VALUES (?, ?, ?, ?, ?)',
          args: [code, user.uid, user.email, user.name, Date.now() + TTL_MIN * 60 * 1000] },
    ], 'write');
    return NextResponse.json({ success: true, code, minutes: TTL_MIN });
}
