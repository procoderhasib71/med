import { NextRequest, NextResponse } from 'next/server';
import { botMasterId } from '@/lib/account';
import { corsPreflight, withCors } from '@/lib/cors';
import { requireUser } from '@/lib/serverAuth';
import { turso } from '@/lib/turso';

// Pomodoro অ্যাপ আর মাছরাঙা বট একই টাইমার দেখে (pomodoro_timers, বটের migration 016)। Pomodoro অ্যাপ বটে যুক্ত থাকলেই চলে।
// body.action:
//   'push' (না দিলেও): অ্যাপের টাইমার বদলেছে → সারি রাখি, আর শেষ হলে Telegram এ জানানোর রিমাইন্ডার (style 'pomodoro') নতুন করে বসাই।
//       { endAt: মিলিসেকেন্ড | null, mode, timeLeft, initial (সেকেন্ড), taskId, taskTitle, lengths: { focus, short, long } (মিনিট) }
//       পুরনো অ্যাপ শুধু { endAt, mode } পাঠায়, তখন সারিতে হাত দিই না
//   'pull': বটের করা বদলসহ এখনকার টাইমার, আর বটের চালানো যে সেশন অ্যাপ এখনো হিসাবে তোলেনি (তুলে দিলাম বলে synced = 1)
const MAX_AHEAD = (3 * 60 + 5) * 60 * 1000;   // টাইমার সর্বোচ্চ ১৮০ মিনিট
const BD_OFFSET = 6 * 60 * 60 * 1000;
const MODES = ['pomodoro', 'shortBreak', 'longBreak'];
const TEXT: Record<string, string> = {
    pomodoro: '🍅 ফোকাস সেশন শেষ! এবার একটু বিরতি নাও।',
    shortBreak: '☕ বিরতি শেষ, চলো আবার পড়া শুরু করি!',
    longBreak: '🌿 লম্বা বিরতি শেষ, আবার শুরু করার সময়!',
};
const int = (v: unknown, min: number, max: number, fallback: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};
// libsql এর সারি থেকে সাধারণ JSON
const plain = (r: Record<string, unknown>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'bigint' ? Number(v) : v]));
const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

export const OPTIONS = corsPreflight;

export async function POST(req: NextRequest) {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return withCors(user);
    const mid = await botMasterId(user.uid, 'pomodoro');
    if (!mid) return withCors(NextResponse.json({ success: true, linked: false }));

    const body = await req.json().catch(() => ({}));
    if (body?.action === 'pull') {
        const [timer, sessions] = await turso.batch([
            { sql: 'SELECT mode, end_at, time_left, initial, task_id, task_title, source, updated_at FROM pomodoro_timers WHERE site_uid = ?', args: [user.uid] },
            { sql: 'UPDATE pomodoro_bot_sessions SET synced = 1 WHERE site_uid = ? AND synced = 0 RETURNING id, minutes, mode, task_id, task_title, completed, ended_at', args: [user.uid] },
        ], 'write');
        return withCors(NextResponse.json({ success: true, linked: true, timer: timer.rows[0] ? plain(timer.rows[0]) : null, sessions: sessions.rows.map(plain) }));
    }

    const mode = MODES.includes(body?.mode) ? body.mode : 'pomodoro';
    const endAt = Number(body?.endAt) || 0;
    const running = endAt > Date.now() && endAt < Date.now() + MAX_AHEAD;
    // আগের টাইমারের রিমাইন্ডার (অ্যাপের বা বটের) মুছে ফেলি, যাতে একটার বেশি না থাকে
    const stmts = [{ sql: "DELETE FROM hermes_reminders WHERE master_id = ? AND style IN ('pomodoro', 'pomobot')", args: [mid] as (string | number | null)[] }];
    if (running) {
        // রিমাইন্ডারের সময় মিনিট পর্যন্ত (বাংলাদেশ সময়); আগে না গিয়ে পরের মিনিটে যায়, অ্যাপ খোলা থাকলে অ্যাপ নিজে বাজিয়ে এটা বাতিল করে দেয়
        const when = new Date(Math.ceil(endAt / 60000) * 60000 + BD_OFFSET).toISOString().slice(0, 16).replace('T', ' ');
        const now = new Date(Date.now() + BD_OFFSET).toISOString().slice(0, 19).replace('T', ' ');
        stmts.push({
            sql: "INSERT INTO hermes_reminders (master_id, platform, channel_id, task, trigger_time, repeat_rule, status, created_at, style, ref) VALUES (?, NULL, NULL, ?, ?, '', 'pending', ?, 'pomodoro', ?)",
            args: [mid, TEXT[mode], when, now, mode],
        });
    }
    const updatedAt = Date.now();
    if (body?.timeLeft !== undefined) {
        const initial = int(body.initial, 60, 3 * 3600, 1500);
        const len = body.lengths || {};
        stmts.push({
            sql: `INSERT INTO pomodoro_timers (site_uid, mode, end_at, time_left, initial, task_id, task_title, len_focus, len_short, len_long, source, updated_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'app', ?)
                  ON CONFLICT(site_uid) DO UPDATE SET mode = excluded.mode, end_at = excluded.end_at, time_left = excluded.time_left, initial = excluded.initial,
                    task_id = excluded.task_id, task_title = excluded.task_title, len_focus = excluded.len_focus, len_short = excluded.len_short,
                    len_long = excluded.len_long, source = 'app', updated_at = excluded.updated_at`,
            args: [user.uid, mode, running ? endAt : null, int(body.timeLeft, 0, initial, initial), initial, text(body.taskId, 64), text(body.taskTitle, 200),
                int(len.focus, 1, 180, 25), int(len.short, 1, 60, 5), int(len.long, 1, 90, 15), updatedAt],
        });
    }
    await turso.batch(stmts, 'write');
    return withCors(NextResponse.json({ success: true, linked: true, updatedAt }));
}
