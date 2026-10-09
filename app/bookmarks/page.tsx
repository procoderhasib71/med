'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Bookmark } from 'lucide-react';
import { doc, onSnapshot, writeBatch, arrayRemove } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import { fetchQuestionsByIds, Question } from '../qbank/actions';
import RenderTextOrMath from '../components/RenderTextOrMath';

export default function BookmarksPage() {
    const router = useRouter();
    const [bookmarkIds, setBookmarkIds] = useState<string[]>([]);
    const [questions, setQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);
    const [uid, setUid] = useState<string | null>(null);

    useEffect(() => {
        const unsubAuth = onAuthStateChanged(auth, (user) => {
            if (!user) {
                router.push('/login');
                return;
            }
            setUid(user.uid);
            const userRef = doc(db, 'users', user.uid);
            const unsubDoc = onSnapshot(userRef, (snap) => {
                const data = snap.data();
                setBookmarkIds(Array.isArray(data?.bookmarks) ? data.bookmarks : []);
            });
            return () => unsubDoc();
        });
        return () => unsubAuth();
    }, [router]);

    useEffect(() => {
        let isMounted = true;
        const load = async () => {
            setLoading(true);
            if (bookmarkIds.length === 0) {
                setQuestions([]);
                setLoading(false);
                return;
            }
            const data = await fetchQuestionsByIds(bookmarkIds);
            if (isMounted) {
                setQuestions(data);
                setLoading(false);
            }
        };
        load();
        return () => { isMounted = false; };
    }, [bookmarkIds]);

    const removeBookmark = async (questionId: string) => {
        if (!uid) return;
        setQuestions(prev => prev.filter(q => q.id !== questionId));
        try {
            const batch = writeBatch(db);
            batch.set(doc(db, 'users', uid), { bookmarks: arrayRemove(questionId) }, { merge: true });
            await batch.commit();
        } catch (e) {
            console.error('Error removing bookmark:', e);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0B1120] pb-20">
            <nav className="sticky top-0 z-50 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/70 dark:bg-[#0B1120]/70 backdrop-blur-xl">
                <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
                    <div className="flex h-16 items-center gap-3">
                        <button onClick={() => router.back()} className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                            <ArrowLeft size={18} />
                        </button>
                        <span className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                            বুকমার্কস
                        </span>
                    </div>
                </div>
            </nav>

            <main className="max-w-4xl mx-auto px-4 pt-8 space-y-6">
                {loading ? (
                    <div className="flex justify-center py-16">
                        <Loader2 className="animate-spin text-blue-600 dark:text-blue-400" size={32} />
                    </div>
                ) : questions.length === 0 ? (
                    <div className="bg-white dark:bg-slate-800/50 p-10 text-center rounded-3xl shadow-sm border border-slate-200/60 dark:border-slate-700/50 text-slate-500 dark:text-slate-400">
                        কোনো প্রশ্ন বুকমার্ক করা হয়নি।
                    </div>
                ) : (
                    questions.map((q, index) => {
                        const options = { a: q.option_a, b: q.option_b, c: q.option_c, d: q.option_d };
                        return (
                            <div key={q.id} className="bg-white dark:bg-slate-800/50 p-5 md:p-8 rounded-3xl shadow-sm border border-slate-200/60 dark:border-slate-700/50 relative">
                                <button
                                    onClick={() => removeBookmark(q.id)}
                                    className="absolute top-5 right-5 md:top-8 md:right-8 p-2 rounded-full text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors"
                                    title="বুকমার্ক সরান"
                                >
                                    <Bookmark size={20} fill="currentColor" />
                                </button>

                                <div className="mb-6 flex items-start gap-2.5 pr-8">
                                    <span className="font-bold text-slate-800 dark:text-slate-200 text-base md:text-lg shrink-0 mt-[1px]">
                                        {index + 1}.
                                    </span>
                                    <div className="text-base md:text-lg font-semibold text-slate-900 dark:text-white leading-relaxed">
                                        <RenderTextOrMath text={q.question} />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {Object.entries(options).map(([key, value], optIndex) => {
                                        const optionLabel = ['A', 'B', 'C', 'D'][optIndex];
                                        const isCorrect = key === q.correct_option;
                                        return (
                                            <div
                                                key={key}
                                                className={`p-3.5 md:p-4 border rounded-2xl flex items-center gap-3.5 ${isCorrect ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' : 'border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40'}`}
                                            >
                                                <span className="font-bold text-slate-600 dark:text-slate-400 text-sm md:text-base shrink-0">
                                                    {optionLabel}.
                                                </span>
                                                <span className="text-slate-800 dark:text-slate-200 text-sm md:text-[15px]">
                                                    <RenderTextOrMath text={value} />
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="mt-6 p-4 md:p-5 bg-blue-50/70 dark:bg-blue-950/20 border-l-4 border-blue-600 dark:border-blue-500 rounded-r-2xl">
                                    <span className="font-bold text-blue-700 dark:text-blue-400">ব্যাখ্যা: </span>
                                    <RenderTextOrMath text={q.explanation} />
                                </div>
                            </div>
                        );
                    })
                )}
            </main>
        </div>
    );
}