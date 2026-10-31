'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Bookmark, Lightbulb, CheckCircle2, RotateCcw } from 'lucide-react';
import { getMe, setBookmark } from '@/lib/siteApi';
import { onAuthStateChanged } from '@/lib/session';
import { session as auth } from '@/lib/session';
import { fetchQuestionsByIds, Question } from '../qbank/actions';
import RenderTextOrMath from '../components/RenderTextOrMath';

export default function BookmarksPage() {
    const router = useRouter();
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);
    const [uid, setUid] = useState<string | null>(null);

    // Portal stats local storage cache sync
    const syncPortalCache = (count: number) => {
        if (typeof window === 'undefined') return;
        try {
            const cached = localStorage.getItem('user_portal_stats');
            if (cached) {
                const parsed = JSON.parse(cached);
                parsed.bookmarkCount = count;
                localStorage.setItem('user_portal_stats', JSON.stringify(parsed));
            }
        } catch { }
    };

    useEffect(() => {
        const unsubAuth = onAuthStateChanged(auth, (user) => {
            if (!user) {
                router.push('/login');
                return;
            }
            setUid(user.uid);

            (async () => {
                let data: { bookmarks?: string[] } = {};
                try {
                    data = await getMe();
                } catch (err) {
                    console.error('Bookmarks load error:', err);
                    setLoading(false);
                    return;
                }
                const rawBookmarks = data?.bookmarks;
                const bookmarkIds: string[] = Array.isArray(rawBookmarks)
                    ? rawBookmarks.map((id: any) => String(id).trim()).filter(Boolean)
                    : [];

                syncPortalCache(bookmarkIds.length);

                if (bookmarkIds.length === 0) {
                    setQuestions([]);
                    if (typeof window !== 'undefined') {
                        localStorage.removeItem('user_bookmarks_questions');
                    }
                    setLoading(false);
                    return;
                }

                try {
                    // Turso theke question fetch
                    let fetchedQuestions: Question[] = [];
                    try {
                        fetchedQuestions = await fetchQuestionsByIds(bookmarkIds);
                    } catch (err) {
                        console.error("Turso server action error:", err);
                    }

                    // Fallback to API route if server action returns empty
                    if (!fetchedQuestions || fetchedQuestions.length === 0) {
                        try {
                            const res = await fetch(`/api/model-test/questions?ids=${encodeURIComponent(bookmarkIds.join(','))}`);
                            const resData = await res.json();
                            if (resData.success && Array.isArray(resData.questions)) {
                                fetchedQuestions = resData.questions;
                            }
                        } catch (apiErr) {
                            console.error("API route error:", apiErr);
                        }
                    }

                    const validList = (fetchedQuestions || []).filter(
                        (q) => q && (q.question || q.option_a || q.correct_option)
                    );

                    setQuestions(validList);

                    if (typeof window !== 'undefined') {
                        localStorage.setItem('user_bookmarks_questions', JSON.stringify(validList));
                    }
                } catch (fetchErr) {
                    console.error("Questions load error:", fetchErr);
                } finally {
                    setLoading(false);
                }
            })();
        });

        return () => unsubAuth();
    }, [router]);

    // Bookmark remove handler
    const removeBookmark = async (questionId: string) => {
        if (!uid) return;

        const updated = questions.filter((q) => String(q.id) !== String(questionId));
        setQuestions(updated);
        syncPortalCache(updated.length);

        if (typeof window !== 'undefined') {
            localStorage.setItem('user_bookmarks_questions', JSON.stringify(updated));
        }

        try {
            await setBookmark(questionId, false);
        } catch (e) {
            console.error('Error removing bookmark:', e);
        }
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 font-sans pb-20">
            {/* Top Navigation */}
            <nav className="relative border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-[#0B1120]/80 backdrop-blur-md">
                <div className="mx-auto max-w-4xl px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.back()}
                            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <div>
                            <span className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                                বুকমার্কস 🔖
                            </span>
                            <span className="block text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                মোট সংরক্ষিত: {questions.length} টি
                            </span>
                        </div>
                    </div>

                    <button
                        onClick={() => window.location.reload()}
                        className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors cursor-pointer"
                        title="Reload"
                    >
                        <RotateCcw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </nav>

            {/* Main Content */}
            <main className="max-w-4xl mx-auto px-4 pt-6 space-y-5">
                {loading ? (
                    <div className="py-24 flex flex-col items-center justify-center text-slate-400">
                        <Loader2 className="animate-spin text-purple-600 dark:text-purple-400 mb-2" size={32} />
                        <span className="text-xs font-semibold text-slate-500">বুকমার্ক লোড হচ্ছে...</span>
                    </div>
                ) : questions.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 p-12 text-center rounded-[28px] border border-slate-200/80 dark:border-slate-800 shadow-xs text-slate-500 dark:text-slate-400 text-sm">
                        কোনো প্রশ্ন বুকমার্ক করা হয়নি।
                    </div>
                ) : (
                    questions.map((q, index) => {
                        const optionList = [
                            { key: 'a', label: 'A', text: q.option_a },
                            { key: 'b', label: 'B', text: q.option_b },
                            { key: 'c', label: 'C', text: q.option_c },
                            { key: 'd', label: 'D', text: q.option_d },
                        ].filter(opt => opt.text && String(opt.text).trim() !== '');

                        const questionTag = q.tag && q.tag.trim() !== '' ? q.tag : q.source;

                        return (
                            <div
                                key={q.id || index}
                                className="bg-white dark:bg-[#111827] border border-slate-200/80 dark:border-slate-800 rounded-[28px] p-5 sm:p-7 shadow-[0_2px_12px_rgba(0,0,0,0.03)] transition-all hover:border-slate-300 dark:hover:border-slate-700"
                            >
                                {/* Header: Serial, Subject Pill, Author/Tag Pill, Bookmark Remove button */}
                                <div className="flex items-center justify-between gap-2 mb-4">
                                    <div className="flex items-center gap-2.5 flex-wrap">
                                        <span className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center justify-center">
                                            {index + 1}
                                        </span>

                                        {q.subject && (
                                            <span className="inline-flex items-center px-3 py-1 rounded-xl bg-[#E8F8F0] dark:bg-emerald-950/40 text-[#059669] dark:text-emerald-400 text-xs font-bold border border-[#C5ECD8] dark:border-emerald-800/40">
                                                {q.subject}
                                            </span>
                                        )}

                                        {questionTag && (
                                            <span className="inline-flex items-center px-3 py-1 rounded-xl text-xs font-bold bg-[#EEF2FF] dark:bg-indigo-950/40 text-[#4F46E5] dark:text-indigo-400 border border-[#D5DEFF] dark:border-indigo-900/40">
                                                {questionTag}
                                            </span>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => removeBookmark(String(q.id))}
                                        className="p-1.5 rounded-xl text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors cursor-pointer"
                                        title="বুকমার্ক সরান"
                                    >
                                        <Bookmark size={18} fill="currentColor" />
                                    </button>
                                </div>

                                {/* Question Title */}
                                <h2 className="text-[16px] sm:text-[17px] font-bold text-slate-800 dark:text-slate-100 leading-relaxed mb-5">
                                    <RenderTextOrMath text={q.question || ''} />
                                </h2>

                                {/* Options Grid: Circular badges and green highlight matching the screenshot */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                                    {optionList.map((opt) => {
                                        const isCorrect = opt.key === (q.correct_option || '').trim().toLowerCase();

                                        let cardStyle = "bg-[#FCFDFF] dark:bg-slate-900/50 border-slate-200/90 dark:border-slate-800 text-slate-700 dark:text-slate-200";
                                        let badgeStyle = "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700";

                                        if (isCorrect) {
                                            cardStyle = "bg-[#ECFDF5] dark:bg-emerald-950/30 border-[#10B981] text-slate-900 dark:text-emerald-100 font-medium";
                                            badgeStyle = "bg-[#059669] text-white border-transparent";
                                        }

                                        return (
                                            <div
                                                key={opt.key}
                                                className={`flex items-center justify-between px-4 py-3 rounded-2xl border transition-all ${cardStyle}`}
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <span className={`w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shrink-0 transition-colors ${badgeStyle}`}>
                                                        {opt.label}
                                                    </span>
                                                    <span className="text-[14px] leading-normal font-medium truncate">
                                                        <RenderTextOrMath text={opt.text} />
                                                    </span>
                                                </div>

                                                {isCorrect && (
                                                    <CheckCircle2 size={18} className="text-[#059669] dark:text-emerald-400 shrink-0 ml-2" />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Explanation */}
                                {q.explanation && q.explanation.trim() !== '' && (
                                    <div className="mt-3 p-3.5 sm:p-4 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 rounded-2xl">
                                        <div className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                            <Lightbulb size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                            <div>
                                                <span className="font-bold text-emerald-800 dark:text-emerald-300 mr-1.5">ব্যাখ্যা:</span>
                                                <RenderTextOrMath text={q.explanation} />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </main>
        </div>
    );
}