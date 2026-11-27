'use client';

import Link from 'next/link';
import { useLang } from '@/lib/i18n';
import { usePathname } from 'next/navigation';
import AppHeader, { NAV } from '@/components/AppHeader';

// ক্লাসরুমের সব পেজে একই হেডার (উপরে) আর মোবাইলে নিচের মেনু।
// পরীক্ষা চলার পাতা, লগইন, কোর্সের শর্টকাট আর admin এ নয় (ওগুলো নিজের মতো পুরো পর্দা নেয়)।
const BARE = ['/login', '/course/', '/admin', '/reports', '/model-test/exam'];

export default function AppShell({ children }: { children: React.ReactNode }) {
    const path = usePathname();
    if (BARE.some((b) => path.startsWith(b))) return <>{children}</>;
    return (
        <>
            <AppHeader />
            {/* পাতা বদলালে নতুন পাতা নরমভাবে ভেসে ওঠে (key বদলালে অ্যানিমেশন আবার চলে) */}
            <div key={path} className="page-in pb-[calc(6.5rem+env(safe-area-inset-bottom))] lg:pb-0">{children}</div>
            <BottomNav path={path} />
        </>
    );
}

// Focus/Money অ্যাপের মতো নিচ থেকে ভাসানো মেনু; বাছা ঘরের পেছনে নরম পিল, অন্যটায় চাপলে মসৃণভাবে সরে যায়
function BottomNav({ path }: { path: string }) {
    const { t } = useLang();
    const idx = NAV.findIndex((n) => (n.href === '/' ? path === '/' : path.startsWith(n.href)));
    return (
        <nav data-bottom-nav className="lg:hidden fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 w-[92%] max-w-[420px] z-40 bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-white/[0.07] rounded-[22px] shadow-[0_12px_32px_-12px_rgba(15,23,42,0.35)] dark:shadow-[0_12px_32px_-12px_rgba(0,0,0,0.7)]">
            <div className="relative grid grid-cols-5 p-1.5">
                {idx >= 0 && (
                    <span aria-hidden className="absolute top-1.5 bottom-1.5 left-1.5 rounded-2xl bg-emerald-50 dark:bg-emerald-500/15 transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)]"
                        style={{ width: `calc((100% - 0.75rem) / ${NAV.length})`, transform: `translateX(${idx * 100}%)` }} />
                )}
                {NAV.map((n, i) => {
                    const active = i === idx;
                    return (
                        <Link key={n.href} href={n.href} aria-current={active ? 'page' : undefined}
                            className="relative flex flex-col items-center gap-0.5 py-1.5 press">
                            <n.icon size={21} strokeWidth={active ? 2.4 : 1.9}
                                className={`transition-colors duration-300 ${active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`} />
                            <span className={`text-[10px] tracking-wide transition-colors duration-300 ${active ? 'font-extrabold text-emerald-600 dark:text-emerald-400' : 'font-semibold text-slate-500 dark:text-slate-400'}`}>
                                {t(n.short[0], n.short[1])}
                            </span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
