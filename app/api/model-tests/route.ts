import { NextRequest, NextResponse } from 'next/server';
import { platformOf } from '@/lib/serverAuth';
import { listModelTests } from '@/lib/siteData';

export async function GET(req: NextRequest) {
    const limit = Math.min(Number(new URL(req.url).searchParams.get('limit')) || 50, 100);
    return NextResponse.json({ success: true, tests: await listModelTests(platformOf(req), limit) });
}
