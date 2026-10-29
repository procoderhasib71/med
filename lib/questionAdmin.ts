import { turso } from '@/lib/turso';
import { clearServerCache } from '@/app/qbank/actions';

// টেবিলগুলো মাছরাঙা বটের migration (007_mcq.sql) বানায়, একই Turso DB তে।
// মূল questions টেবিলে লেখার আগে সবসময় পুরনো মান hermes_mcq_fixes এ ব্যাকআপ থাকে।

const OPTIONS = ['a', 'b', 'c', 'd'];

async function backupAndSet(questionId: string, field: 'correct_option' | 'explanation', value: string, by: string, reportId = '') {
    const cur = await turso.execute({ sql: `SELECT ${field} AS v FROM questions WHERE id = ?`, args: [questionId] });
    if (cur.rows.length === 0) throw new Error('প্রশ্ন পাওয়া যায়নি');
    const old = String(cur.rows[0].v ?? '');
    const now = new Date().toISOString();
    const setError = field === 'correct_option' ? ", error = 'Fixed by admin'" : '';
    await turso.batch([
        {
            sql: 'INSERT INTO hermes_mcq_fixes (question_id, field, old_value, new_value, fixed_by, report_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            args: [questionId, field, old, value, by, reportId, now],
        },
        { sql: `UPDATE questions SET ${field} = ?${setError} WHERE id = ?`, args: [value, questionId] },
    ], 'write');
    await clearServerCache();
    return old;
}

export async function fixAnswer(questionId: string, option: string, by: string, reportId = '') {
    const opt = option.trim().toLowerCase();
    if (!OPTIONS.includes(opt)) throw new Error('উত্তর a/b/c/d হতে হবে');
    const old = await backupAndSet(questionId, 'correct_option', opt, by, reportId);
    // এই প্রশ্নের সব রিপোর্ট সমাধান; বট থেকে আসা রিপোর্টকারীদের বট প্রতি মিনিটে দেখে জানায়
    await turso.batch([
        { sql: "UPDATE site_reports SET status = 'resolved', fixed_from = ?, fixed_to = ?, resolved_by = ?, resolved_at = ? WHERE question_id = ? AND status = 'pending'",
          args: [old, opt, by, Date.now(), questionId] },
        { sql: "UPDATE hermes_mcq_reports SET status = 'fixed', fixed_to = ?, notified = 0 WHERE question_id = ? AND status = 'pending'",
          args: [opt, questionId] },
    ], 'write');
    return { old, now: opt };
}

export async function listExplanationDrafts(limit = 30) {
    const r = await turso.execute({
        sql: `SELECT e.question_id, e.text, e.created_at, q.subject, q.chapter, q.question,
                     q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option
              FROM hermes_mcq_explanations e JOIN questions q ON q.id = e.question_id
              WHERE e.status = 'pending' ORDER BY e.created_at LIMIT ?`,
        args: [limit],
    });
    const count = await turso.execute("SELECT COUNT(*) AS n FROM hermes_mcq_explanations WHERE status = 'pending'");
    return { total: Number(count.rows[0]?.n || 0), items: r.rows.map((row) => ({ ...row })) };
}

/** approve: খসড়া (বা admin এর বদলানো লেখা) questions.explanation এ যায়। reject: কোথাও যায় না। */
export async function reviewExplanation(questionId: string, action: 'approve' | 'reject', by: string, text?: string) {
    const now = new Date().toISOString();
    if (action === 'approve') {
        const draft = await turso.execute({ sql: "SELECT text FROM hermes_mcq_explanations WHERE question_id = ?", args: [questionId] });
        const finalText = (text ?? String(draft.rows[0]?.text ?? '')).trim();
        if (!finalText) throw new Error('ব্যাখ্যা ফাঁকা');
        await backupAndSet(questionId, 'explanation', finalText, by);
        await turso.execute({
            sql: "UPDATE hermes_mcq_explanations SET status = 'approved', text = ?, reviewed_by = ?, reviewed_at = ? WHERE question_id = ?",
            args: [finalText, by, now, questionId],
        });
    } else {
        await turso.execute({
            sql: "UPDATE hermes_mcq_explanations SET status = 'rejected', reviewed_by = ?, reviewed_at = ? WHERE question_id = ?",
            args: [by, now, questionId],
        });
    }
}
