import { NextRequest, NextResponse } from 'next/server';
import { setCourseCookie } from '@/lib/courseCookie';
import { isPlatform } from '@/lib/platform';
import { fail, requireUser } from '@/lib/serverAuth';
import { turso } from '@/lib/turso';

// কোর্স নেওয়া (এখন বিনামূল্যে); নেওয়ার সাথে সাথে ক্লাসরুমে সেটাই চালু হয়। body: { platform }
export async function POST(req: NextRequest) {
    const user = await requireUser(req);
    if (user instanceof NextResponse) return user;
    const { platform } = await req.json().catch(() => ({}));
    if (!isPlatform(platform)) return fail('কোর্স পাওয়া যায়নি');
    await turso.execute({
        sql: 'INSERT OR IGNORE INTO site_enrollments (uid, platform, created_at) VALUES (?, ?, ?)',
        args: [user.uid, platform, new Date().toISOString()],
    });
    return setCourseCookie(NextResponse.json({ success: true }), req, platform);
}
