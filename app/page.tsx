'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    Stethoscope, Activity, RefreshCw, Bookmark, BookOpen,
    Radio, Clock, HelpCircle, Users, Zap, FileText,
    ArrowDown, Play, Moon, Sun, User, Trophy, BarChart3,
    Timer, X, LogOut, Mail, ChevronRight, AlertCircle, Loader2
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { doc, getDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { db, auth } from '../lib/firebase';

interface ModelTestItem {
    id: string;
    title: string;
    subject: string;
    duration_minutes: number;
    total_marks: number;
    negative_marking: number;
    total_questions: number;
}

export default function MedicalPortal() {
    const router = useRouter();
    const { isDarkMode, toggleTheme } = useTheme();

    const [currentUser, setCurrentUser] = useState<any>(null);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [totalStudySeconds, setTotalStudySeconds] = useState(0);
    const [totalScore, setTotalScore] = useState(0);
    const [mistakeCount, setMistakeCount] = useState(0);
    const [bookmarkCount, setBookmarkCount] = useState(0);

    const [recentModelTests, setRecentModelTests] = useState<ModelTestItem[]>([]);
    const [loadingTests, setLoadingTests] = useState(true);

    const syncUserData = async (uid: string) => {
        try {
            // ১. ইউজার প্রোফাইল ডাটা লোড (স্কোর ও বুকমার্ক)
            const userRef = doc(db, 'users', uid);
            const userSnap = await getDoc(userRef).catch(() => null);

            let score = 0;
            let studySec = 0;
            let bookmarks = 0;

            if (userSnap && userSnap.exists()) {
                const data = userSnap.data();
                studySec = data.totalStudySeconds || 0;
                score = Number((data.totalScore || 0).toFixed(2));
                bookmarks = Array.isArray(data.bookmarks) ? data.bookmarks.length : 0;
            }

            // ২. ভুল প্রশ্ন সংখ্যা: users/{uid}/stats/mistakes ডকুমেন্টের items ম্যাপ থেকে
            let mistakes = 0;
            try {
                const mistakeRef = doc(db, 'users', uid, 'stats', 'mistakes');
                const mistakeSnap = await getDoc(mistakeRef);
                if (mistakeSnap.exists()) {
                    const mData = mistakeSnap.data();
                    if (mData.items && typeof mData.items === 'object') {
                        mistakes = Object.keys(mData.items).length;
                    }
                }
            } catch (err) {
                console.error("Mistakes count fetch error:", err);
            }

            setTotalStudySeconds(studySec);
            setTotalScore(score);
            setMistakeCount(mistakes);
            setBookmarkCount(bookmarks);

            localStorage.setItem(
                'user_portal_stats',
                JSON.stringify({
                    totalStudySeconds: studySec,
                    totalScore: score,
                    mistakeCount: mistakes,
                    bookmarkCount: bookmarks,
                })
            );
        } catch (e: any) {
            console.error('Sync error:', e.message);
        }
    };

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
                syncUserData(user.uid);
            } else {
                setCurrentUser(null);
                setTotalStudySeconds(0);
                setTotalScore(0);
                setMistakeCount(0);
                setBookmarkCount(0);
                localStorage.removeItem('user_portal_stats');
            }
        });

        // ফায়ারস্টোর থেকে লেটেস্ট ৩টি মডেল টেস্ট সরাসরি লোড
        async function fetchTests() {
            try {
                setLoadingTests(true);
                const q = query(collection(db, 'model_tests'), orderBy('createdAt', 'desc'), limit(3));
                const snap = await getDocs(q);

                const list: ModelTestItem[] = [];
                snap.forEach((docSnap) => {
                    const data = docSnap.data();
                    const questionsArr = Array.isArray(data.questions) ? data.questions : [];
                    list.push({
                        id: docSnap.id,
                        title: data.title || 'মডেল টেস্ট',
                        subject: data.subject || 'সমন্বিত',
                        duration_minutes: Number(data.duration_minutes) || 25,
                        total_marks: Number(data.total_marks) || questionsArr.length || 0,
                        negative_marking: Number(data.negative_marking) || 0.25,
                        total_questions: Number(data.total_questions) || questionsArr.length || 0,
                    });
                });

                setRecentModelTests(list);
            } catch (err) {
                console.error("Failed to fetch model tests from Firestore:", err);
            } finally {
                setLoadingTests(false);
            }
        }
        fetchTests();

        return () => unsubscribeAuth();
    }, []);

    const handleLogout = async () => {
        try {
            await signOut(auth).catch(() => null);
            localStorage.removeItem('user_portal_stats');
            const isLive = window.location.hostname.includes('adqlive.com');
            const domainStr = isLive ? 'domain=.adqlive.com;' : 'domain=localhost;';
            document.cookie = `auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; ${domainStr}`;
            setCurrentUser(null);
            setIsProfileOpen(false);
            window.location.reload();
        } catch (error) {
            console.error('Logout error:', error);
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
        { id: 'botany', name: 'উদ্ভিদবিজ্ঞান', color: '#10B981', bgColor: '#E6F8F0' },
        { id: 'zoology', name: 'প্রাণিবিজ্ঞান', color: '#14B8A6', bgColor: '#E6F9F7' },
        { id: 'chem1', name: 'রসায়ন ১ম পত্র', color: '#F59E0B', bgColor: '#FFF7E6' },
        { id: 'chem2', name: 'রসায়ন ২য় পত্র', color: '#F97316', bgColor: '#FFF1EB' },
        { id: 'phys1', name: 'পদার্থবিজ্ঞান ১ম পত্র', color: '#3B82F6', bgColor: '#EDF4FF' },
        { id: 'phys2', name: 'পদার্থবিজ্ঞান ২য় পত্র', color: '#6366F1', bgColor: '#EEF0FF' },
        { id: 'english', name: 'ইংরেজি', color: '#A855F7', bgColor: '#F7EDFF' },
        { id: 'gk_bd', name: 'সাধারণ জ্ঞান (বাংলাদেশ)', color: '#F43F5E', bgColor: '#FFEBF0' },
        { id: 'gk_intl', name: 'সাধারণ জ্ঞান (আন্তর্জাতিক)', color: '#06B6D4', bgColor: '#E6F9FC' },
        { id: 'human', name: 'মানবিক গুণাবলি', color: '#EC4899', bgColor: '#FDEBF5' },
    ];

    const pdfResources = [
        { id: '1', title: 'কোষ ও কোষের গঠন - শর্ট ডাইজেস্ট', subject: 'উদ্ভিদবিজ্ঞান', size: '2.4 MB', pages: '12 Pages' },
        { id: '2', title: 'রক্ত ও সংবহনতন্ত্র - হাই-ইল্ড নোট', subject: 'প্রাণিবিজ্ঞান', size: '3.1 MB', pages: '18 Pages' },
        { id: '3', title: 'পরিমাণগত রসায়ন - ফর্মুলা শিট', subject: 'রসায়ন ২য় পত্র', size: '1.8 MB', pages: '08 Pages' },
    ];

    const classList = [
        { id: 'v1', title: 'হাইড্রা ও ঘাসফড়িং স্পেশাল মাস্টারক্লাস', duration: '১ ঘণ্টা ১৫ মিনিট', mentor: 'ডা. আসিফ', tag: 'প্রাণিবিজ্ঞান' },
        { id: 'v2', title: 'নিউক্লিয়ার ফিজিক্স - শর্টকাট টেকনিক', duration: '৪৫ মিনিট', mentor: 'ইঞ্জি. হাসিব', tag: 'পদার্থ ২য়' },
    ];

    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 font-sans transition-colors relative selection:bg-emerald-500 selection:text-white">

            {/* Profile Modal Overlay */}
            {isProfileOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4"
                    onClick={() => setIsProfileOpen(false)}
                >
                    <div
                        className="w-full max-w-sm rounded-[24px] bg-white dark:bg-slate-900 p-5 shadow-2xl border border-slate-100 dark:border-slate-800"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
                            <div className="truncate pr-2">
                                <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                                    {currentUser?.displayName || currentUser?.name || 'Doctor Candidate'}
                                </h3>
                                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    <Mail size={13} />
                                    <span className="truncate">{currentUser?.email || 'N/A'}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsProfileOpen(false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-4">
                            <div className="bg-[#F8FAFC] dark:bg-[#0B1120] p-3 rounded-xl text-center">
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">মোট স্টাডি</div>
                                <div className="font-extrabold text-sm text-[#059669]">{formatTotalStudy(totalStudySeconds)}</div>
                            </div>
                            <div className="bg-[#F8FAFC] dark:bg-[#0B1120] p-3 rounded-xl text-center">
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">মোট স্কোর</div>
                                <div className="font-extrabold text-sm text-[#EA580C]">{totalScore}</div>
                            </div>
                        </div>

                        <button
                            onClick={handleLogout}
                            className="w-full py-3 rounded-xl bg-[#FFF1F2] dark:bg-rose-950/30 text-[#E11D48] dark:text-rose-400 font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors cursor-pointer"
                        >
                            <LogOut size={16} /> লগআউট করুন
                        </button>
                    </div>
                </div>
            )}

            {/* Top Header */}
            <header className="sticky top-0 z-40 w-full border-b border-black/[0.04] dark:border-white/[0.06] bg-white/80 dark:bg-[#0B1120]/80 backdrop-blur-md">
                <div className="mx-auto max-w-2xl px-4 sm:px-6">
                    <div className="flex h-[52px] items-center justify-between">
                        <Link href="/" className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-[#059669] text-white shadow-xs">
                                <Stethoscope size={15} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[16.5px] font-black leading-none tracking-tight text-slate-900 dark:text-white">
                                    ADQ<span className="text-[#059669]">Live</span>
                                </span>
                                <span className="text-[8px] font-extrabold tracking-widest text-[#64748B] uppercase">MEDICAL PORTAL</span>
                            </div>
                        </Link>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={toggleTheme}
                                className="p-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                                {isDarkMode ? <Sun size={19} className="text-[#FBBF24]" /> : <Moon size={19} className="text-slate-600" />}
                            </button>

                            {!currentUser && (
                                <Link
                                    href="/login"
                                    className="flex items-center gap-1 bg-[#059669] hover:bg-emerald-700 text-white px-2.5 py-1 rounded-[14px] text-[11px] font-bold shadow-xs transition-colors"
                                >
                                    <User size={12} />
                                    <span>লগইন</span>
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="mx-auto max-w-2xl px-4 sm:px-6 pt-3 pb-28">

                {/* Quick Feature Grid */}
                <div className="grid grid-cols-2 gap-2.5 mb-5">
                    <Link
                        href="/qbank"
                        onClick={handleFeatureClick}
                        className="flex flex-col items-center justify-center py-4 rounded-[20px] bg-[#059669] hover:bg-emerald-700 text-white shadow-xs transition-all gap-1.5"
                    >
                        <Stethoscope size={24} />
                        <span className="text-[12.5px] font-extrabold text-white">MCQ প্র্যাকটিস</span>
                    </Link>

                    <Link
                        href="/model-test"
                        onClick={handleFeatureClick}
                        className="flex flex-col items-center justify-center py-4 rounded-[20px] bg-white dark:bg-[#1E293B] border border-[#E8EEF5] dark:border-[#334155] hover:border-blue-400 transition-all gap-1.5 shadow-xs"
                    >
                        <Activity size={26} className="text-[#3B82F6]" />
                        <span className="text-[12.5px] font-bold text-slate-900 dark:text-white">মডেল টেস্ট</span>
                    </Link>

                    <Link
                        href="/mistakes"
                        onClick={handleFeatureClick}
                        className="relative flex flex-col items-center justify-center py-4 rounded-[20px] bg-white dark:bg-[#1E293B] border border-[#E8EEF5] dark:border-[#334155] hover:border-orange-400 transition-all gap-1.5 shadow-xs"
                    >
                        {mistakeCount > 0 && (
                            <span className="absolute top-2 right-2.5 bg-[#F97316] text-white text-[9.5px] font-bold px-1.5 h-[18px] min-w-[18px] rounded-full flex items-center justify-center">
                                {mistakeCount}
                            </span>
                        )}
                        <RefreshCw size={26} className="text-[#F97316]" />
                        <span className="text-[12.5px] font-bold text-slate-900 dark:text-white">ভুল প্রশ্ন ব্যাংক</span>
                    </Link>

                    <Link
                        href="/bookmarks"
                        onClick={handleFeatureClick}
                        className="relative flex flex-col items-center justify-center py-4 rounded-[20px] bg-white dark:bg-[#1E293B] border border-[#E8EEF5] dark:border-[#334155] hover:border-purple-400 transition-all gap-1.5 shadow-xs"
                    >
                        {bookmarkCount > 0 && (
                            <span className="absolute top-2 right-2.5 bg-[#A855F7] text-white text-[9.5px] font-bold px-1.5 h-[18px] min-w-[18px] rounded-full flex items-center justify-center">
                                {bookmarkCount}
                            </span>
                        )}
                        <Bookmark size={25} className="text-[#A855F7]" />
                        <span className="text-[12.5px] font-bold text-slate-900 dark:text-white">বুকমার্কস</span>
                    </Link>
                </div>

                {/* Subject Grid Section */}
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-[8px] bg-[#D1FAE5] dark:bg-emerald-950/60 flex items-center justify-center text-[#059669]">
                        <BookOpen size={16} />
                    </div>
                    <h2 className="text-[16px] font-black text-slate-900 dark:text-white">বিষয়ভিত্তিক প্রস্তুতি</h2>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-6">
                    {medicalSubjects.map((sub) => (
                        <Link
                            key={sub.id}
                            href={`/qbank?category=medical&subject=${encodeURIComponent(sub.name)}`}
                            onClick={handleFeatureClick}
                            className="flex items-center gap-2 p-2.5 min-h-[56px] rounded-[18px] bg-white dark:bg-[#1E293B] border border-[#E8EEF5] dark:border-[#334155] hover:border-[#059669]/50 transition-all shadow-xs"
                        >
                            <div
                                className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
                                style={{ backgroundColor: isDarkMode ? `${sub.color}25` : sub.bgColor }}
                            >
                                <BookOpen size={17} style={{ color: sub.color }} />
                            </div>
                            <span className="text-[12px] font-extrabold text-slate-900 dark:text-white truncate">
                                {sub.name}
                            </span>
                        </Link>
                    ))}
                </div>

                {/* Live Exam Section */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-[8px] bg-[#FEE2E2] dark:bg-rose-950/50 flex items-center justify-center text-[#DC2626]">
                            <Radio size={16} />
                        </div>
                        <h2 className="text-[16px] font-black text-slate-900 dark:text-white">লাইভ এক্সাম পোর্টাল</h2>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-[10px] bg-[#FEE2E2] dark:bg-rose-950/50 text-[#DC2626]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626] animate-pulse"></span>
                        <span className="text-[9.5px] font-black tracking-wider uppercase">LIVE</span>
                    </div>
                </div>

                <div className="rounded-[20px] bg-white dark:bg-[#1E293B] border border-[#E8EEF5] dark:border-[#334155] p-4 mb-6 shadow-xs">
                    <div className="mb-2">
                        <span className="text-[11px] font-bold text-[#DC2626] block">মেডিকেল ডেইলি মক টেস্ট #০৭</span>
                        <h3 className="text-[14.5px] font-black text-slate-900 dark:text-white mt-0.5 truncate">
                            সম্পূর্ণ বোটানি ও জুলজি পেপার টেস্ট
                        </h3>
                    </div>

                    <div className="flex items-center gap-3.5 mb-3.5 text-[11.5px] font-semibold text-[#64748B] dark:text-slate-400">
                        <div className="flex items-center gap-1">
                            <Clock size={14} />
                            <span>সময়: ৪৫ মিনিট</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <HelpCircle size={14} />
                            <span>প্রশ্ন: ৫০টি</span>
                        </div>
                        <div className="flex items-center gap-1 text-[#059669] font-bold">
                            <Users size={14} />
                            <span>১৮৫ জন যুক্ত</span>
                        </div>
                    </div>

                    <Link
                        href="/model-test"
                        onClick={handleFeatureClick}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-[14px] bg-[#DC2626] hover:bg-red-700 text-white text-[13px] font-extrabold shadow-xs transition-colors"
                    >
                        <Zap size={15} />
                        <span>অংশগ্রহণ করুন</span>
                    </Link>
                </div>

                {/* Model Tests Section (Directly from Firestore) */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-[8px] bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600">
                            <Activity size={16} />
                        </div>
                        <h2 className="text-[16px] font-black text-slate-900 dark:text-white">লেটেস্ট মডেল টেস্ট</h2>
                    </div>
                    <Link
                        href="/model-test"
                        className="flex items-center gap-1 text-xs font-bold text-[#059669] hover:underline"
                    >
                        <span>সবগুলো দেখুন</span>
                        <ChevronRight size={14} />
                    </Link>
                </div>

                <div className="space-y-3 mb-6">
                    {loadingTests ? (
                        <div className="py-8 flex items-center justify-center gap-2 text-slate-400 text-xs">
                            <Loader2 size={16} className="animate-spin text-[#059669]" />
                            <span>মডেল টেস্ট লোড হচ্ছে...</span>
                        </div>
                    ) : recentModelTests.length === 0 ? (
                        <div className="p-4 rounded-[18px] bg-white dark:bg-[#1E293B] border border-dashed border-slate-300 dark:border-slate-700 text-center">
                            <p className="text-xs text-slate-400 mb-2">এখনো কোনো কাস্টম মডেল টেস্ট তৈরি করা হয়নি।</p>
                            <Link
                                href="/admin/create-exam"
                                className="text-xs font-bold text-[#059669] hover:underline"
                            >
                                + এখনই নতুন টেস্ট বানান
                            </Link>
                        </div>
                    ) : (
                        recentModelTests.map((test) => (
                            <div
                                key={test.id}
                                className="p-4 rounded-[18px] bg-white dark:bg-[#1E293B] border border-[#E8EEF5] dark:border-[#334155] shadow-xs flex items-center justify-between gap-3 hover:border-[#059669]/40 transition-all"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-[#059669]">
                                            {test.subject || 'সমন্বিত'}
                                        </span>
                                        <span className="text-[10px] text-slate-400">
                                            {test.duration_minutes} মিনিট
                                        </span>
                                    </div>
                                    <h4 className="text-[13.5px] font-extrabold text-slate-900 dark:text-white truncate">
                                        {test.title}
                                    </h4>
                                    <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                        <span>প্রশ্ন: {test.total_questions || test.total_marks}টি</span>
                                        <span className="text-rose-500 font-bold">-{test.negative_marking || 0.25}</span>
                                    </div>
                                </div>

                                <Link
                                    href={`/model-test/exam?testId=${encodeURIComponent(test.id)}&title=${encodeURIComponent(test.title)}&duration=${test.duration_minutes}`}
                                    className="px-3.5 py-2 rounded-xl bg-[#059669] hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 shadow-xs"
                                >
                                    <Play size={12} fill="currentColor" />
                                    <span>শুরু</span>
                                </Link>
                            </div>
                        ))
                    )}
                </div>

                {/* PDF Notes Section */}
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-[8px] bg-[#E0E7FF] dark:bg-indigo-950/50 flex items-center justify-center text-[#4F46E5]">
                        <FileText size={16} />
                    </div>
                    <h2 className="text-[16px] font-black text-slate-900 dark:text-white">লেকচার শিট ও PDF নোট</h2>
                </div>

                <div className="space-y-2 mb-6">
                    {pdfResources.map((pdf) => (
                        <div
                            key={pdf.id}
                            className="flex items-center justify-between p-3 rounded-[16px] bg-white dark:bg-[#1E293B] border border-[#E8EEF5] dark:border-[#334155] shadow-xs hover:border-slate-300 transition-all"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-[38px] h-[38px] rounded-[12px] bg-[#FEE2E2] dark:bg-rose-950/40 flex items-center justify-center text-[#DC2626] shrink-0">
                                    <FileText size={20} />
                                </div>
                                <div className="truncate">
                                    <h4 className="text-[13px] font-extrabold text-slate-900 dark:text-white truncate">
                                        {pdf.title}
                                    </h4>
                                    <p className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400 mt-0.5">
                                        {pdf.subject} • {pdf.pages} • {pdf.size}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => alert(`${pdf.title} ডাউনলোড প্রক্রিয়া শুরু হচ্ছে...`)}
                                className="w-[30px] h-[30px] rounded-full bg-[#E6F8F0] dark:bg-emerald-950/60 text-[#059669] flex items-center justify-center shrink-0 hover:scale-105 transition-transform ml-2 cursor-pointer"
                            >
                                <ArrowDown size={15} />
                            </button>
                        </div>
                    ))}
                </div>

                {/* Video Classes Section */}
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-[8px] bg-[#FEF3C7] dark:bg-amber-950/50 flex items-center justify-center text-[#D97706]">
                        <Play size={16} fill="currentColor" />
                    </div>
                    <h2 className="text-[16px] font-black text-slate-900 dark:text-white">ভিডিও ক্লাস ও মাস্টারক্লাস</h2>
                </div>

                <div className="space-y-2 mb-4">
                    {classList.map((cls) => (
                        <div
                            key={cls.id}
                            onClick={() => alert(`${cls.title} ভিডিও প্লেয়ার শীঘ্রই আসছে!`)}
                            className="flex items-center gap-3 p-3 rounded-[16px] bg-white dark:bg-[#1E293B] border border-[#E8EEF5] dark:border-[#334155] shadow-xs cursor-pointer hover:border-amber-400 transition-all"
                        >
                            <div className="w-11 h-11 rounded-[14px] bg-[#D97706] text-white flex items-center justify-center shrink-0">
                                <Play size={20} fill="currentColor" />
                            </div>
                            <div className="truncate flex-1">
                                <span className="inline-block px-1.5 py-0.5 rounded-[6px] bg-[#FEF3C7] dark:bg-amber-950/60 text-[#B45309] dark:text-amber-300 text-[9.5px] font-extrabold mb-0.5">
                                    {cls.tag}
                                </span>
                                <h4 className="text-[13px] font-extrabold text-slate-900 dark:text-white truncate">
                                    {cls.title}
                                </h4>
                                <p className="text-[11px] font-semibold text-[#64748B] dark:text-slate-400">
                                    ইন্সট্রাক্টর: {cls.mentor} • {cls.duration}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

            </main>

            {/* Bottom Nav */}
            <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-black/[0.06] dark:border-white/[0.08] bg-white/85 dark:bg-[#0B1120]/85 backdrop-blur-md">
                <div className="mx-auto max-w-2xl px-2 h-[58px] flex items-center justify-around">
                    <Link href="/" className="flex flex-col items-center justify-center gap-0.5 flex-1 text-[#059669]">
                        <BookOpen size={20} />
                        <span className="text-[9.5px] font-extrabold">হোম</span>
                    </Link>

                    <Link
                        href="/analysis"
                        onClick={handleFeatureClick}
                        className="flex flex-col items-center justify-center gap-0.5 flex-1 text-[#64748B] dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                        <BarChart3 size={20} />
                        <span className="text-[9.5px] font-bold">অ্যানালাইসিস</span>
                    </Link>

                    <button
                        onClick={() => alert('পোমোডোরো টাইমার শীঘ্রই নতুন আপডেটে যুক্ত হবে!')}
                        className="flex flex-col items-center justify-center gap-0.5 flex-1 text-[#EA580C] cursor-pointer"
                    >
                        <div className="w-[26px] h-[26px] rounded-full bg-[#FFEDD5] dark:bg-orange-950/60 flex items-center justify-center mb-0.5">
                            <Timer size={18} />
                        </div>
                        <span className="text-[9.5px] font-extrabold">পোমোডোরো</span>
                    </button>

                    <Link
                        href="/leaderboard"
                        onClick={handleFeatureClick}
                        className="flex flex-col items-center justify-center gap-0.5 flex-1 text-[#64748B] dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                        <Trophy size={20} />
                        <span className="text-[9.5px] font-bold">লিডারবোর্ড</span>
                    </Link>

                    <button
                        onClick={() => {
                            if (currentUser) {
                                setIsProfileOpen(true);
                            } else {
                                router.push('/login');
                            }
                        }}
                        className={`flex flex-col items-center justify-center gap-0.5 flex-1 transition-colors cursor-pointer ${currentUser ? 'text-[#059669]' : 'text-[#64748B] dark:text-slate-400'
                            }`}
                    >
                        <User size={21} />
                        <span className="text-[9.5px] font-bold">{currentUser ? 'প্রোফাইল' : 'লগইন'}</span>
                    </button>
                </div>
            </nav>

        </div>
    );
}