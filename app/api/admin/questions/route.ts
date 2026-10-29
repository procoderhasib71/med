import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';
import { platformOf, requireAdmin } from '@/lib/serverAuth';

const turso = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
});

export async function GET(req: NextRequest) {
    const admin = await requireAdmin(req);
    if (admin instanceof NextResponse) return admin;
    try {
        const { searchParams } = new URL(req.url);

        const subject = searchParams.get('subject') || '';
        const chapter = searchParams.get('chapter') || '';
        const topic = searchParams.get('topic') || '';
        const source = searchParams.get('source') || '';
        const search = searchParams.get('search') || '';
        const limit = Math.min(parseInt(searchParams.get('limit') || '150') || 150, 500);

        const conditions: string[] = ['platform = ?'];
        const args: any[] = [platformOf(req)];

        if (subject) {
            conditions.push('subject = ?');
            args.push(subject.trim());
        }

        if (chapter) {
            conditions.push('chapter = ?');
            args.push(chapter.trim());
        }

        if (topic) {
            conditions.push('topic = ?');
            args.push(topic.trim());
        }

        if (source) {
            conditions.push('(source LIKE ? OR tag LIKE ?)');
            args.push(`%${source.trim()}%`, `%${source.trim()}%`);
        }

        if (search) {
            conditions.push('(question LIKE ? OR topic LIKE ? OR tag LIKE ?)');
            const s = `%${search.trim()}%`;
            args.push(s, s, s);
        }

        const sql = `
            SELECT id, subject, chapter, topic, question, option_a, option_b, option_c, option_d, correct_option, explanation, tag, source
            FROM questions
            WHERE ${conditions.join(' AND ')}
            ORDER BY id DESC
            LIMIT ?
        `;
        args.push(limit);

        const result = await turso.execute({ sql, args });

        const questions = result.rows.map((row: any) => ({
            id: String(row.id),
            subject: row.subject || '',
            chapter: row.chapter || '',
            topic: row.topic || '',
            question: row.question || '',
            option_a: row.option_a || '',
            option_b: row.option_b || '',
            option_c: row.option_c || '',
            option_d: row.option_d || '',
            correct_option: String(row.correct_option || '').toLowerCase(),
            explanation: row.explanation || '',
            tag: row.tag || '',
            source: row.source || ''
        }));

        return NextResponse.json({ success: true, questions });
    } catch (error: any) {
        console.error('API /api/admin/questions error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}