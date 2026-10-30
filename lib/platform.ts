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

export function platformFromHost(host: string | null | undefined): Platform {
    const sub = String(host || '').toLowerCase().split(':')[0].split('.')[0];
    if (sub in PLATFORMS && String(host).toLowerCase().includes(ROOT_DOMAIN)) return sub as Platform;
    const env = (process.env.NEXT_PUBLIC_PLATFORM || process.env.PLATFORM || '') as Platform;
    return env in PLATFORMS ? env : 'med';
}

/** admcq.com এর কোনো subdomain এ চলছি কিনা (তখন লগইন আর প্রোফাইল admcq.com এ) */
export const onAdmcqDomain = (host: string) => host.toLowerCase().split(':')[0].endsWith(ROOT_DOMAIN);

export const clientPlatform = (): Platform =>
    platformFromHost(typeof window === 'undefined' ? '' : window.location.host);
