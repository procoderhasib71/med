import { NextRequest, NextResponse } from 'next/server';
import { fail, platformOf, requireUser } from '@/lib/serverAuth';
import { getMistakes, removeMistakes } from '@/lib/siteData';

export async function GET(req: NextRequest) {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;
    return NextResponse.json({ success: true, ...(await getMistakes(user.uid, platformOf(req))) });
}

// body: { ids: [...] }
export async function DELETE(req: NextRequest) {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;
    const { ids } = await req.json().catch(() => ({ ids: [] }));
    if (!Array.isArray(ids)) return fail('ids নেই');
    await removeMistakes(user.uid, ids);
    return NextResponse.json({ success: true });
}
