import { NextRequest, NextResponse } from 'next/server';
import { fail, platformOf, requireAdmin } from '@/lib/serverAuth';
import { saveModelTest } from '@/lib/siteData';

// body: { id, test: {...} }
export async function POST(req: NextRequest) {
    const admin = await requireAdmin(req);
    if (admin instanceof NextResponse) return admin;
    const { id, test } = await req.json().catch(() => ({}));
    if (!id || !test || typeof test !== 'object') return fail('ভুল request');
    await saveModelTest(String(id), test, admin.email, platformOf(req));
    return NextResponse.json({ success: true });
}
