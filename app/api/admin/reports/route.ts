import { NextRequest, NextResponse } from 'next/server';
import { fail, requireAdmin } from '@/lib/serverAuth';
import { fixAnswer } from '@/lib/questionAdmin';
import { turso } from '@/lib/turso';

// রিপোর্ট (সাইট আর বট দুই জায়গার) প্রশ্নের এখনকার অবস্থাসহ
export async function GET(req: NextRequest) {
    const admin = await requireAdmin(req);
    if (admin instanceof NextResponse) return admin;
    const r = await turso.execute(`
        SELECT r.*, q.question, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option, q.subject, q.chapter
        FROM site_reports r LEFT JOIN questions q ON q.id = r.question_id
        ORDER BY CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END, r.created_at DESC LIMIT 200`);
    const reports = r.rows.map((x) => ({
        id: String(x.id), questionId: String(x.question_id), question: String(x.question || '(প্রশ্নটা আর নেই)'),
        options: [x.option_a, x.option_b, x.option_c, x.option_d].map((o) => String(o || '')),
        correct_option: String(x.correct_option || ''), subject: String(x.subject || ''), chapter: String(x.chapter || ''),
        reason: String(x.reason || ''), status: String(x.status || 'pending'), via: String(x.via || 'site'),
        aiVerdict: x.ai_verdict ? String(x.ai_verdict) : '', aiOption: x.ai_option ? String(x.ai_option) : '',
        fixedTo: x.fixed_to ? String(x.fixed_to) : '', fixedFrom: x.fixed_from ? String(x.fixed_from) : '',
        reportedByEmail: String(x.email || ''), reportedByName: String(x.name || ''), createdAt: Number(x.created_at) || null,
    }));
    return NextResponse.json({ success: true, reports });
}

export async function POST(req: NextRequest) {
    const admin = await requireAdmin(req);
    if (admin instanceof NextResponse) return admin;
    const { id, action, option } = await req.json().catch(() => ({}));
    if (!id) return fail('id নেই');
    const rep = (await turso.execute({ sql: 'SELECT question_id FROM site_reports WHERE id = ?', args: [String(id)] })).rows[0];
    if (!rep) return fail('রিপোর্ট পাওয়া যায়নি', 404);
    const questionId = String(rep.question_id);
    try {
        if (action === 'delete') {
            await turso.execute({ sql: 'DELETE FROM site_reports WHERE id = ?', args: [String(id)] });
        } else if (action === 'resolve') {
            // এই প্রশ্নের সব রিপোর্ট "ঠিকই আছে", বট থেকে আসা রিপোর্টকারীদের বট জানাবে
            await turso.batch([
                { sql: "UPDATE site_reports SET status = 'resolved', resolved_by = ?, resolved_at = ? WHERE id = ?", args: [admin.email, Date.now(), String(id)] },
                { sql: "UPDATE hermes_mcq_reports SET status = 'kept', notified = 0 WHERE question_id = ? AND status = 'pending'", args: [questionId] },
            ], 'write');
        } else if (action === 'fix') {
            const r = await fixAnswer(questionId, String(option || ''), admin.email, String(id));
            return NextResponse.json({ success: true, old: r.old, now: r.now });
        } else {
            return fail('ভুল action');
        }
        return NextResponse.json({ success: true });
    } catch (e: unknown) {
        return fail(e instanceof Error ? e.message : 'সমস্যা হয়েছে', 500);
    }
}
