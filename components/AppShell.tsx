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
            <div className="pb-[72px] md:pb-0">{children}</div>
            <BottomNav path={path} />
        </>
    );
}

function BottomNav({ path }: { path: string }) {
    const { t } = useLang();
    return (
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-[#0B1120]/90 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
            <div className="flex h-[60px] items-stretch">
                {NAV.map((n) => {
                    const active = n.href === '/' ? path === '/' : path.startsWith(n.href);
                    return (
                        <Link key={n.href} href={n.href}
                            className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                            {active && <span className="absolute top-0 h-[3px] w-8 rounded-b-full bg-emerald-500" />}
                            <n.icon size={20} strokeWidth={active ? 2.4 : 2} />
                            <span className="text-[10px] font-bold">{t(n.short[0], n.short[1])}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
