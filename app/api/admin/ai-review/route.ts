import { NextRequest, NextResponse } from 'next/server';
import { platformOf, requireAdmin } from '@/lib/serverAuth';
import { listAiReview, reviewAiFix } from '@/lib/questionAdmin';

export async function GET(req: NextRequest) {
    const admin = await requireAdmin(req);
    if (admin instanceof NextResponse) return admin;
    const p = req.nextUrl.searchParams;
    try {
        const data = await listAiReview(platformOf(req), {
            subject: p.get('subject') || '',
            type: p.get('type') || '',
            offset: Number(p.get('offset') || 0),
            limit: Number(p.get('limit') || 20),
        });
        return NextResponse.json({ success: true, ...data });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const admin = await requireAdmin(req);
    if (admin instanceof NextResponse) return admin;
    const { questionId, action, edits } = await req.json();
    if (!questionId || !['apply', 'keep', 'save'].includes(action)) {
        return NextResponse.json({ success: false, error: 'ভুল request' }, { status: 400 });
    }
    try {
        const changed = await reviewAiFix(String(questionId), action, admin.email, edits && typeof edits === 'object' ? edits : {});
        return NextResponse.json({ success: true, changed });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 400 });
    }
}
