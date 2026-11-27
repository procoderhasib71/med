import { NextRequest, NextResponse } from 'next/server';
import { questionTable } from '@/lib/questionTable';
import type { Platform } from '@/lib/platform';
import { platformOf } from '@/lib/serverAuth';
import { turso } from '@/lib/turso';
import { visibleSql } from '@/lib/questionVisibility';

// চালু কোর্সের বিষয়গুলো আর প্রতিটায় কয়টা প্রশ্ন (হোমের "বিষয়ভিত্তিক প্রস্তুতি")।
// পুরো প্রশ্ন টেবিল গুনলে প্রতিটা প্রশ্ন একটা read (মেডিকেলে ~২৮ হাজার), তাই গোনা ফল ছোট টেবিল subject_counts এ রাখি:
// সাধারণত শুধু ওই ~১০টা লাইন পড়া হয়। দিনে একবার (বা টেবিল খালি থাকলে) আসল টেবিল থেকে নতুন করে গোনা হয়।
// সার্ভারের মেমরিতেও ১ ঘণ্টা মনে রাখি, তাই বেশিরভাগ সময় Turso তে কোনো read ই হয় না।
type Row = { subject: string; count: number };
const cache = new Map<Platform, { at: number; rows: Row[] }>();
const TTL = 60 * 60 * 1000;
const RECOUNT_AFTER = 24 * 60 * 60 * 1000;

let tableReady: Promise<unknown> | null = null;
const ensureTable = () =>
    (tableReady ??= turso.execute(
        'CREATE TABLE IF NOT EXISTS subject_counts (platform TEXT NOT NULL, subject TEXT NOT NULL, n INTEGER NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (platform, subject))',
    ).catch((e) => { tableReady = null; throw e; }));

async function recount(p: Platform): Promise<Row[]> {
    const r = await turso.execute({
        sql: `SELECT subject, COUNT(*) n FROM ${questionTable(p)} WHERE platform = ? AND subject <> '' AND ${visibleSql()} GROUP BY subject`,
        args: [p],
    });
    const rows = r.rows.map((x) => ({ subject: String(x.subject), count: Number(x.n) || 0 }));
    const now = Date.now();
    await turso.batch([
        { sql: 'DELETE FROM subject_counts WHERE platform = ?', args: [p] },
        ...rows.map((x) => ({ sql: 'INSERT INTO subject_counts (platform, subject, n, updated_at) VALUES (?, ?, ?, ?)', args: [p, x.subject, x.count, now] })),
    ]);
    return rows;
}

async function load(p: Platform): Promise<Row[]> {
    await ensureTable();
    const r = await turso.execute({ sql: 'SELECT subject, n, updated_at FROM subject_counts WHERE platform = ?', args: [p] });
    const fresh = r.rows.length > 0 && r.rows.every((x) => Date.now() - Number(x.updated_at) < RECOUNT_AFTER);
    if (fresh) return r.rows.map((x) => ({ subject: String(x.subject), count: Number(x.n) || 0 }));
    return recount(p);
}

export async function GET(req: NextRequest) {
    const p = platformOf(req);
    const hit = cache.get(p);
    if (hit && Date.now() - hit.at < TTL) return NextResponse.json({ success: true, subjects: hit.rows });
    const rows = (await load(p)).sort((a, b) => b.count - a.count);
    cache.set(p, { at: Date.now(), rows });
    return NextResponse.json({ success: true, subjects: rows });
}
