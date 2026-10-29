import { NextRequest, NextResponse } from 'next/server';
import { fail, platformOf, requireUser } from '@/lib/serverAuth';
import { getExamResult, listExamResults, submitExam } from '@/lib/siteData';

// ?testId= দিলে একটা পরীক্ষার পুরো ফল (দাগানো উত্তরসহ), না দিলে সব পরীক্ষার সংক্ষেপ
export async function GET(req: NextRequest) {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;
    const testId = new URL(req.url).searchParams.get('testId');
    if (testId) return NextResponse.json({ success: true, result: await getExamResult(user.uid, testId) });
    return NextResponse.json({ success: true, results: await listExamResults(user.uid, platformOf(req)) });
}

// body: { testId, answers: { [questionId]: 'a' }, retake }
export async function POST(req: NextRequest) {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;
    const { testId, answers, retake } = await req.json().catch(() => ({}));
    if (!testId || typeof answers !== 'object') return fail('ভুল request');
    try {
        return NextResponse.json({ success: true, result: await submitExam(user.uid, String(testId), answers || {}, Boolean(retake)) });
    } catch (e: unknown) {
        return fail(e instanceof Error ? e.message : 'জমা দেওয়া যায়নি', 500);
    }
}
