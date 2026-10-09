'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Stethoscope, Microscope, Dna, TestTube2, Atom, BookOpen, Globe, Activity,
    History, Bookmark, Moon, Sun, User, Trophy, X, LogOut, Mail,
    Landmark, ChevronRight, BarChart3
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { doc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import Link from 'next/link';

export default function MedicalPortal() {
    const router = useRouter();
    const { isDarkMode, toggleTheme } = useTheme();

    // --- User & Profile State ---
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    // --- Stats State ---
    const [totalStudySeconds, setTotalStudySeconds] = useState(0);
    const [totalScore, setTotalScore] = useState(0);
    const [mistakeCount, setMistakeCount] = useState(0);
    const [bookmarkCount, setBookmarkCount] = useState(0);

    // ==========================================
    // 1. Firebase Auth & Live Data Listener
    // ==========================================
    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (user) {
                setCurrentUser(user);
                const userRef = doc(db, 'users', user.uid);
                const unsubscribeDoc = onSnapshot(userRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setTotalStudySeconds(data.totalStudySeconds || 0);
                        setTotalScore(data.totalScore || 0);

                        // ভুল প্রশ্ন ও বুকমার্কের সংখ্যা
                        setMistakeCount(Array.isArray(data.mistakes) ? data.mistakes.length : 0);
                        setBookmarkCount(Array.isArray(data.bookmarks) ? data.bookmarks.length : 0);
                    }
                });
                return () => unsubscribeDoc();
            } else {
                setCurrentUser(null);
                setTotalStudySeconds(0);
                setTotalScore(0);
                setMistakeCount(0);
                setBookmarkCount(0);
            }
        });
        return () => unsubscribeAuth();
    }, []);

    const handleLogout = async () => {
        try {
            await signOut(auth);
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
        if (seconds === 0) return '০ সেকেন্ড';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}ঘ ${m}মি`;
        if (m > 0) return `${m}মি ${s}সে`;
        return `${s} সেকেন্ড`;
    };

    const medicalSubjects = [
        {
            id: 'botany',
            name: 'উদ্ভিদবিজ্ঞান',
            icon: Microscope,
            color: 'text-emerald-600 dark:text-emerald-400',
            bg: 'bg-emerald-500/10 dark:bg-emerald-400/10 border-emerald-200/60 dark:border-emerald-800/40'
        },
        {
            id: 'zoology',
            name: 'প্রাণিবিজ্ঞান',
            icon: Dna,
            color: 'text-teal-600 dark:text-teal-400',
            bg: 'bg-teal-500/10 dark:bg-teal-400/10 border-teal-200/60 dark:border-teal-800/40'
        },
        {
            id: 'রসায়ন ১ম পত্র',
            name: 'রসায়ন ১ম পত্র',
            icon: TestTube2,
            color: 'text-amber-600 dark:text-amber-400',
            bg: 'bg-amber-500/10 dark:bg-amber-400/10 border-amber-200/60 dark:border-amber-800/40'
        },
        {
            id: 'রসায়ন ২য় পত্র',
            name: 'রসায়ন ২য় পত্র',
            icon: TestTube2,
            color: 'text-orange-600 dark:text-orange-400',
            bg: 'bg-orange-500/10 dark:bg-orange-400/10 border-orange-200/60 dark:border-orange-800/40'
        },
        {
            id: 'phys1',
            name: 'পদার্থবিজ্ঞান ১ম পত্র',
            icon: Atom,
            color: 'text-blue-600 dark:text-blue-400',
            bg: 'bg-blue-500/10 dark:bg-blue-400/10 border-blue-200/60 dark:border-blue-800/40'
        },
        {
            id: 'phys2',
            name: 'পদার্থবিজ্ঞান ২য় পত্র',
            icon: Atom,
            color: 'text-indigo-600 dark:text-indigo-400',
            bg: 'bg-indigo-500/10 dark:bg-indigo-400/10 border-indigo-200/60 dark:border-indigo-800/40'
        },
        {
            id: 'english',
            name: 'ইংরেজি',
            icon: BookOpen,
            color: 'text-purple-600 dark:text-purple-400',
            bg: 'bg-purple-500/10 dark:bg-purple-400/10 border-purple-200/60 dark:border-purple-800/40'
        },
        {
            id: 'gk_bd',
            name: 'সাধারণ জ্ঞান (বাংলাদেশ)',
            icon: Landmark,
            color: 'text-rose-600 dark:text-rose-400',
            bg: 'bg-rose-500/10 dark:bg-rose-400/10 border-rose-200/60 dark:border-rose-800/40'
        },
        {
            id: 'gk_intl',
            name: 'সাধারণ জ্ঞান (আন্তর্জাতিক)',
            icon: Globe,
            color: 'text-cyan-600 dark:text-cyan-400',
            bg: 'bg-cyan-500/10 dark:bg-cyan-400/10 border-cyan-200/60 dark:border-cyan-800/40'
        },
    ];

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0B1120] font-sans text-slate-900 dark:text-slate-50 transition-colors duration-300 relative">
            <div className="absolute top-0 left-0 w-full h-[360px] bg-gradient-to-b from-emerald-600/10 via-emerald-500/5 to-transparent dark:from-emerald-900/20 dark:via-emerald-950/10 pointer-events-none"></div>

            {isProfileOpen && currentUser && (
                <div className="fixed inset-0 z-40 bg-slate-900/20 dark:bg-black/40 backdrop-blur-xs" onClick={() => setIsProfileOpen(false)}></div>
            )}

            {/* Navigation Bar */}
            <nav className="sticky top-0 z-50 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/80 dark:bg-[#0B1120]/80 backdrop-blur-xl transition-all">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 items-center justify-between">
                        <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-all group">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg shadow-emerald-500/25 group-hover:scale-105 transition-transform">
                                <Stethoscope size={22} className="text-white" />
                            </div>
                            <div>
                                <span className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white block leading-none">
                                    ADQ<span className="text-emerald-600 dark:text-emerald-400">Live</span>
                                </span>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Medical Portal</span>
                            </div>
                        </Link>

                        <div className="flex items-center gap-2.5 sm:gap-4 relative">
                            {/* Analysis Top Bar Link */}
                            <Link 
                                href="/analysis" 
                                onClick={handleFeatureClick}
                                className="p-2.5 rounded-full text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors relative" 
                                title="অ্যানালাইসিস ড্যাশবোর্ড"
                            >
                                <BarChart3 size={20} />
                            </Link>

                            <button onClick={handleFeatureClick} className="p-2.5 rounded-full text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-colors relative" title="Leaderboard">
                                <Trophy size={20} />
                            </button>

                            <button onClick={toggleTheme} className="p-2.5 rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors">
                                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                            </button>

                            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block"></div>

                            <div className="relative z-50">
                                {currentUser ? (
                                    <>
                                        <button
                                            onClick={() => setIsProfileOpen(!isProfileOpen)}
                                            className="flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 pr-4 transition-all hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                        >
                                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400">
                                                <User size={14} />
                                            </div>
                                            <span className="text-sm font-semibold hidden sm:block text-slate-700 dark:text-slate-300">
                                                {currentUser.displayName || 'My Profile'}
                                            </span>
                                        </button>

                                        {isProfileOpen && (
                                            <div className="absolute top-12 right-0 w-80 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6 mt-2 transform origin-top-right transition-all">
                                                <div className="flex justify-between items-start mb-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                                                    <div>
                                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{currentUser.displayName || 'Student'}</h3>
                                                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                            <Mail size={12} /> {currentUser.email}
                                                        </div>
                                                    </div>
                                                    <button onClick={() => setIsProfileOpen(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-500 transition-colors">
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3 mb-6">
                                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl text-center">
                                                        <div className="text-xs text-slate-500 mb-1">মোট স্টাডি</div>
                                                        <div className="font-bold text-emerald-600 dark:text-emerald-400">{formatTotalStudy(totalStudySeconds)}</div>
                                                    </div>
                                                    <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl text-center">
                                                        <div className="text-xs text-slate-500 mb-1">মোট স্কোর</div>
                                                        <div className="font-bold text-orange-600 dark:text-orange-400">{totalScore}</div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={handleLogout}
                                                    className="w-full py-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-sm transition-all hover:bg-rose-100 dark:hover:bg-rose-500/20 flex items-center justify-center gap-2 border border-rose-100 dark:border-rose-500/20"
                                                >
                                                    <LogOut size={16} /> লগআউট করুন
                                                </button>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <Link href="/login" className="flex items-center gap-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 text-sm font-bold shadow-md shadow-emerald-600/20 transition-all">
                                        <User size={16} /> লগইন করুন
                                    </Link>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="relative z-10 mx-auto max-w-7xl px-4 pt-8 pb-20 sm:px-6 lg:px-8">
                {/* Main Feature Cards Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4 mb-10">
                    <Link href="/qbank?category=medical" onClick={handleFeatureClick} className="group relative overflow-hidden flex flex-col items-center justify-center gap-3 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 p-5 sm:p-6 text-white shadow-lg shadow-emerald-600/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-600/30">
                        <Stethoscope size={30} className="opacity-90 group-hover:scale-110 transition-transform" />
                        <span className="font-bold text-center text-xs sm:text-sm">MCQ প্র্যাকটিস</span>
                    </Link>

                    <Link href="/model-test?category=medical" onClick={handleFeatureClick} className="group flex flex-col items-center justify-center gap-3 rounded-2xl bg-white dark:bg-slate-800/80 p-5 sm:p-6 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/60 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-blue-400 hover:shadow-md">
                        <Activity size={30} className="text-blue-500 opacity-90 group-hover:scale-110 transition-transform" />
                        <span className="font-bold text-center text-xs sm:text-sm">মডেল টেস্ট</span>
                    </Link>

                    <Link href="/analysis" onClick={handleFeatureClick} className="group flex flex-col items-center justify-center gap-3 rounded-2xl bg-white dark:bg-slate-800/80 p-5 sm:p-6 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/60 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400 hover:shadow-md">
                        <BarChart3 size={30} className="text-emerald-500 opacity-90 group-hover:scale-110 transition-transform" />
                        <span className="font-bold text-center text-xs sm:text-sm">অ্যানালাইসিস</span>
                    </Link>

                    <Link href="/mistakes?category=medical" onClick={handleFeatureClick} className="group relative flex flex-col items-center justify-center gap-3 rounded-2xl bg-white dark:bg-slate-800/80 p-5 sm:p-6 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/60 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-orange-400 hover:shadow-md">
                        {mistakeCount > 0 && (
                            <span className="absolute top-2.5 right-2.5 min-w-[20px] h-[20px] px-1 flex items-center justify-center rounded-full bg-orange-500 text-white text-[10px] font-bold shadow-xs">
                                {mistakeCount}
                            </span>
                        )}
                        <History size={30} className="text-orange-500 opacity-90 group-hover:scale-110 transition-transform" />
                        <span className="font-bold text-center text-xs sm:text-sm">ভুল প্রশ্ন ব্যাংক</span>
                    </Link>

                    <Link href="/bookmarks?category=medical" onClick={handleFeatureClick} className="group relative flex flex-col items-center justify-center gap-3 rounded-2xl bg-white dark:bg-slate-800/80 p-5 sm:p-6 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/60 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-purple-400 hover:shadow-md col-span-2 sm:col-span-1">
                        {bookmarkCount > 0 && (
                            <span className="absolute top-2.5 right-2.5 min-w-[20px] h-[20px] px-1 flex items-center justify-center rounded-full bg-purple-500 text-white text-[10px] font-bold shadow-xs">
                                {bookmarkCount}
                            </span>
                        )}
                        <Bookmark size={30} className="text-purple-500 opacity-90 group-hover:scale-110 transition-transform" />
                        <span className="font-bold text-center text-xs sm:text-sm">বুকমার্কস</span>
                    </Link>
                </div>

                {/* Section Title */}
                <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2.5 tracking-tight">
                        <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                            <BookOpen size={22} />
                        </div>
                        বিষয়ভিত্তিক প্রস্তুতি
                    </h2>
                </div>

                {/* Subject Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
                    {medicalSubjects.map((subject) => {
                        const Icon = subject.icon;
                        return (
                            <Link
                                key={subject.id}
                                href={`/qbank?category=medical&subject=${subject.id}`}
                                onClick={handleFeatureClick}
                                className="group relative rounded-3xl bg-white dark:bg-slate-800/60 p-6 border border-slate-200/70 dark:border-slate-700/60 shadow-xs transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-emerald-500/5 hover:border-emerald-400/60 dark:hover:border-emerald-500/50 block backdrop-blur-sm"
                            >
                                <div className="flex items-center justify-between mb-5">
                                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${subject.bg} ${subject.color} shadow-xs group-hover:scale-105 transition-transform duration-300`}>
                                        <Icon size={24} />
                                    </div>
                                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700/60 text-slate-400 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300 shadow-xs">
                                        <ChevronRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                        {subject.name}
                                    </h3>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </main>
        </div>
    );
}