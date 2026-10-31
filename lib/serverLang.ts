import type { NextRequest } from 'next/server';
import { LANG_COOKIE } from '@/lib/langCookie';

/** API এর বার্তা বাছাই করা ভাষায়: const t = reqT(req); t('বাংলা', 'English') */
export const reqT = (req: NextRequest) => {
    const en = req.cookies.get(LANG_COOKIE)?.value === 'en';
    return (bn: string, english: string) => (en ? english : bn);
};
