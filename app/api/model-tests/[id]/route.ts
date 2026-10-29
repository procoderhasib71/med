import { NextRequest, NextResponse } from 'next/server';
import { getModelTest } from '@/lib/siteData';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const test = await getModelTest((await params).id);
    if (!test) return NextResponse.json({ success: false, error: 'পাওয়া যায়নি' }, { status: 404 });
    return NextResponse.json({ success: true, test });
}
