import { NextRequest, NextResponse } from 'next/server';
import { fail, requireUser } from '@/lib/serverAuth';
import { createReport } from '@/lib/siteData';

// ছাত্রের "প্রশ্নে ভুল আছে" রিপোর্ট
export async function POST(req: NextRequest) {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;
    const { questionId, reason } = await req.json().catch(() => ({}));
    if (!questionId || !String(reason || '').trim()) return fail('প্রশ্ন বা কারণ নেই');
    const id = await createReport(String(questionId), String(reason).trim(), user);
    return NextResponse.json({ success: true, id });
}
