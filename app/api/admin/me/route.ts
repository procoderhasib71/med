import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/serverAuth';

export async function GET(req: NextRequest) {
    const admin = await requireAdmin(req);
    if (admin instanceof NextResponse) return admin;
    return NextResponse.json({ success: true, email: admin.email });
}
