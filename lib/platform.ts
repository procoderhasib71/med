// এক কোড, চার সাইট: med.admcq.com, ka.admcq.com, kha.admcq.com, eng.admcq.com।
// ঠিকানা দেখে প্ল্যাটফর্ম ঠিক হয়; অন্য ঠিকানায় (localhost, *.hosted.app) PLATFORM env বা med।

export const PLATFORMS = {
    med: { name: 'মেডিকেল ও ডেন্টাল', short: 'Medical', title: 'ADMCQ Medical QBank' },
    ka: { name: "ভার্সিটি 'ক' ইউনিট", short: "Varsity 'Ka'", title: "ADMCQ Varsity 'Ka'" },
    kha: { name: "ভার্সিটি 'খ' ইউনিট", short: "Varsity 'Kha'", title: "ADMCQ Varsity 'Kha'" },
    eng: { name: 'ইঞ্জিনিয়ারিং', short: 'Engineering', title: 'ADMCQ Engineering' },
} as const;
export type Platform = keyof typeof PLATFORMS;

export const ROOT_DOMAIN = 'admcq.com';
export const ACCOUNT_URL = `https://${ROOT_DOMAIN}`;
// admcq.com এর লগইন চালু হলে hosting এর env এ NEXT_PUBLIC_ACCOUNT_LOGIN=1 দাও; তার আগে প্রতিটা সাইটে নিজের লগইন
export const CENTRAL_LOGIN = process.env.NEXT_PUBLIC_ACCOUNT_LOGIN === '1';

// app.admcq.com: একটাই ক্লাসরুম, ছাত্র যে কোর্স বাছাই করেছে (cookie) সেই কোর্সের সব দেখায়
export const COURSE_COOKIE = 'admcq_course';
// এটা দিলে med/ka/kha/eng.admcq.com এ ঢুকলে ক্লাসরুমে পাঠানো হয় (যেমন https://app.admcq.com); না দিলে আগের মতো
export const CLASSROOM_URL = (process.env.NEXT_PUBLIC_CLASSROOM_URL || '').replace(/\/$/, '');

export const isPlatform = (v: unknown): v is Platform => typeof v === 'string' && v in PLATFORMS;

/** med.admcq.com এর মতো কোনো কোর্সের নিজের ঠিকানা হলে সেই কোর্স, নইলে null */
export function hostPlatform(host: string | null | undefined): Platform | null {
    const h = String(host || '').toLowerCase().split(':')[0];
    const sub = h.split('.')[0];
    return h.endsWith(ROOT_DOMAIN) && isPlatform(sub) ? sub : null;
}

/** কোর্সের ঠিকানা আগে; না হলে (app.admcq.com, localhost) বাছাই করা কোর্স; তাও না থাকলে env বা med */
export function resolvePlatform(host: string | null | undefined, chosen?: string | null): Platform {
    const fromHost = hostPlatform(host);
    if (fromHost) return fromHost;
    if (isPlatform(chosen)) return chosen;
    const env = process.env.NEXT_PUBLIC_PLATFORM || process.env.PLATFORM || '';
    return isPlatform(env) ? env : 'med';
}

/** শুধু ঠিকানা দেখে (cookie ছাড়া) */
export const platformFromHost = (host: string | null | undefined): Platform => resolvePlatform(host);

/** ক্লাসরুমে আছি কিনা (app.admcq.com, পরীক্ষার জন্য localhost): এখানে কোর্স বদলানো যায়, শুধু নেওয়া কোর্স চলে।
 *  *.hosted.app আগের মতো env এর প্ল্যাটফর্মে চলে। */
export function isClassroomHost(host: string | null | undefined) {
    const h = String(host || '').toLowerCase().split(':')[0];
    return h === `app.${ROOT_DOMAIN}` || h === 'localhost' || h === '127.0.0.1';
}

/** admcq.com এর কোনো subdomain এ চলছি কিনা (তখন লগইন আর প্রোফাইল admcq.com এ) */
export const onAdmcqDomain = (host: string) => host.toLowerCase().split(':')[0].endsWith(ROOT_DOMAIN);

export function clientPlatform(): Platform {
    if (typeof window === 'undefined') return resolvePlatform('');
    const chosen = document.cookie.split('; ').find((c) => c.startsWith(`${COURSE_COOKIE}=`))?.split('=')[1];
    return resolvePlatform(window.location.host, chosen);
}
