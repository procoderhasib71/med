'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, Clock, HelpCircle, AlertCircle, Play,
    Loader2, ChevronLeft, ChevronRight, Compass,
    RotateCcw, CheckCircle2, Timer, Eye, Hourglass
} from 'lucide-react';
import { getExamResults, getMe, listModelTests } from '@/lib/siteApi';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface ModelTestItem {
    id: string;
    title: string;
    subject: string;
    duration_minutes: number;
    total_marks: number;
    negative_marking: number;
    total_questions: number;
    is_live?: boolean;
    is_archive?: boolean;
    type?: string;
    start_time?: any;
    end_time?: any;
    result_published?: boolean; // অ্যাডমিন অনুমোদন দিলে true হবে
}

interface UserExamResult {
    score: number;
    totalMarks: number;
    correct: number;
    wrong: number;
    submittedAt?: number;
}

export default function ModelTestPortalPage() {
    const router = useRouter();

    const [exams, setExams] = useState<ModelTestItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'all' | 'live' | 'archive'>('all');

    // ইউজারের অংশগ্রহণের রেকর্ড ও রেজাল্ট হিস্ট্রি
    const [attemptedExamIds, setAttemptedExamIds] = useState<Set<string>>(new Set());
    const [userExamResults, setUserExamResults] = useState<Record<string, UserExamResult>>({});

    const [currentTime, setCurrentTime] = useState<number>(Date.now());
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 6;

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    // ১. ইউজারের পরীক্ষা ও রেজাল্ট হিস্ট্রি লোড
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                const attemptedSet = new Set<string>();
                const resultsMap: Record<string, UserExamResult> = {};

                // লোকাল ক্যাশ
                if (typeof window !== 'undefined') {
                    try {
                        const local = JSON.parse(localStorage.getItem(`attempted_exams_${user.uid}`) || '[]');
                        if (Array.isArray(local)) local.forEach(id => attemptedSet.add(String(id)));
                    } catch { }
                }

                // ইউজার ডকুমেন্ট
                try {
                    const me = await getMe();
                    me.completed_exams.forEach((id) => attemptedSet.add(String(id)));
                } catch (e) { }

                // রেজাল্ট সাবকালেকশন
                try {
                    const results = await getExamResults();
                    Object.entries(results).forEach(([id, rData]) => {
                        attemptedSet.add(id);
                        resultsMap[id] = {
                            score: rData.score ?? 0,
                            totalMarks: rData.totalMarks ?? 0,
                            correct: rData.correct ?? 0,
                            wrong: rData.wrong ?? 0,
                            submittedAt: rData.submittedAt
                        };
                    });
                } catch (e) { }

                setAttemptedExamIds(attemptedSet);
                setUserExamResults(resultsMap);
            }
        });
        return () => unsubscribe();
    }, []);

    // ২. ফায়ারস্টোর থেকে মডেল টেস্টগুলো আনা
    useEffect(() => {
        async function fetchExamsFromFirestore() {
            try {
                setLoading(true);
                const tests = await listModelTests(50);

                const list: ModelTestItem[] = [];
                tests.forEach((data) => {
                    const questionsArr = Array.isArray(data.questions) ? data.questions : [];
                    const isLive = Boolean(data.is_live || data.type === 'live');

                    list.push({
                        id: String(data.id),
                        title: data.title || 'মডেল টেস্ট',
                        subject: data.subject || 'সমন্বিত',
                        duration_minutes: Number(data.duration_minutes) || 25,
                        total_marks: Number(data.total_marks) || questionsArr.length || 0,
                        negative_marking: Number(data.negative_marking) || 0.25,
                        total_questions: Number(data.total_questions) || questionsArr.length || 0,
                        is_live: isLive,
                        is_archive: Boolean(data.is_archive ?? (!isLive)),
                        type: data.type || (isLive ? 'live' : 'archive'),
                        start_time: data.start_time,
                        end_time: data.end_time,
                        result_published: Boolean(data.result_published)
                    });
                });

                setExams(list);
            } catch (err) {
                console.error("Fetch model tests error:", err);
            } finally {
                setLoading(false);
            }
        }

        fetchExamsFromFirestore();
    }, []);

    const parseTime = (timeVal: any): number | null => {
        if (!timeVal) return null;
        if (typeof timeVal?.toMillis === 'function') return timeVal.toMillis();
        if (typeof timeVal === 'number') return timeVal;
        const parsed = new Date(timeVal).getTime();
        return isNaN(parsed) ? null : parsed;
    };

    const getLiveStatus = (exam: ModelTestItem) => {
        if (!exam.is_live) return { status: 'ARCHIVE', label: 'আর্কাইভ', remainingText: '' };

        const startMs = parseTime(exam.start_time);
        const endMs = parseTime(exam.end_time);

        if (!startMs && !endMs) {
            return { status: 'RUNNING', label: 'লাইভ চলছে', remainingText: '' };
        }

        if (startMs && currentTime < startMs) {
            const diffSec = Math.floor((startMs - currentTime) / 1000);
            const hours = Math.floor(diffSec / 3600);
            const minutes = Math.floor((diffSec % 3600) / 60);
            const seconds = diffSec % 60;
            const timeStr = hours > 0 ? `${hours} ঘণ্টা ${minutes} মিনিট` : `${minutes} মি. ${seconds} সে.`;
            return { status: 'UPCOMING', label: 'আসন্ন লাইভ', remainingText: `শুরু হতে বাকি: ${timeStr}` };
        }

        if (endMs && currentTime <= endMs) {
            const diffSec = Math.floor((endMs - currentTime) / 1000);
            const hours = Math.floor(diffSec / 3600);
            const minutes = Math.floor((diffSec % 3600) / 60);
            const seconds = diffSec % 60;
            const timeStr = hours > 0 ? `${hours} ঘণ্টা ${minutes} মিনিট` : `${minutes} মি. ${seconds} সে.`;
            return { status: 'RUNNING', label: 'লাইভ চলছে', remainingText: `শেষ হতে বাকি: ${timeStr}` };
        }

        return { status: 'ENDED', label: 'সময় সমাপ্ত', remainingText: 'লাইভ সময় সমাপ্ত' };
    };

    // 🎯 ফিল্টারিং:
    // লাইভ ট্যাব: শুধুমাত্র যেসব লাইভ টেস্ট এখনও দেয়নি এবং সময় চলছে/আসন্ন
    const liveExams = exams.filter(exam => {
        if (!exam.is_live) return false;
        if (attemptedExamIds.has(exam.id)) return false; // দিলে আর লাইভে থাকবে না
        const { status } = getLiveStatus(exam);
        return status === 'RUNNING' || status === 'UPCOMING';
    });

    // আর্কাইভ ট্যাব: সাধারণ টেস্ট + দেওয়া লাইভ টেস্ট + সময় শেষ হওয়া লাইভ টেস্ট
    const archiveExams = exams.filter(exam => {
        if (!exam.is_live) return true;
        const { status } = getLiveStatus(exam);
        return attemptedExamIds.has(exam.id) || status === 'ENDED' || exam.is_archive;
    });

    const filteredExams = exams.filter((exam) => {
        const isAttempted = attemptedExamIds.has(exam.id);
        const { status } = getLiveStatus(exam);

        if (activeTab === 'live') {
            return exam.is_live && !isAttempted && (status === 'RUNNING' || status === 'UPCOMING');
        }
        if (activeTab === 'archive') {
            return !exam.is_live || isAttempted || status === 'ENDED' || exam.is_archive;
        }
        return true;
    });

    const totalPages = Math.ceil(filteredExams.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentExams = filteredExams.slice(startIndex, startIndex + itemsPerPage);

    const handleTabChange = (tab: 'all' | 'live' | 'archive') => {
        setActiveTab(tab);
        setCurrentPage(1);
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 font-sans pb-20">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-black/[0.05] dark:border-white/[0.06] bg-white/85 dark:bg-[#0B1120]/85 backdrop-blur-md">
                <div className="mx-auto max-w-2xl px-4 h-14 flex items-center justify-between">
                    <button
                        onClick={() => router.push('/')}
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                    >
                        <ArrowLeft size={16} />
                        <span>হোমে ফিরুন</span>
                    </button>

                    <h1 className="text-sm font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#059669] animate-pulse"></span>
                        মডেল টেস্ট পোর্টাল
                    </h1>

                    <div className="w-16" />
                </div>
            </header>

            <main className="mx-auto max-w-2xl px-4 pt-4">
                {/* Filter Tabs */}
                <div className="flex bg-slate-200/70 dark:bg-slate-800/80 p-1 rounded-2xl mb-5 border border-slate-300/40 dark:border-slate-700/60 shadow-xs">
                    <button
                        onClick={() => handleTabChange('all')}
                        className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${activeTab === 'all'
                            ? 'bg-white dark:bg-[#1E293B] text-slate-900 dark:text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                            }`}
                    >
                        সবগুলো ({exams.length})
                    </button>

                    <button
                        onClick={() => handleTabChange('live')}
                        className={`flex-1 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${activeTab === 'live'
                            ? 'bg-white dark:bg-[#1E293B] text-rose-600 dark:text-rose-400 shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-rose-500'
                            }`}
                    >
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                        </span>
                        <span>লাইভ এক্সাম ({liveExams.length})</span>
                    </button>

                    <button
                        onClick={() => handleTabChange('archive')}
                        className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${activeTab === 'archive'
                            ? 'bg-white dark:bg-[#1E293B] text-slate-900 dark:text-white shadow-xs'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                            }`}
                    >
                        আর্কাইভ ({archiveExams.length})
                    </button>
                </div>

                {loading ? (
                    <div className="py-24 flex flex-col items-center justify-center text-slate-400">
                        <Loader2 className="w-8 h-8 animate-spin text-[#059669] mb-2.5" />
                        <span className="text-xs font-bold">মডেল টেস্ট লোড হচ্ছে...</span>
                    </div>
                ) : filteredExams.length === 0 ? (
                    <div className="text-center py-16 bg-white dark:bg-[#1E293B] rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-[#059669] flex items-center justify-center mx-auto mb-3">
                            <Compass size={24} />
                        </div>
                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white mb-1">
                            {activeTab === 'live'
                                ? 'বর্তমানে কোনো লাইভ পরীক্ষা উপলব্ধ নেই!'
                                : 'বর্তমানে কোনো মডেল টেস্ট পাওয়া যায়নি!'}
                        </h3>
                        <p className="text-xs text-slate-400 max-w-xs mx-auto">
                            {activeTab === 'live'
                                ? 'আপনি ইতিমধ্যে লাইভ পরীক্ষায় অংশ নিয়েছেন অথবা নির্ধারিত সময় পার হয়ে গেছে। আর্কাইভ থেকে যেকোনো সময় প্র্যাকটিস করতে পারেন।'
                                : 'নতুন মডেল টেস্ট যুক্ত হলে এখানে দেখতে পাবেন।'}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="space-y-3.5 mb-6">
                            {currentExams.map((test) => {
                                const isAttempted = attemptedExamIds.has(test.id);
                                const qCount = test.total_questions || test.total_marks;
                                const { status, remainingText } = getLiveStatus(test);
                                const result = userExamResults[test.id];

                                // লাইভ এক্সামের ফলাফল অ্যাডমিন প্রকাশ করেছে কি না
                                const isResultApproved = test.is_live ? Boolean(test.result_published) : true;

                                return (
                                    <div
                                        key={test.id}
                                        className="p-4 sm:p-5 rounded-[22px] bg-white dark:bg-[#1E293B] border border-[#E8EEF5] dark:border-[#334155] shadow-xs hover:border-[#059669]/50 transition-all"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                {/* স্ট্যাটাস ব্যাজ */}
                                                {!isAttempted && test.is_live && status === 'RUNNING' ? (
                                                    <span className="flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/60 uppercase tracking-wider">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                                                        LIVE RUNNING
                                                    </span>
                                                ) : !isAttempted && test.is_live && status === 'UPCOMING' ? (
                                                    <span className="flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/60 uppercase tracking-wider">
                                                        <Timer size={11} /> UPCOMING
                                                    </span>
                                                ) : isAttempted && test.is_live && !isResultApproved ? (
                                                    <span className="flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200/60">
                                                        <Hourglass size={11} className="animate-spin" /> ফলাফল অপেক্ষমাণ
                                                    </span>
                                                ) : isAttempted ? (
                                                    <span className="flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-[#059669] border border-emerald-200/60 uppercase tracking-wider">
                                                        <CheckCircle2 size={11} /> সম্পন্ন {result ? `(${result.score}/${test.total_marks})` : ''}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 uppercase tracking-wider">
                                                        ARCHIVE
                                                    </span>
                                                )}

                                                {/* রিয়েলটাইম বাকি সময় */}
                                                {!isAttempted && test.is_live && remainingText && (
                                                    <span className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400">
                                                        • {remainingText}
                                                    </span>
                                                )}
                                            </div>

                                            <span className="text-[11px] font-bold text-slate-400">
                                                {test.subject || 'মেডিকেল সিলেবাস'}
                                            </span>
                                        </div>

                                        <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white mb-1 leading-snug">
                                            {test.title}
                                        </h3>

                                        <p className="text-[11px] text-slate-400 mb-3.5">
                                            {isAttempted && test.is_live && !isResultApproved
                                                ? 'আপনি পরীক্ষা সম্পন্ন করেছেন। লাইভ পরীক্ষার সময় শেষে অ্যাডমিন ফলাফল অনুমোদন করলে আপনার স্কোর দেখতে পাবেন।'
                                                : isAttempted
                                                    ? `আপনি পরীক্ষাটি সম্পন্ন করেছেন। আপনার প্রাপ্ত নম্বর: ${result?.score ?? 0} / ${test.total_marks}`
                                                    : test.is_live && status === 'UPCOMING'
                                                        ? 'নির্ধারিত সময়ে লাইভ পরীক্ষা শুরু হবে। প্রস্তুতি নিয়ে প্রস্তুত থাকুন।'
                                                        : 'সর্বোচ্চ কমন উপযোগী প্রশ্ন ব্যাংক ভিত্তিক ফাইনাল টেস্ট'}
                                        </p>

                                        <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-4 pb-3.5 border-b border-slate-100 dark:border-slate-800">
                                            <div className="flex items-center gap-1">
                                                <HelpCircle size={14} className="text-slate-400" />
                                                <span>{qCount} টি প্রশ্ন</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Clock size={14} className="text-slate-400" />
                                                <span>{test.duration_minutes} মিনিট</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-rose-500 font-bold">
                                                <AlertCircle size={14} />
                                                <span>-{test.negative_marking || 0.25}</span>
                                            </div>
                                        </div>

                                        {/* অ্যাকশন বাটন লজিক */}
                                        {test.is_live && !isAttempted && status === 'UPCOMING' ? (
                                            <div className="w-full py-2.5 rounded-[14px] bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 cursor-not-allowed">
                                                <Timer size={14} />
                                                <span>পরীক্ষা শুরু হতে বাকি</span>
                                            </div>
                                        ) : isAttempted && test.is_live && !isResultApproved ? (
                                            <div className="w-full py-2.5 rounded-[14px] bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-900/40 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2">
                                                <Hourglass size={14} className="animate-pulse" />
                                                <span>ফলাফল অনুমোদনের অপেক্ষায়...</span>
                                            </div>
                                        ) : isAttempted ? (
                                            <div className="grid grid-cols-2 gap-2">
                                                {/* ছাত্রের দাগানো উত্তর ও সমাধান রিভিউ বাটন */}
                                                <Link
                                                    href={`/model-test/exam?testId=${encodeURIComponent(test.id)}&title=${encodeURIComponent(test.title)}&mode=review`}
                                                    className="py-2.5 rounded-[14px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                                                >
                                                    <Eye size={14} />
                                                    <span>খাতা ও সমাধান</span>
                                                </Link>

                                                {/* আনলিমিটেড রিটেক প্র্যাকটিস বাটন */}
                                                <Link
                                                    href={`/model-test/exam?testId=${encodeURIComponent(test.id)}&title=${encodeURIComponent(test.title)}&duration=${test.duration_minutes}&mode=retake`}
                                                    className="py-2.5 rounded-[14px] bg-[#059669] hover:bg-emerald-700 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer"
                                                >
                                                    <RotateCcw size={14} />
                                                    <span>রিটেক প্র্যাকটিস</span>
                                                </Link>
                                            </div>
                                        ) : (
                                            <Link
                                                href={`/model-test/exam?testId=${encodeURIComponent(test.id)}&title=${encodeURIComponent(test.title)}&duration=${test.duration_minutes}`}
                                                className={`w-full py-2.5 rounded-[14px] text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.99] ${test.is_live && status === 'RUNNING'
                                                        ? 'bg-rose-600 hover:bg-rose-700'
                                                        : 'bg-[#059669] hover:bg-emerald-700'
                                                    }`}
                                            >
                                                <Play size={14} fill="currentColor" />
                                                <span>{test.is_live ? 'লাইভ পরীক্ষা শুরু করুন' : 'পরীক্ষা শুরু করুন'}</span>
                                            </Link>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {totalPages > 1 && (
                            <div className="flex items-center justify-between px-2 pt-2">
                                <button
                                    onClick={() => {
                                        setCurrentPage((prev) => Math.max(prev - 1, 1));
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    disabled={currentPage === 1}
                                    className={`flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800 transition-colors ${currentPage === 1
                                        ? 'opacity-40 cursor-not-allowed text-slate-400'
                                        : 'bg-white dark:bg-[#1E293B] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-xs cursor-pointer'
                                        }`}
                                >
                                    <ChevronLeft size={16} /> আগেরটি
                                </button>

                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                    পৃষ্ঠা <span className="text-[#059669] font-black">{currentPage}</span> / {totalPages}
                                </span>

                                <button
                                    onClick={() => {
                                        setCurrentPage((prev) => Math.min(prev + 1, totalPages));
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    disabled={currentPage === totalPages}
                                    className={`flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800 transition-colors ${currentPage === totalPages
                                        ? 'opacity-40 cursor-not-allowed text-slate-400'
                                        : 'bg-white dark:bg-[#1E293B] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-xs cursor-pointer'
                                        }`}
                                >
                                    পরেরটি <ChevronRight size={16} />
                                </button>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}