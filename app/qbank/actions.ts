'use server';

import { turso } from '@/lib/turso';

export type Question = {
    id: string; 
    subject: string; 
    chapter: string; 
    topic: string; 
    question: string;
    option_a: string; 
    option_b: string; 
    option_c: string; 
    option_d: string;
    correct_option: string; 
    explanation: string; 
    tag: string; 
    source: string;
};

export async function fetchFilteredQuestions(page: number, filters: any) {
    let sql = 'SELECT * FROM questions WHERE 1=1';
    let args: string[] = [];

    // সাধারণ ফিল্টার
    if (filters.subject) { 
        sql += ' AND subject = ?'; 
        args.push(filters.subject); 
    }
    if (filters.chapter) { 
        sql += ' AND chapter = ?'; 
        args.push(filters.chapter); 
    }
    if (filters.topic) { 
        sql += ' AND topic = ?'; 
        args.push(filters.topic); 
    }
    if (filters.source) { 
        sql += ' AND source = ?'; 
        args.push(filters.source); 
    }

    // অ্যাডভান্সড ফিল্টার: ভার্সিটি (tag অথবা source-এ আংশিক ম্যাচ)
    if (filters.varsity) {
        sql += ' AND (tag LIKE ? OR source LIKE ?)';
        args.push(`%${filters.varsity}%`, `%${filters.varsity}%`);
    }

    // অ্যাডভান্সড ফিল্টার: শিক্ষাবর্ষ / সাল (যেমন: '22-23', '18-19')
    if (filters.year) {
        sql += ' AND (tag LIKE ? OR source LIKE ?)';
        args.push(`%${filters.year}%`, `%${filters.year}%`);
    }

    const limit = 10;
    const offset = (page - 1) * limit;

    sql += ` ORDER BY id ASC LIMIT ${limit} OFFSET ${offset}`;

    try {
        const result = await turso.execute({ sql, args });

        return result.rows.map((row) => ({
            id: String(row.id || ''),
            subject: String(row.subject || ''),
            chapter: String(row.chapter || ''),
            topic: String(row.topic || ''),
            question: String(row.question || ''),
            option_a: String(row.option_a || ''),
            option_b: String(row.option_b || ''),
            option_c: String(row.option_c || ''),
            option_d: String(row.option_d || ''),
            correct_option: String(row.correct_option || ''),
            explanation: String(row.explanation || ''),
            tag: String(row.tag || ''),
            source: String(row.source || ''),
        }));
    } catch (e) {
        console.error("Fetch error:", e);
        return [];
    }
}

// ==========================================
// নির্দিষ্ট কিছু ID দিয়ে প্রশ্ন আনার জন্য (mistakes ও bookmarks পেজে ব্যবহার হয়)
// ==========================================
export async function fetchQuestionsByIds(ids: string[]) {
    if (!ids || ids.length === 0) return [];

    const placeholders = ids.map(() => '?').join(',');
    const sql = `SELECT * FROM questions WHERE id IN (${placeholders})`;

    try {
        const result = await turso.execute({ sql, args: ids });

        return result.rows.map((row) => ({
            id: String(row.id || ''),
            subject: String(row.subject || ''),
            chapter: String(row.chapter || ''),
            topic: String(row.topic || ''),
            question: String(row.question || ''),
            option_a: String(row.option_a || ''),
            option_b: String(row.option_b || ''),
            option_c: String(row.option_c || ''),
            option_d: String(row.option_d || ''),
            correct_option: String(row.correct_option || ''),
            explanation: String(row.explanation || ''),
            tag: String(row.tag || ''),
            source: String(row.source || ''),
        }));
    } catch (e) {
        console.error("Fetch by ids error:", e);
        return [];
    }
}