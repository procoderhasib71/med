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

// ---------- AI অডিটে ধরা ভুল (error কলাম) রিভিউ ----------
// explain স্ক্রিপ্ট error কলামে লেখে "Error: ..." (প্রশ্নে ভুল, ব্যাখ্যা NULL) বা "pre-explain error: ..." (আগের ব্যাখ্যায় ভুল),
// আর AI এর মতে সঠিক উত্তর/ব্যাখ্যা রাখে new_correct_option / new_explanation এ। রিভিউ হলে error বদলায়, তাই তালিকা থেকে সরে যায়।

const AI_PENDING = "(error LIKE 'Error:%' OR error LIKE 'pre-explain error:%')";
const NEW_OPT = "lower(trim(coalesce(new_correct_option, '')))";
const AI_TYPE = `CASE WHEN new_correct_option IS NULL THEN 'unclear'
    WHEN ${NEW_OPT} = 'none' THEN 'none'
    WHEN ${NEW_OPT} LIKE '%,%' THEN 'multiple'
    WHEN ${NEW_OPT} <> lower(trim(coalesce(correct_option, ''))) THEN 'answer'
    ELSE 'explanation' END`;
export const AI_TYPES = ['explanation', 'answer', 'multiple', 'none', 'unclear'] as const;
export type AiType = (typeof AI_TYPES)[number];

const EDITABLE = ['question', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_option', 'explanation'] as const;
type Editable = (typeof EDITABLE)[number];

export async function listAiReview(platform: string, opts: { subject?: string; type?: string; offset?: number; limit?: number }) {
    const where = [`platform = ?`, AI_PENDING];
    const args: (string | number)[] = [platform];
    if (opts.subject) { where.push('subject = ?'); args.push(opts.subject); }
    if (opts.type && (AI_TYPES as readonly string[]).includes(opts.type)) { where.push(`${AI_TYPE} = ?`); args.push(opts.type); }
    const limit = Math.min(Math.max(Number(opts.limit) || 20, 1), 50);
    const offset = Math.max(Number(opts.offset) || 0, 0);
    const [rows, counts] = await Promise.all([
        turso.execute({
            sql: `SELECT id, subject, chapter, topic, question, option_a, option_b, option_c, option_d, correct_option,
                         explanation, error, new_correct_option, new_explanation, ${AI_TYPE} AS ai_type
                  FROM questions WHERE ${where.join(' AND ')} ORDER BY subject, id LIMIT ? OFFSET ?`,
            args: [...args, limit, offset],
        }),
        turso.execute({
            sql: `SELECT subject, ${AI_TYPE} AS ai_type, COUNT(*) AS n FROM questions WHERE platform = ? AND ${AI_PENDING} GROUP BY 1, 2`,
            args: [platform],
        }),
    ]);
    return {
        items: rows.rows.map((r) => ({ ...r })),
        counts: counts.rows.map((r) => ({ subject: String(r.subject), type: String(r.ai_type), n: Number(r.n) })),
    };
}

/** বদলানো প্রতিটা ঘরের পুরনো মান hermes_mcq_fixes এ রেখে একসাথে আপডেট; error এ রিভিউয়ের ফল লেখে */
async function applyFields(questionId: string, edits: Partial<Record<Editable, string>>, status: string, by: string) {
    const cur = await turso.execute({ sql: `SELECT ${EDITABLE.join(', ')}, error FROM questions WHERE id = ?`, args: [questionId] });
    if (cur.rows.length === 0) throw new Error('প্রশ্ন পাওয়া যায়নি');
    const row = cur.rows[0];
    const now = new Date().toISOString();
    const changed = EDITABLE.filter((f) => edits[f] !== undefined && String(edits[f]) !== String(row[f] ?? ''));
    const stmts = [...changed, 'error' as const].map((f) => ({
        sql: 'INSERT INTO hermes_mcq_fixes (question_id, field, old_value, new_value, fixed_by, report_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        args: [questionId, f, String(row[f] ?? ''), f === 'error' ? status : String(edits[f]), by, 'ai-review', now],
    }));
    const sets = [...changed.map((f) => `${f} = ?`), 'error = ?'];
    stmts.push({ sql: `UPDATE questions SET ${sets.join(', ')} WHERE id = ?`, args: [...changed.map((f) => String(edits[f])), status, questionId] });
    await turso.batch(stmts, 'write');
    await clearServerCache();
    return changed;
}

/**
 * apply: AI এর উত্তর (একটা a-d হলে) আর ব্যাখ্যা বসায়। keep: কিছু বদলায় না, AI ভুল ধরা হয়।
 * save: admin নিজে যা লিখেছে (প্রশ্ন/অপশন/উত্তর/ব্যাখ্যা) সেটাই বসে।
 */
export async function reviewAiFix(questionId: string, action: 'apply' | 'keep' | 'save', by: string, edits: Partial<Record<Editable, string>> = {}) {
    // status গুলো বটও চেনে (Hermes2/tools/mcq_meta.py), তাই রিভিউয়ের পর প্রশ্নটা দুই জায়গাতেই আবার দেখায়
    if (action === 'keep') return applyFields(questionId, {}, 'Verified OK', by);

    if (action === 'apply') {
        const r = await turso.execute({ sql: 'SELECT new_correct_option, new_explanation FROM questions WHERE id = ?', args: [questionId] });
        if (r.rows.length === 0) throw new Error('প্রশ্ন পাওয়া যায়নি');
        const opt = String(r.rows[0].new_correct_option ?? '').trim().toLowerCase();
        const text = (edits.explanation ?? String(r.rows[0].new_explanation ?? '')).trim();
        if (!OPTIONS.includes(opt)) throw new Error('AI এর উত্তর একটা অপশন না, নিজে ঠিক করে সেভ করুন');
        if (!text) throw new Error('ব্যাখ্যা ফাঁকা');
        return applyFields(questionId, { correct_option: opt, explanation: text }, 'Fixed by admin', by);
    }

    const clean: Partial<Record<Editable, string>> = {};
    for (const f of EDITABLE) if (typeof edits[f] === 'string') clean[f] = edits[f]!.trim();
    if (clean.correct_option !== undefined && !OPTIONS.includes(clean.correct_option.toLowerCase())) throw new Error('উত্তর a/b/c/d হতে হবে');
    if (clean.correct_option) clean.correct_option = clean.correct_option.toLowerCase();
    return applyFields(questionId, clean, 'Fixed by admin', by);
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
