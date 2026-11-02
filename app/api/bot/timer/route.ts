import { NextRequest, NextResponse } from 'next/server';
import { botMasterId } from '@/lib/account';
import { corsPreflight, withCors } from '@/lib/cors';
import { requireUser } from '@/lib/serverAuth';
import { turso } from '@/lib/turso';

// Pomodoro টাইমার শেষ হলে মাছরাঙা বট Telegram এ জানায় (অ্যাপ বন্ধ থাকলেও)।
// বটের রিমাইন্ডার টেবিলে style = 'pomodoro' দিয়ে রাখি; বটের scheduler প্রতি মিনিটে পাঠায়, বটের প্ল্যান লাগে না।
// body: { endAt: মিলিসেকেন্ড | null, mode: 'pomodoro' | 'shortBreak' | 'longBreak' }. endAt null মানে বাতিল (পজ, রিসেট, অ্যাপেই শেষ)
const MAX_AHEAD = 3 * 60 * 60 * 1000;
const BD_OFFSET = 6 * 60 * 60 * 1000;
const TEXT: Record<string, string> = {
    pomodoro: '🍅 ফোকাস সেশন শেষ! এবার একটু বিরতি নাও।',
    shortBreak: '☕ বিরতি শেষ, চলো আবার পড়া শুরু করি!',
    longBreak: '🌿 লম্বা বিরতি শেষ, আবার শুরু করার সময়!',
};

export const OPTIONS = corsPreflight;

export async function POST(req: NextRequest) {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return withCors(user);
    const mid = await botMasterId(user.uid);
    if (!mid) return withCors(NextResponse.json({ success: true, linked: false }));

    const body = await req.json().catch(() => ({}));
    const endAt = Number(body?.endAt) || 0;
    // আগের টাইমারের সারি মুছে ফেলি (পাঠানো হোক বা না হোক), যাতে প্রতি সেশনে টেবিলে সারি না জমে
    const stmts = [{ sql: "DELETE FROM hermes_reminders WHERE master_id = ? AND style = 'pomodoro'", args: [mid] }];
    if (endAt > Date.now() && endAt < Date.now() + MAX_AHEAD) {
        // রিমাইন্ডারের সময় মিনিট পর্যন্ত (বাংলাদেশ সময়); আগে না গিয়ে পরের মিনিটে যায়, অ্যাপ খোলা থাকলে অ্যাপ নিজে বাজিয়ে এটা বাতিল করে দেয়
        const when = new Date(Math.ceil(endAt / 60000) * 60000 + BD_OFFSET).toISOString().slice(0, 16).replace('T', ' ');
        const now = new Date(Date.now() + BD_OFFSET).toISOString().slice(0, 19).replace('T', ' ');
        stmts.push({
            sql: "INSERT INTO hermes_reminders (master_id, platform, channel_id, task, trigger_time, repeat_rule, status, created_at, style) VALUES (?, NULL, NULL, ?, ?, '', 'pending', ?, 'pomodoro')",
            args: [mid, TEXT[body?.mode] || TEXT.pomodoro, when, now],
        });
    }
    await turso.batch(stmts, 'write');
    return withCors(NextResponse.json({ success: true, linked: true }));
}
