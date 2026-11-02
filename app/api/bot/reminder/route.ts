import { NextRequest, NextResponse } from 'next/server';
import { botMasterId } from '@/lib/account';
import { corsPreflight, withCors } from '@/lib/cors';
import { requireUser } from '@/lib/serverAuth';
import { turso } from '@/lib/turso';

// Pomodoro টাস্কের রিমাইন্ডার: নির্দিষ্ট সময়ে মাছরাঙা বট Telegram এ মনে করায় (Pomodoro অ্যাপ বটে যুক্ত থাকলে)।
// বটের রিমাইন্ডার টেবিলে style = 'pomotask', ref = টাস্কের id; একই টাস্কের আগেরটা মুছে নতুনটা বসাই।
// body: { ref, title, time: "HH:MM" | null (null = বাতিল), day: 'today' | 'tomorrow', repeat: '' | 'daily' | 'weekly' | 'satthu' }
const BD_OFFSET = 6 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
const RULES: Record<string, string> = { '': '', daily: 'daily', weekly: 'weekly', satthu: 'days:SAT,SUN,MON,TUE,WED,THU' };

const bdString = (ms: number, sec = false) => new Date(ms + BD_OFFSET).toISOString().slice(0, sec ? 19 : 16).replace('T', ' ');

export const OPTIONS = corsPreflight;

export async function POST(req: NextRequest) {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return withCors(user);
    const mid = await botMasterId(user.uid, 'pomodoro');
    if (!mid) return withCors(NextResponse.json({ success: true, linked: false }));

    const body = await req.json().catch(() => ({}));
    const ref = String(body?.ref || '').slice(0, 40);
    if (!ref) return withCors(NextResponse.json({ success: false, error: 'ref missing' }, { status: 400 }));
    const stmts = [{ sql: "DELETE FROM hermes_reminders WHERE master_id = ? AND style = 'pomotask' AND ref = ?", args: [mid, ref] }];

    const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(body?.time || ''));
    const rule = RULES[String(body?.repeat || '')] ?? '';
    if (m) {
        // বাংলাদেশের আজকের (বা কালকের) তারিখে সেই সময়; পেরিয়ে গেলে বা নিয়মের দিন না হলে পরের দিনে সরাই
        const today = new Date(Date.now() + BD_OFFSET).toISOString().slice(0, 10);
        let at = Date.parse(`${today}T${m[1]}:${m[2]}:00+06:00`) + (body?.day === 'tomorrow' ? DAY : 0);
        const okDay = (ms: number) => rule !== RULES.satthu || new Date(ms + BD_OFFSET).getUTCDay() !== 5;   // শুক্রবার বাদ
        for (let i = 0; i < 8 && (at <= Date.now() || !okDay(at)); i++) at += DAY;
        const title = String(body?.title || '').trim().slice(0, 200) || 'Pomodoro task';
        stmts.push({
            sql: "INSERT INTO hermes_reminders (master_id, platform, channel_id, task, trigger_time, repeat_rule, status, created_at, style, ref) VALUES (?, NULL, NULL, ?, ?, ?, 'pending', ?, 'pomotask', ?)",
            args: [mid, `📝 এখন সময়: ${title}\n🍅 Pomodoro খুলে শুরু করো!`, bdString(at), rule, bdString(Date.now(), true), ref],
        });
    }
    await turso.batch(stmts, 'write');
    return withCors(NextResponse.json({ success: true, linked: true }));
}
