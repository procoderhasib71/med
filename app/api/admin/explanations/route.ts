import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/serverAuth';
import { listExplanationDrafts, reviewExplanation } from '@/lib/questionAdmin';

export async function GET(req: NextRequest) {
    const admin = await requireAdmin(req);
    if (admin instanceof NextResponse) return admin;
    return NextResponse.json({ success: true, ...(await listExplanationDrafts()) });
}

export async function POST(req: NextRequest) {
    const admin = await requireAdmin(req);
    if (admin instanceof NextResponse) return admin;
    const { questionId, action, text } = await req.json();
    if (!questionId || !['approve', 'reject'].includes(action)) {
        return NextResponse.json({ success: false, error: 'ভুল request' }, { status: 400 });
    }
    try {
        await reviewExplanation(String(questionId), action, admin.email, typeof text === 'string' ? text : undefined);
        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
