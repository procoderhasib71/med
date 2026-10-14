'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Stethoscope, Microscope, Dna, TestTube2, Atom, BookOpen, Globe, Activity,
    History, Bookmark, Moon, Sun, User, Trophy, X, LogOut, Mail,
    Landmark, BarChart3, HeartHandshake, ChevronRight
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import Link from 'next/link';

export default function MedicalPortal() {
    const router = useRouter();
    const { isDarkMode, toggleTheme } = useTheme();

    const [currentUser, setCurrentUser] = useState<any>(null);
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    const [totalStudySeconds, setTotalStudySeconds] = useState(0);
    const [totalScore, setTotalScore] = useState(0);
    const [mistakeCount, setMistakeCount] = useState(0);
    const [bookmarkCount, setBookmarkCount] = useState(0);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const cachedStats = localStorage.getItem('user_portal_stats');
            if (cachedStats) {
                try {
                    const parsed = JSON.parse(cachedStats);
                    setTotalStudySeconds(parsed.totalStudySeconds || 0);
                    setTotalScore(parsed.totalScore || 0);
                    setMistakeCount(parsed.mistakeCount || 0);
                    setBookmarkCount(parsed.bookmarkCount || 0);
                } catch (e) { }
            }
        }

        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setCurrentUser(user);
                try {
                    const userRef = doc(db, 'users', user.uid);
                    const docSnap = await getDoc(userRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        const studySec = data.totalStudySeconds || 0;
                        const score = data.totalScore || 0;
                        const mistakes = Array.isArray(data.mistakes) ? data.mistakes.length : 0;
                        const bookmarks = Array.isArray(data.bookmarks) ? data.bookmarks.length : 0;

                        setTotalStudySeconds(studySec);
                        setTotalScore(score);
                        setMistakeCount(mistakes);
                        setBookmarkCount(bookmarks);

                        localStorage.setItem('user_portal_stats', JSON.stringify({
                            totalStudySeconds: studySec,
                            totalScore: score,
                            mistakeCount: mistakes,
                            bookmarkCount: bookmarks
                        }));
                    }
                } catch (error) {
                    console.error("User data fetch error:", error);
                }
            } else {
                setCurrentUser(null);
                setTotalStudySeconds(0);
                setTotalScore(0);
                setMistakeCount(0);
                setBookmarkCount(0);
                localStorage.removeItem('user_portal_stats');
            }
        });

        return () => unsubscribeAuth();
    }, []);

    const handleLogout = async () => {
        try {
            await signOut(auth);
            localStorage.removeItem('user_portal_stats');
            const isLive = window.location.hostname.includes('adqlive.com');
            const domainStr = isLive ? 'domain=.adqlive.com;' : 'domain=localhost;';
            document.cookie = `auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; ${domainStr}`;
            window.location.reload();
        } catch (error) {
            console.error("লগআউটে সমস্যা হয়েছে:", error);
        }
    };

    const handleFeatureClick = (e: React.MouseEvent) => {
        if (!currentUser) {
            e.preventDefault();
            router.push('/login');
        }
    };

    const formatTotalStudy = (seconds: number) => {
        if (seconds === 0) return '০ সে';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}ঘ ${m}মি`;
        if (m > 0) return `${m}মি ${s}সে`;
        return `${s} সে`;
    };

    const medicalSubjects = [
        {
            id: 'উদ্ভিদবিজ্ঞান',
            name: 'উদ্ভিদবিজ্ঞান',
            icon: Microscope,
            color: 'text-emerald-600 dark:text-emerald-400',
            bg: 'bg-emerald-50 dark:bg-emerald-500/10'
        },
        {
            id: 'প্রাণিবিজ্ঞান',
            name: 'প্রাণিবিজ্ঞান',
            icon: Dna,
            color: 'text-teal-600 dark:text-teal-400',
            bg: 'bg-teal-50 dark:bg-teal-500/10'
        },
        {
            id: 'রসায়ন ১ম পত্র',
            name: 'রসায়ন ১ম পত্র',
            icon: TestTube2,
            color: 'text-amber-600 dark:text-amber-400',
            bg: 'bg-amber-50 dark:bg-amber-500/10'
        },
        {
            id: 'রসায়ন ২য় পত্র',
            name: 'রসায়ন ২য় পত্র',
            icon: TestTube2,
            color: 'text-orange-600 dark:text-orange-400',
            bg: 'bg-orange-50 dark:bg-orange-500/10'
        },
        {
            id: 'পদার্থবিজ্ঞান ১ম পত্র',
            name: 'পদার্থবিজ্ঞান ১ম পত্র',
            icon: Atom,
            color: 'text-blue-600 dark:text-blue-400',
            bg: 'bg-blue-50 dark:bg-blue-500/10'
        },
        {
            id: 'পদার্থবিজ্ঞান ২য় পত্র',
            name: 'পদার্থবিজ্ঞান ২য় পত্র',
            icon: Atom,
            color: 'text-indigo-600 dark:text-indigo-400',
            bg: 'bg-indigo-50 dark:bg-indigo-500/10'
        },
        {
            id: 'English',
            name: 'ইংরেজি',
            icon: BookOpen,
            color: 'text-purple-600 dark:text-purple-400',
            bg: 'bg-purple-50 dark:bg-purple-500/10'
        },
        {
            id: 'সাধারণ জ্ঞান (বাংলাদেশ)',
            name: 'সাধারণ জ্ঞান (বাংলাদেশ)',
            icon: Landmark,
            color: 'text-rose-600 dark:text-rose-400',
            bg: 'bg-rose-50 dark:bg-rose-500/10'
        },
        {
            id: 'সাধারণ জ্ঞান (আন্তর্জাতিক)',
            name: 'সাধারণ জ্ঞান (আন্তর্জাতিক)',
            icon: Globe,
            color: 'text-cyan-600 dark:text-cyan-400',
            bg: 'bg-cyan-50 dark:bg-cyan-500/10'
        },
        {
            id: 'মানবিক গুণাবলি',
            name: 'মানবিক গুণাবলি',
            icon: HeartHandshake,
            color: 'text-pink-600 dark:text-pink-400',
            bg: 'bg-pink-50 dark:bg-pink-500/10'
        },
    ];

    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 transition-colors">

            {/* Profile Modal Backdrop */}
            {isProfileOpen && currentUser && (
                <div className="fixed inset-0 z-40 bg-black/20 dark:bg-black/50" onClick={() => setIsProfileOpen(false)}></div>
            )}

            {/* Navbar */}
            <header className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0B1120]/95 backdrop-blur-md">
                <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 items-center justify-between">

                        {/* Brand Logo */}
                        <Link href="/" className="flex items-center gap-2.5">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                                <Stethoscope size={19} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-lg font-black tracking-tight leading-none text-slate-900 dark:text-white">
                                    ADQ<span className="text-emerald-600 dark:text-emerald-400">Live</span>
                                </span>
                                <span className="text-[9px] font-bold tracking-widest text-slate-400 uppercase">Medical Portal</span>
                            </div>
                        </Link>

                        {/* Right Controls */}
                        <div className="flex items-center gap-1.5 sm:gap-2">
                            <Link
                                href="/analysis"
                                onClick={handleFeatureClick}
                                className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                title="অ্যানালাইসিস"
                            >
                                <BarChart3 size={19} />
                            </Link>

                            <button
                                onClick={handleFeatureClick}
                                className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                title="লিডারবোর্ড"
                            >
                                <Trophy size={19} />
                            </button>

                            <button
                                onClick={toggleTheme}
                                className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                {isDarkMode ? <Sun size={19} className="text-amber-400" /> : <Moon size={19} />}
                            </button>

                            <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1"></div>

                            {/* Profile / Login */}
                            {currentUser ? (
                                <div className="relative">
                                    <button
                                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                                        className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 sm:px-3 hover:border-slate-300 dark:hover:border-slate-600 transition-all cursor-pointer"
                                    >
                                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                                            <User size={13} />
                                        </div>
                                        <span className="text-xs font-bold hidden sm:block text-slate-700 dark:text-slate-200">
                                            {currentUser.displayName || 'ডাক্তার প্রার্থী'}
                                        </span>
                                    </button>

                                    {isProfileOpen && (
                                        <div className="absolute top-11 right-0 w-72 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-4 mt-2">
                                            <div className="flex justify-between items-start mb-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                                                <div className="truncate pr-2">
                                                    <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                                        {currentUser.displayName || 'ডাক্তার প্রার্থী'}
                                                    </h3>
                                                    <p className="text-[11px] text-slate-400 truncate mt-0.5">{currentUser.email}</p>
                                                </div>
                                                <button onClick={() => setIsProfileOpen(false)} className="text-slate-400 hover:text-slate-600">
                                                    <X size={15} />
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 mb-3">
                                                <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl text-center">
                                                    <div className="text-[10px] text-slate-400">মোট স্টাডি</div>
                                                    <div className="font-bold text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">{formatTotalStudy(totalStudySeconds)}</div>
                                                </div>
                                                <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl text-center">
                                                    <div className="text-[10px] text-slate-400">মোট স্কোর</div>
                                                    <div className="font-bold text-xs text-orange-600 dark:text-orange-400 mt-0.5">{totalScore}</div>
                                                </div>
                                            </div>

                                            <button
                                                onClick={handleLogout}
                                                className="w-full py-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-rose-100 transition-colors"
                                            >
                                                <LogOut size={13} /> লগআউট
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <Link
                                    href="/login"
                                    className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 text-xs font-bold transition-all shadow-xs"
                                >
                                    লগইন
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content - max-w-5xl keeps desktop compact and centered */}
            <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-6 sm:py-9">

                {/* Top 5 Feature Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-9">

                    <Link
                        href="/qbank?category=medical"
                        onClick={handleFeatureClick}
                        className="flex flex-col items-center justify-center p-4 sm:p-5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all"
                    >
                        <Stethoscope size={24} className="mb-2" />
                        <span className="text-xs sm:text-sm font-bold">MCQ প্র্যাকটিস</span>
                    </Link>

                    <Link
                        href="/model-test?category=medical"
                        onClick={handleFeatureClick}
                        className="flex flex-col items-center justify-center p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs transition-all"
                    >
                        <Activity size={24} className="text-blue-500 mb-2" />
                        <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">মডেল টেস্ট</span>
                    </Link>

                    <Link
                        href="/analysis"
                        onClick={handleFeatureClick}
                        className="flex flex-col items-center justify-center p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs transition-all"
                    >
                        <BarChart3 size={24} className="text-emerald-600 dark:text-emerald-400 mb-2" />
                        <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">অ্যানালাইসিস</span>
                    </Link>

                    <Link
                        href="/mistakes?category=medical"
                        onClick={handleFeatureClick}
                        className="relative flex flex-col items-center justify-center p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs transition-all"
                    >
                        {mistakeCount > 0 && (
                            <span className="absolute top-2.5 right-2.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-orange-500 text-white text-[9px] font-bold">
                                {mistakeCount}
                            </span>
                        )}
                        <History size={24} className="text-orange-500 mb-2" />
                        <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">ভুল প্রশ্ন ব্যাংক</span>
                    </Link>

                    <Link
                        href="/bookmarks?category=medical"
                        onClick={handleFeatureClick}
                        className="relative flex flex-col items-center justify-center p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs transition-all col-span-2 lg:col-span-1"
                    >
                        {bookmarkCount > 0 && (
                            <span className="absolute top-2.5 right-2.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-purple-500 text-white text-[9px] font-bold">
                                {bookmarkCount}
                            </span>
                        )}
                        <Bookmark size={24} className="text-purple-500 mb-2" />
                        <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">বুকমার্কস</span>
                    </Link>

                </div>

                {/* Section Title */}
                <div className="flex items-center gap-2 mb-4">
                    <BookOpen size={19} className="text-emerald-600 dark:text-emerald-400" />
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                        বিষয়ভিত্তিক প্রস্তুতি
                    </h2>
                </div>

                {/* Subjects Grid: Mobile 2 columns, Tablet 2 columns, Desktop 3 solid columns */}
                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3.5">
                    {medicalSubjects.map((subject) => {
                        const Icon = subject.icon;
                        return (
                            <Link
                                key={subject.id}
                                href={`/qbank?category=medical&subject=${encodeURIComponent(subject.id)}`}
                                onClick={handleFeatureClick}
                                className="flex items-center justify-between p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/40 dark:hover:border-emerald-500/30 transition-all shadow-xs"
                            >
                                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                                    <div className={`flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl ${subject.bg} ${subject.color}`}>
                                        <Icon size={19} />
                                    </div>
                                    <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                                        {subject.name}
                                    </span>
                                </div>
                                <ChevronRight size={16} className="text-slate-400 shrink-0 hidden sm:block" />
                            </Link>
                        );
                    })}
                </div>

            </main>
        </div>
    );
}