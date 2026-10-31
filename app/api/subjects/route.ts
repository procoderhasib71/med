import { NextRequest, NextResponse } from 'next/server';
import type { Platform } from '@/lib/platform';
import { platformOf } from '@/lib/serverAuth';
import { turso } from '@/lib/turso';

// চালু কোর্সের বিষয়গুলো আর প্রতিটায় কয়টা প্রশ্ন (হোমের "বিষয়ভিত্তিক প্রস্তুতি")। প্রশ্ন কম বদলায়, তাই ১ ঘণ্টা মনে রাখি।
const cache = new Map<Platform, { at: number; rows: { subject: string; count: number }[] }>();
const TTL = 60 * 60 * 1000;

export async function GET(req: NextRequest) {
    const p = platformOf(req);
    const hit = cache.get(p);
    if (hit && Date.now() - hit.at < TTL) return NextResponse.json({ success: true, subjects: hit.rows });
    const r = await turso.execute({
        sql: "SELECT subject, COUNT(*) n FROM questions WHERE platform = ? AND subject <> '' GROUP BY subject ORDER BY n DESC",
        args: [p],
    });
    const rows = r.rows.map((x) => ({ subject: String(x.subject), count: Number(x.n) || 0 }));
    cache.set(p, { at: Date.now(), rows });
    return NextResponse.json({ success: true, subjects: rows });
}
