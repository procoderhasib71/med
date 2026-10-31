'use client';

import Link from 'next/link';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import CourseSwitcher from '@/components/CourseSwitcher';
import ProfileMenu from '@/components/ProfileMenu';

// ক্লাসরুমের হেডার: AdMCQ লোগো, চালু কোর্স (বদলানো যায়), থিম, প্রোফাইল মেনু
export default function AppHeader() {
    const { isDarkMode, toggleTheme } = useTheme();
    return (
        <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/85 dark:bg-[#0B1120]/85 backdrop-blur-md">
            <div className="mx-auto max-w-2xl px-4 sm:px-6 h-[58px] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    <Link href="/" aria-label="AdMCQ হোম" className="flex items-center gap-1.5 shrink-0">
                        <span className="w-8 h-8 rounded-[10px] bg-gradient-to-tr from-emerald-500 to-blue-500 flex items-center justify-center font-black text-black text-[17px] shadow-md shadow-emerald-500/20">A</span>
                        <span className="hidden min-[400px]:block font-extrabold text-[19px] tracking-tight text-slate-900 dark:text-white">Ad<span className="text-emerald-500">MCQ</span></span>
                    </Link>
                    <span className="w-px h-6 bg-slate-200 dark:bg-slate-800 shrink-0" />
                    <CourseSwitcher />
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={toggleTheme} aria-label="থিম বদলান"
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                        {isDarkMode ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} />}
                    </button>
                    <ProfileMenu />
                </div>
            </div>
        </header>
    );
}
