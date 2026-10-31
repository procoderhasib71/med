import { NextRequest, NextResponse } from 'next/server';
import { COURSE_COOKIE, type Platform } from '@/lib/platform';

/** ক্লাসরুমে বাছাই করা কোর্স মনে রাখা (এক বছর); শুধু কোন কোর্স, কোনো গোপন কিছু নয় */
export function setCourseCookie(res: NextResponse, req: NextRequest, p: Platform) {
    res.cookies.set(COURSE_COOKIE, p, {
        path: '/', maxAge: 365 * 24 * 3600, sameSite: 'lax',
        secure: req.nextUrl.protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https',
    });
    return res;
}
