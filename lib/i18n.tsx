'use client';

import { createContext, useCallback, useContext, useState } from 'react';

// ক্লাসরুমের ভাষা: বাংলা বা English, ছাত্র প্রোফাইল থেকে বদলায়।
// লেখা পাশাপাশি থাকে: t('হোম', 'Home')। পছন্দ cookie তে থাকে, তাই সার্ভারও প্রথম থেকেই ঠিক ভাষায় পেজ বানায় (ঝলক নেই)।
// প্রশ্ন, বিষয়ের নাম আর ব্যাখ্যা DB তে যেমন আছে তেমনই দেখায়; শুধু সাইটের লেখা বদলায়।

import { LANG_COOKIE, type Lang } from '@/lib/langCookie';

export type { Lang };

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';

type Ctx = {
    lang: Lang;
    setLang: (l: Lang) => void;
    /** বাংলা আর English দুটোই দিন, চালু ভাষারটা ফেরত */
    t: (bn: string, en: string) => string;
    /** সংখ্যা চালু ভাষার অঙ্কে (বাংলায় ০১২, English এ 012) */
    n: (v: number | string) => string;
};

const LangContext = createContext<Ctx>({
    lang: 'bn',
    setLang: () => undefined,
    t: (bn) => bn,
    n: (v) => String(v).replace(/\d/g, (d) => BN_DIGITS[Number(d)]),
});

export const useLang = () => useContext(LangContext);

export function LangProvider({ initial, children }: { initial: Lang; children: React.ReactNode }) {
    const [lang, setLangState] = useState<Lang>(initial);

    const setLang = useCallback((l: Lang) => {
        setLangState(l);
        document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=${365 * 24 * 3600}; samesite=lax`;
        document.documentElement.lang = l;
    }, []);

    const t = useCallback((bn: string, en: string) => (lang === 'en' ? en : bn), [lang]);
    const n = useCallback((v: number | string) => (lang === 'en'
        ? String(v).replace(/[০-৯]/g, (d) => String(BN_DIGITS.indexOf(d)))
        : String(v).replace(/\d/g, (d) => BN_DIGITS[Number(d)])), [lang]);

    return <LangContext.Provider value={{ lang, setLang, t, n }}>{children}</LangContext.Provider>;
}

/** ছোট বোতামজোড়া: বাংলা | English (প্রোফাইল মেনু, প্রোফাইল পেজ, লগইন পেজে) */
export function LangSwitch({ className = '' }: { className?: string }) {
    const { lang, setLang } = useLang();
    return (
        <div role="group" aria-label="Language / ভাষা" className={`inline-flex p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 ${className}`}>
            {([['bn', 'বাংলা'], ['en', 'English']] as const).map(([id, label]) => (
                <button key={id} type="button" onClick={() => setLang(id)} aria-pressed={lang === id}
                    className={`px-3 py-1.5 rounded-[10px] text-xs font-bold transition-colors cursor-pointer ${lang === id ? 'bg-white dark:bg-slate-950 text-emerald-700 dark:text-emerald-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>
                    {label}
                </button>
            ))}
        </div>
    );
}
