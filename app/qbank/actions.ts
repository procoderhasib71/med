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

// ==========================================
// 🚀 SERVER-SIDE IN-MEMORY SHARED CACHE
// ==========================================
const serverQuestionCache = new Map<string, { data: Question[]; timestamp: number }>();
const serverSingleIdCache = new Map<string, Question>();

// Cache 24 hours por expire hobe (milliseconds)
const CACHE_TTL = 1000 * 60 * 60;   // ১ ঘণ্টা, যাতে বট থেকে ঠিক করা উত্তরও তাড়াতাড়ি দেখায়

export async function fetchFilteredQuestions(page: number, filters: any): Promise<Question[]> {
    const cacheKey = `filter_${filters.subject || ''}_${filters.chapter || ''}_${filters.topic || ''}_${filters.source || ''}_${filters.varsity || ''}_${filters.year || ''}_p${page}`;

    const cachedEntry = serverQuestionCache.get(cacheKey);
    const now = Date.now();

    if (cachedEntry && (now - cachedEntry.timestamp < CACHE_TTL)) {
        return cachedEntry.data;
    }

    let sql = 'SELECT * FROM questions WHERE 1=1';
    let args: string[] = [];

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

    if (filters.varsity) {
        sql += ' AND (tag LIKE ? OR source LIKE ?)';
        args.push(`%${filters.varsity}%`, `%${filters.varsity}%`);
    }

    if (filters.year) {
        sql += ' AND (tag LIKE ? OR source LIKE ?)';
        args.push(`%${filters.year}%`, `%${filters.year}%`);
    }

    const limit = 10;
    const offset = (page - 1) * limit;

    sql += ` ORDER BY id ASC LIMIT ${limit} OFFSET ${offset}`;

    try {
        const result = await turso.execute({ sql, args });

        const questions: Question[] = result.rows.map((row) => ({
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

        if (questions.length > 0) {
            serverQuestionCache.set(cacheKey, {
                data: questions,
                timestamp: now,
            });

            questions.forEach((q) => {
                serverSingleIdCache.set(q.id, q);
            });
        }

        return questions;
    } catch (e) {
        console.error("Fetch error:", e);
        return [];
    }
}

// ==========================================
// 🎯 SPECIFIC IDS WITH CACHE (Bookmarks / Mistakes)
// ==========================================
export async function fetchQuestionsByIds(ids: string[]): Promise<Question[]> {
    if (!ids || ids.length === 0) return [];

    const cleanIds = Array.from(new Set(ids.map(String)));
    const resultMap = new Map<string, Question>();
    const missingIds: string[] = [];

    // ১. সার্ভার মেমরি ক্যাশ থেকে চেক
    cleanIds.forEach((id) => {
        const cached = serverSingleIdCache.get(id);
        if (cached) {
            resultMap.set(id, cached);
        } else {
            missingIds.push(id);
        }
    });

    // ২. মিসিং আইডিগুলো চাঙ্ক আকারে Turso থেকে ফেচ করা (SQLite সীমা সুরক্ষা)
    if (missingIds.length > 0) {
        const CHUNK_SIZE = 50;
        for (let i = 0; i < missingIds.length; i += CHUNK_SIZE) {
            const chunk = missingIds.slice(i, i + CHUNK_SIZE);
            const placeholders = chunk.map(() => '?').join(',');
            const sql = `SELECT * FROM questions WHERE id IN (${placeholders})`;

            try {
                const res = await turso.execute({ sql, args: chunk });
                res.rows.forEach((row) => {
                    const q: Question = {
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
                    };
                    serverSingleIdCache.set(q.id, q);
                    resultMap.set(q.id, q);
                });
            } catch (err) {
                console.error("Fetch questions by IDs chunk error:", err);
            }
        }
    }

    // ৩. মূল অ্যারের ক্রম ঠিক রেখে রিটার্ন করা
    return cleanIds.map(id => resultMap.get(id)).filter(Boolean) as Question[];
}

// ==========================================
// 🧹 MANUAL SERVER CACHE PURGE
// ==========================================
export async function clearServerCache() {
    serverQuestionCache.clear();
    serverSingleIdCache.clear();
    return { success: true, message: 'Server shared cache cleared successfully!' };
}