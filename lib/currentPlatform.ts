import { cookies, headers } from 'next/headers';
import { COURSE_COOKIE, resolvePlatform, type Platform } from '@/lib/platform';

/** server component আর server action এর জন্য: ঠিকানা, না হলে বাছাই করা কোর্স */
export async function currentPlatform(): Promise<Platform> {
    const [h, c] = await Promise.all([headers(), cookies()]);
    return resolvePlatform(h.get('x-forwarded-host') || h.get('host'), c.get(COURSE_COOKIE)?.value);
}
