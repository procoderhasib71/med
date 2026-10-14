'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Bookmark, Lightbulb, CheckCircle2 } from 'lucide-react';
import { doc, writeBatch, arrayRemove } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth, monitoredGetDoc as getDoc } from '@/lib/firebase';
import { fetchQuestionsByIds, Question } from '../qbank/actions';
import RenderTextOrMath from '../components/RenderTextOrMath';

export default function BookmarksPage() {
    const router = useRouter();
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);
    const [uid, setUid] = useState<string | null>(null);

    useEffect(() => {
        // ১. লোকাল ক্যাশ থেকে আগে ইনস্ট্যান্ট লোড (০ রিড)
        if (typeof window !== 'undefined') {
            const cached = localStorage.getItem('user_bookmarks_questions');
            if (cached) {
                try {
                    setQuestions(JSON.parse(cached));
                    setLoading(false);
                } catch {
                    localStorage.removeItem('user_bookmarks_questions');
                }
            }
        }

        const unsubAuth = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                router.push('/login');
                return;
            }
            setUid(user.uid);

            try {
                // ২. 🔥 ফায়ারস্টোর রিড লগ
                const userRef = doc(db, 'users', user.uid);
                console.log(`🔥 [FIRESTORE READ: 1 Doc] | Path: users/${user.uid} (Fetching Bookmarks)`);
                const snap = await getDoc(userRef);
                const data = snap.data();
                const bookmarkIds: string[] = Array.isArray(data?.bookmarks) ? data.bookmarks : [];

                if (bookmarkIds.length === 0) {
                    setQuestions([]);
                    if (typeof window !== 'undefined') localStorage.removeItem('user_bookmarks_questions');
                    setLoading(false);
                    return;
                }

                // ৩. প্রশ্ন ডেটাবেজ (Turso) থেকে আনা
                const fetchedQuestions = await fetchQuestionsByIds(bookmarkIds);
                setQuestions(fetchedQuestions);

                if (typeof window !== 'undefined') {
                    localStorage.setItem('user_bookmarks_questions', JSON.stringify(fetchedQuestions));
                }
            } catch (error) {
                console.error("Bookmarks load error:", error);
            } finally {
                setLoading(false);
            }
        });

        return () => unsubAuth();
    }, [router]);

    // বুকমার্ক রিমুভ ও ফায়ারস্টোর রাইট লগ
    const removeBookmark = async (questionId: string) => {
        if (!uid) return;

        // লোকাল স্টেট থেকে সাথে সাথে রিমুভ
        const updatedQuestions = questions.filter(q => String(q.id) !== String(questionId));
        setQuestions(updatedQuestions);

        if (typeof window !== 'undefined') {
            localStorage.setItem('user_bookmarks_questions', JSON.stringify(updatedQuestions));
        }

        try {
            const startTime = Date.now();
            const batch = writeBatch(db);
            batch.set(doc(db, 'users', uid), { bookmarks: arrayRemove(questionId) }, { merge: true });
            await batch.commit();

            // ✍️ ফায়ারস্টোর রাইট লগ
            console.log(`✍️ [FIRESTORE WRITE: 1 Doc] | Removed Bookmark: ${questionId} (${Date.now() - startTime}ms)`);
        } catch (e) {
            console.error('Error removing bookmark:', e);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0B1120] pb-20">
            <nav className="sticky top-0 z-50 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/70 dark:bg-[#0B1120]/70 backdrop-blur-xl">
                <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => router.back()}
                                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                            >
                                <ArrowLeft size={18} />
                            </button>
                            <div>
                                <span className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                                    বুকমার্কস 🔖
                                </span>
                                <span className="block text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                    মোট সংরক্ষিত: {questions.length} টি
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="max-w-4xl mx-auto px-4 pt-6 space-y-4 sm:space-y-5">
                {loading ? (
                    <div className="flex justify-center py-24">
                        <Loader2 className="animate-spin text-emerald-600 dark:text-emerald-400" size={32} />
                    </div>
                ) : questions.length === 0 ? (
                    <div className="bg-white dark:bg-slate-800/50 p-10 text-center rounded-3xl shadow-xs border border-slate-200/60 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 text-sm">
                        কোনো প্রশ্ন বুকমার্ক করা হয়নি।
                    </div>
                ) : (
                    questions.map((q, index) => {
                        const options = { a: q.option_a, b: q.option_b, c: q.option_c, d: q.option_d };
                        const questionTag = q.tag && q.tag.trim() !== '' ? q.tag : q.source;

                        return (
                            <div
                                key={q.id}
                                className="bg-white dark:bg-[#0f172a] border border-slate-200/90 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xs transition-all hover:border-slate-300 dark:hover:border-slate-700"
                            >
                                {/* হেডার: কাউন্ট, সাবজেক্ট ব্যাজ, Turso Tag এবং বুকমার্ক রিমুভ বাটন */}
                                <div className="flex items-center justify-between gap-2 mb-3.5 pb-2.5 border-b border-slate-100 dark:border-slate-800/80">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center justify-center">
                                            {index + 1}
                                        </span>

                                        {q.subject && (
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs font-bold border border-emerald-200/50 dark:border-emerald-800/40">
                                                {q.subject}
                                            </span>
                                        )}

                                        {/* 🏷️ Turso Tag ব্যাজ (DU, MAT, DAT ইত্যাদি) */}
                                        {questionTag && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-extrabold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20">
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

                                {/* প্রশ্ন */}
                                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-snug mb-4">
                                    <RenderTextOrMath text={q.question} />
                                </h2>

                                {/* অপশন গ্রিড (২ কলাম) */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 mb-4">
                                    {Object.entries(options).map(([key, value], optIndex) => {
                                        const optionLabel = ['A', 'B', 'C', 'D'][optIndex];
                                        const isCorrect = key.toLowerCase() === q.correct_option?.toLowerCase();

                                        let cardBg = "bg-slate-50/60 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-200";
                                        let badgeStyle = "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700";

                                        if (isCorrect) {
                                            cardBg = "bg-emerald-500/10 border-emerald-500 text-emerald-950 dark:text-emerald-100 font-bold shadow-xs";
                                            badgeStyle = "bg-emerald-600 text-white border-emerald-600";
                                        }

                                        return (
                                            <div
                                                key={key}
                                                className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${cardBg}`}
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <span className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 transition-colors ${badgeStyle}`}>
                                                        {optionLabel}
                                                    </span>
                                                    <span className="text-sm font-semibold truncate">
                                                        <RenderTextOrMath text={value} />
                                                    </span>
                                                </div>

                                                {isCorrect && (
                                                    <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 ml-2" />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* ব্যাখ্যা (Explanation) */}
                                {q.explanation && q.explanation.trim() !== '' && (
                                    <div className="mt-2.5 sm:mt-3 p-3 sm:p-4 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/40 rounded-2xl">
                                        <div className="flex items-start gap-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                            <Lightbulb size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                            <div>
                                                <span className="font-bold text-emerald-800 dark:text-emerald-300 mr-1">ব্যাখ্যা:</span>
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