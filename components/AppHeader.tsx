'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, BookOpen, ClipboardList, Home, Moon, Sun, Trophy } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import CourseSwitcher from '@/components/CourseSwitcher';
import ProfileMenu from '@/components/ProfileMenu';

// ক্লাসরুমের প্রধান মেনু: কম্পিউটারে হেডারের মাঝখানে, মোবাইলে নিচের বারে (AppShell)
export const NAV = [
    { href: '/', icon: Home, title: 'হোম', short: 'হোম' },
    { href: '/qbank', icon: BookOpen, title: 'প্র্যাকটিস', short: 'প্র্যাকটিস' },
    { href: '/model-test', icon: ClipboardList, title: 'মডেল টেস্ট', short: 'টেস্ট' },
    { href: '/analysis', icon: BarChart3, title: 'অ্যানালাইসিস', short: 'অ্যানালাইসিস' },
    { href: '/leaderboard', icon: Trophy, title: 'লিডারবোর্ড', short: 'র‍্যাংক' },
] as const;

// সব পেজের হেডার: AdMCQ লোগো, চালু কোর্স (বদলানো যায়), মেনু, থিম, প্রোফাইল মেনু
export default function AppHeader() {
    const path = usePathname();
    const { isDarkMode, toggleTheme, mounted } = useTheme();
    return (
        <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/85 dark:bg-[#0B1120]/85 backdrop-blur-md">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 h-[60px] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    <Link href="/" aria-label="AdMCQ হোম" className="flex items-center gap-1.5 shrink-0">
                        <span className="w-8 h-8 rounded-[10px] bg-gradient-to-tr from-emerald-500 to-blue-500 flex items-center justify-center font-black text-black text-[17px] shadow-md shadow-emerald-500/20">A</span>
                        <span className="hidden min-[420px]:block font-extrabold text-[19px] tracking-tight text-slate-900 dark:text-white">Ad<span className="text-emerald-500">MCQ</span></span>
                    </Link>
                    <span className="w-px h-6 bg-slate-200 dark:bg-slate-800 shrink-0" />
                    <CourseSwitcher />
                </div>

                <nav className="hidden md:flex items-center gap-1" aria-label="প্রধান মেনু">
                    {NAV.map((n) => {
                        const active = n.href === '/' ? path === '/' : path.startsWith(n.href);
                        return (
                            <Link key={n.href} href={n.href}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-colors ${active ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                                <n.icon size={16} /> {n.title}
                            </Link>
                        );
                    })}
                </nav>

                <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={toggleTheme} aria-label={isDarkMode ? 'লাইট মোড' : 'ডার্ক মোড'}
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                        {!mounted ? <span className="w-[18px] h-[18px]" /> : isDarkMode ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} />}
                    </button>
                    <ProfileMenu />
                </div>
            </div>
        </header>
    );
}
