import { NextRequest, NextResponse } from 'next/server';
import { setCourseCookie } from '@/lib/courseCookie';
import { COURSE_COOKIE, isClassroomHost, isPlatform } from '@/lib/platform';
import { fail, getUser, platformOf } from '@/lib/serverAuth';
import { getEnrollments } from '@/lib/siteData';

// ক্লাসরুমের কোর্স: কোনটা চালু, কোনগুলো নেওয়া; বদলানো যায় শুধু নেওয়া কোর্সে

const hostOf = (req: NextRequest) => req.headers.get('x-forwarded-host') || req.headers.get('host');

export async function GET(req: NextRequest) {
    const user = await getUser(req);
    const chosen = req.cookies.get(COURSE_COOKIE)?.value;
    return NextResponse.json({
        success: true,
        classroom: isClassroomHost(hostOf(req)),
        current: platformOf(req),
        chosen: isPlatform(chosen) ? chosen : null,
        loggedIn: Boolean(user),
        enrolled: user ? await getEnrollments(user.uid) : [],
    });
}

// body: { platform }
export async function POST(req: NextRequest) {
    const user = await getUser(req);
    if (!user) return fail('লগইন করুন', 401);
    const { platform } = await req.json().catch(() => ({}));
    if (!isPlatform(platform)) return fail('কোর্স পাওয়া যায়নি');
    if (!(await getEnrollments(user.uid)).includes(platform)) return fail('এই কোর্সটি নেওয়া হয়নি', 403);
    return setCourseCookie(NextResponse.json({ success: true }), req, platform);
}
