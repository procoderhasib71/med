import { NextRequest, NextResponse } from 'next/server';
import { COURSES } from '@/lib/courses';
import { requireUser } from '@/lib/serverAuth';
import { turso } from '@/lib/turso';

// প্রোফাইল: নাম, ফোন/ইমেইল, চার কোর্সের হিসাব আর কোনগুলো নেওয়া, বটের সাথে যুক্ত কিনা
export async function GET(req: NextRequest) {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;
    const [u, scores, bot, enrolled] = await turso.batch([
        { sql: 'SELECT name, email, phone, created_at FROM site_users WHERE uid = ?', args: [user.uid] },
        { sql: 'SELECT platform, attempted, correct, score FROM site_scores WHERE uid = ?', args: [user.uid] },
        { sql: 'SELECT 1 FROM hermes_site_links WHERE site_uid = ? LIMIT 1', args: [user.uid] },
        { sql: 'SELECT platform, created_at FROM site_enrollments WHERE uid = ?', args: [user.uid] },
    ], 'read');
    const row = u.rows[0] || {};
    const by = Object.fromEntries(scores.rows.map((s) => [String(s.platform), {
        attempted: Number(s.attempted) || 0, correct: Number(s.correct) || 0, score: Number(s.score) || 0 }]));
    const since = Object.fromEntries(enrolled.rows.map((e) => [String(e.platform), String(e.created_at)]));
    return NextResponse.json({
        success: true,
        profile: { uid: user.uid, name: String(row.name || user.name || ''), email: String(row.email || user.email || ''),
                   phone: String(row.phone || user.phone || ''), since: String(row.created_at || ''), botLinked: bot.rows.length > 0 },
        platforms: COURSES.map((c) => ({ id: c.id, name: c.name, enrolled: c.id in since, enrolledAt: since[c.id] || '',
                                         ...(by[c.id] || { attempted: 0, correct: 0, score: 0 }) })),
    });
}
