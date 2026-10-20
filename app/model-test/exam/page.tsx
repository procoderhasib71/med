'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
    Clock, AlertCircle, CheckCircle2, XCircle, Award,
    RotateCcw, Home, ArrowLeft, Loader2, Sparkles, Send,
    ShieldAlert, CheckCheck, Eye
} from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, increment, arrayUnion } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import RenderTextOrMath from '@/app/components/RenderTextOrMath';

interface ExamQuestion {
    id: string;
    subject: string;
    chapter?: string;
    question: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    correct_option: string;
    explanation?: string;
    tag?: string;
}

function ExamRunner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const testId = searchParams.get('testId') || '';
    const mode = searchParams.get('mode') || ''; // 'review' | 'retake' | ''

    const [currentUser, setCurrentUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [examInfo, setExamInfo] = useState<any>(null);
    const [questions, setQuestions] = useState<ExamQuestion[]>([]);

    const [answers, setAnswers] = useState<{ [key: string]: string }>({});
    const [timeLeft, setTimeLeft] = useState(25 * 60);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    // 🚨 অ্যান্টি-চিট ও ট্যাব পরিবর্তন স্টেট
    const [tabWarningCount, setTabWarningCount] = useState(0);
    const [showTabWarningModal, setShowTabWarningModal] = useState(false);

    // লাইভ পরীক্ষার সাবমিশন স্ক্রিন স্টেট
    const [liveSubmittedSuccess, setLiveSubmittedSuccess] = useState(false);

    const isSubmittedRef = useRef(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => setCurrentUser(user));
        return () => unsubscribe();
    }, []);

    // ১. এক্সাম ডাটা ও প্রিভিয়াস উত্তর লোড
    useEffect(() => {
        async function loadExam() {
            if (!testId) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const examRef = doc(db, 'model_tests', testId);
                const snap = await getDoc(examRef);

                if (!snap.exists()) {
                    setLoading(false);
                    return;
                }

                const data = snap.data();
                setExamInfo(data);
                const qList = Array.isArray(data.questions) ? data.questions : [];
                setQuestions(qList);

                if (data.duration_minutes) {
                    setTimeLeft(Number(data.duration_minutes) * 60);
                }

                // যদি ইউজার 'review' মোডে আসে (দাগানো উত্তর ও সমাধান দেখার জন্য)
                if (mode === 'review' && auth.currentUser) {
                    const resultRef = doc(db, 'users', auth.currentUser.uid, 'exam_results', testId);
                    const rSnap = await getDoc(resultRef);
                    if (rSnap.exists()) {
                        const rData = rSnap.data();
                        setAnswers(rData.answers || {});
                        setIsSubmitted(true);
                        isSubmittedRef.current = true;
                    }
                }
            } catch (err) {
                console.error('Exam load error:', err);
            } finally {
                setLoading(false);
            }
        }

        loadExam();
    }, [testId, mode]);

    // ২. 🚨 লাইভ এক্সামে ট্যাব পরিবর্তন ডিটেকশন (Anti-Cheat Security)
    useEffect(() => {
        // শুধুমাত্র লাইভ পরীক্ষায় এবং সাবমিট হওয়ার আগ পর্যন্ত কার্যকর
        if (!examInfo?.is_live || isSubmitted || loading || mode === 'review') return;

        const handleVisibilityChange = () => {
            if (document.hidden) {
                setTabWarningCount((prev) => {
                    const nextCount = prev + 1;
                    if (nextCount >= 3) {
                        // ৩ বার ট্যাব বদলালে অটোমেটিক সাবমিট হয়ে যাবে
                        alert('🚨 আপনি বারবার ট্যাব পরিবর্তন করায় আপনার পরীক্ষা স্বয়ংক্রিয়ভাবে জমা করা হলো!');
                        handleFinalSubmit(true);
                    } else {
                        setShowTabWarningModal(true);
                    }
                    return nextCount;
                });
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [examInfo?.is_live, isSubmitted, loading, mode]);

    // ৩. অপশন সিলেক্ট হ্যান্ডলার
    const handleSelectOption = (qId: string, optKey: string) => {
        if (isSubmitted) return;
        setAnswers(prev => ({ ...prev, [qId]: optKey }));
    };

    // ৪. টাইমার হ্যান্ডলার
    useEffect(() => {
        if (loading || isSubmitted || questions.length === 0 || mode === 'review') return;

        if (timeLeft <= 0) {
            handleFinalSubmit();
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    handleFinalSubmit();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [timeLeft, loading, isSubmitted, questions.length, mode]);

    const formatTimer = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    };

    // ৫. সাবমিশন লজিক
    const handleFinalSubmit = async (forced = false) => {
        if (isSubmittedRef.current) return;
        isSubmittedRef.current = true;
        setIsSubmitted(true);
        setShowConfirmModal(false);
        setShowTabWarningModal(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });

        let correct = 0;
        let wrong = 0;
        const mistakeItems: Record<string, { id: string; userAnswer: string; timestamp: number }> = {};
        const negRate = examInfo?.negative_marking || 0.25;

        questions.forEach((q) => {
            const qIdStr = String(q.id);
            const selected = answers[qIdStr];

            if (selected) {
                const isCorrect = selected.toLowerCase() === (q.correct_option || '').trim().toLowerCase();
                if (isCorrect) {
                    correct++;
                } else {
                    wrong++;
                    mistakeItems[qIdStr] = {
                        id: qIdStr,
                        timestamp: Date.now(),
                        userAnswer: selected.toLowerCase(),
                    };
                }
            }
        });

        const finalScore = parseFloat((correct - (wrong * negRate)).toFixed(2));
        const isLive = Boolean(examInfo?.is_live && mode !== 'retake');

        if (currentUser?.uid) {
            const uid = currentUser.uid;
            try {
                // ইউজারের রেজাল্ট সাবকালেকশনে সংরক্ষণ (শিক্ষার্থীর দাগানো উত্তরসহ)
                const resultRef = doc(db, 'users', uid, 'exam_results', testId);
                await setDoc(resultRef, {
                    testId,
                    examTitle: examInfo?.title || 'মডেল টেস্ট',
                    score: finalScore,
                    totalMarks: questions.length,
                    correct,
                    wrong,
                    answers, // দাগানো উত্তর
                    is_live: isLive,
                    submittedAt: Date.now()
                });

                // ইউজারের মূল ডকুমেন্টে সম্পন্ন পরীক্ষার তালিকা যোগ
                const userRef = doc(db, 'users', uid);
                await updateDoc(userRef, {
                    completed_exams: arrayUnion(testId),
                    totalScore: increment(finalScore),
                    totalAttempted: increment(Object.keys(answers).length),
                    totalCorrect: increment(correct),
                });

                // লোকাল স্টোরেজে অংশগ্রহণ চিহ্নিত করা
                const local = JSON.parse(localStorage.getItem(`attempted_exams_${uid}`) || '[]');
                if (!local.includes(testId)) {
                    local.push(testId);
                    localStorage.setItem(`attempted_exams_${uid}`, JSON.stringify(local));
                }

                // ভুল প্রশ্নের ব্যাংকে ভুল উত্তরগুলো সিঙ্ক করা
                if (Object.keys(mistakeItems).length > 0) {
                    const mistakeDocRef = doc(db, 'users', uid, 'stats', 'mistakes');
                    await setDoc(mistakeDocRef, { items: mistakeItems }, { merge: true });
                }
            } catch (e) {
                console.error('Submission sync error:', e);
            }
        }

        // লাইভ এক্সাম হলে রেজাল্ট ব্লক করে কনফার্মেশন স্ক্রিন দেখানো হবে
        if (isLive) {
            setLiveSubmittedSuccess(true);
        }
    };

    const calculateStats = () => {
        let correct = 0;
        let wrong = 0;
        const negRate = examInfo?.negative_marking || 0.25;

        questions.forEach((q) => {
            const selected = answers[String(q.id)];
            if (selected) {
                if (selected.toLowerCase() === (q.correct_option || '').trim().toLowerCase()) {
                    correct++;
                } else {
                    wrong++;
                }
            }
        });

        const negativeMarks = parseFloat((wrong * negRate).toFixed(2));
        const finalScore = Math.max(0, parseFloat((correct - negativeMarks).toFixed(2)));
        const accuracy = correct + wrong > 0 ? Math.round((correct / (correct + wrong)) * 100) : 0;

        return {
            total: questions.length,
            answered: Object.keys(answers).length,
            correct,
            wrong,
            negativeMarks,
            finalScore,
            accuracy,
        };
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
                <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-3" />
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    পরীক্ষা লোড হচ্ছে...
                </p>
            </div>
        );
    }

    // 🎯 লাইভ এক্সাম সাবমিট করার পর রেজাল্ট লুকিয়ে এই সাকসেস স্ক্রিনটি আসবে
    if (liveSubmittedSuccess) {
        return (
            <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] flex items-center justify-center p-4">
                <div className="w-full max-w-md bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center shadow-lg">
                    <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-[#059669] flex items-center justify-center mx-auto mb-4 border border-emerald-200/60 dark:border-emerald-800/40">
                        <CheckCheck size={36} />
                    </div>

                    <h2 className="text-lg font-black text-slate-900 dark:text-white mb-2">
                        লাইভ পরীক্ষা সফলভাবে জমা হয়েছে!
                    </h2>

                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                        আপনার উত্তরপত্র ডাটাবেজে সংরক্ষিত হয়েছে। লাইভ পরীক্ষার সময় শেষ হওয়ার পর এবং <strong>অ্যাডমিন ফলাফল অনুমোদন করলে</strong> আপনার প্রাপ্ত নম্বর, মেরিট লিস্ট ও সঠিক সমাধান আর্কাইভ সেকশনে দেখতে পাবেন।
                    </p>

                    <Link
                        href="/model-test"
                        className="w-full py-3 rounded-xl bg-[#059669] hover:bg-emerald-700 text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 shadow-xs transition-all"
                    >
                        <Home size={15} />
                        <span>মডেল টেস্ট পোর্টালে ফিরুন</span>
                    </Link>
                </div>
            </div>
        );
    }

    const stats = isSubmitted ? calculateStats() : null;

    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#090D16] text-slate-800 dark:text-slate-200 font-sans pb-32">
            {/* 🚨 Anti-Cheat Tab Switch Warning Modal */}
            {showTabWarningModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
                    <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border-2 border-rose-500 text-center animate-bounce">
                        <div className="w-14 h-14 bg-rose-50 dark:bg-rose-950/50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                            <ShieldAlert size={32} />
                        </div>
                        <h3 className="text-base font-black text-slate-900 dark:text-white mb-1.5">
                            সতর্কতা: ট্যাব পরিবর্তন নিষেধ!
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
                            আপনি পরীক্ষা স্ক্রিন ছেড়ে অন্য ট্যাবে গিয়েছিলেন। এটি একটি লাইভ পরীক্ষা। আর <strong>{3 - tabWarningCount} বার</strong> ট্যাব বদলালে আপনার পরীক্ষা স্বয়ংক্রিয়ভাবে বাতিল ও জমা হয়ে যাবে।
                        </p>
                        <button
                            onClick={() => setShowTabWarningModal(false)}
                            className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all cursor-pointer"
                        >
                            বুঝেছি, পরীক্ষা চালিয়ে যান
                        </button>
                    </div>
                </div>
            )}

            {/* Confirm Submit Modal */}
            {showConfirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
                    <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-2.5 mb-3 text-amber-500">
                            <AlertCircle size={22} />
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                খাতা জমা দিতে চান?
                            </h3>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
                            মোট প্রশ্ন: <span className="font-semibold text-slate-800 dark:text-slate-200">{questions.length}</span> |
                            দাগিয়েছেন: <span className="font-semibold text-emerald-600">{Object.keys(answers).length}</span> |
                            বাকি: <span className="font-semibold text-rose-500">{questions.length - Object.keys(answers).length}</span>
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                                ফিরে যান
                            </button>
                            <button
                                onClick={() => handleFinalSubmit()}
                                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                            >
                                হ্যাঁ, জমা দিন
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Top Bar */}
            <header className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-[#090D16]/90 backdrop-blur-md">
                <div className="mx-auto max-w-3xl px-4 h-14 flex items-center justify-between">
                    <button
                        onClick={() => router.back()}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                    >
                        <ArrowLeft size={15} />
                        <span>প্রস্থান</span>
                    </button>

                    {!isSubmitted ? (
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wider ${timeLeft <= 300
                                ? 'bg-rose-50 text-rose-600 border border-rose-200 animate-pulse'
                                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40'
                            }`}>
                            <Clock size={13} />
                            <span>{formatTimer(timeLeft)}</span>
                        </div>
                    ) : (
                        <span className="text-xs font-bold text-emerald-600 inline-flex items-center gap-1">
                            <Sparkles size={14} /> {mode === 'review' ? 'খাতা ও সমাধান রিভিউ' : 'ফলাফল প্রকাশিত'}
                        </span>
                    )}

                    {!isSubmitted ? (
                        <button
                            onClick={() => setShowConfirmModal(true)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-1.5 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                            <span>সাবমিট</span>
                            <span className="bg-emerald-700/60 px-1.5 py-0.5 rounded text-[11px] font-mono">
                                {Object.keys(answers).length}/{questions.length}
                            </span>
                        </button>
                    ) : (
                        <div className="w-12" />
                    )}
                </div>
            </header>

            {/* Main Question Body */}
            <main className="mx-auto max-w-3xl px-4 pt-5">
                {/* সাধারণ/আর্কাইভ প্র্যাকটিসে সাবমিট করার পর ওভারভিউ কার্ড */}
                {isSubmitted && stats && (
                    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 mb-6 shadow-xs">
                        <div className="flex items-center gap-2.5 mb-5 pb-4 border-b border-slate-100 dark:border-slate-800">
                            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600">
                                <Award size={20} />
                            </div>
                            <div>
                                <h2 className="text-sm font-bold text-slate-900 dark:text-white">পরীক্ষার ফলাফল বিবরণী</h2>
                                <p className="text-xs text-slate-400">{examInfo?.title || 'মডেল টেস্ট'}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-center border border-slate-100 dark:border-slate-800">
                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">প্রাপ্ত স্কোর</span>
                                <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{stats.finalScore}</span>
                                <span className="text-[10px] text-slate-400 block mt-0.5">/ {stats.total}</span>
                            </div>
                            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-center border border-slate-100 dark:border-slate-800">
                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">সঠিক উত্তর</span>
                                <span className="text-xl font-bold text-blue-600 dark:text-blue-400">{stats.correct}</span>
                                <span className="text-[10px] text-slate-400 block mt-0.5">টি প্রশ্ন</span>
                            </div>
                            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-center border border-slate-100 dark:border-slate-800">
                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">ভুল উত্তর</span>
                                <span className="text-xl font-bold text-rose-600 dark:text-rose-400">{stats.wrong}</span>
                                <span className="text-[10px] text-rose-500 block mt-0.5">-{stats.negativeMarks}</span>
                            </div>
                            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-center border border-slate-100 dark:border-slate-800">
                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">সঠিকতার হার</span>
                                <span className="text-xl font-bold text-amber-600 dark:text-amber-400">{stats.accuracy}%</span>
                                <span className="text-[10px] text-slate-400 block mt-0.5">Accuracy</span>
                            </div>
                        </div>

                        <div className="flex gap-2.5">
                            <button
                                onClick={() => window.location.reload()}
                                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                <RotateCcw size={14} /> পুনরায় প্র্যাকটিস
                            </button>
                            <Link
                                href="/model-test"
                                className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold text-center transition-colors inline-flex items-center justify-center gap-1.5"
                            >
                                <Home size={14} /> পোর্টালে ফিরুন
                            </Link>
                        </div>
                    </div>
                )}

                {/* প্রশ্ন তালিকা */}
                <div className="space-y-4">
                    {questions.map((q, idx) => {
                        const qIdStr = String(q.id);
                        const selectedAnswer = answers[qIdStr];

                        const optionList = [
                            { key: 'a', label: 'A', text: q.option_a },
                            { key: 'b', label: 'B', text: q.option_b },
                            { key: 'c', label: 'C', text: q.option_c },
                            { key: 'd', label: 'D', text: q.option_d },
                        ];

                        return (
                            <div
                                key={q.id || idx}
                                className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-xs"
                            >
                                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white leading-relaxed mb-4 flex items-start gap-2">
                                    <span className="text-emerald-600 dark:text-emerald-400 font-extrabold shrink-0">
                                        {idx + 1}.
                                    </span>
                                    <span className="flex-1">
                                        <RenderTextOrMath text={q.question} />
                                    </span>
                                </h3>

                                <div className="space-y-2">
                                    {optionList.map((opt) => {
                                        const isSelected = selectedAnswer === opt.key;
                                        const isCorrect = (q.correct_option || '').trim().toLowerCase() === opt.key;

                                        let optClass = 'border-slate-200/90 dark:border-slate-800/90 bg-slate-50/40 dark:bg-slate-800/20 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300';
                                        let badgeClass = 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400';

                                        // সাবমিট বা রিভিউ মোডে দাগানো উত্তর ও সঠিক উত্তর দেখানো
                                        if (isSubmitted) {
                                            if (isCorrect) {
                                                optClass = 'border-emerald-500/80 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 font-medium';
                                                badgeClass = 'bg-emerald-600 border-emerald-600 text-white';
                                            } else if (isSelected && !isCorrect) {
                                                optClass = 'border-rose-500/80 bg-rose-50/50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200';
                                                badgeClass = 'bg-rose-600 border-rose-600 text-white';
                                            }
                                        } else if (isSelected) {
                                            optClass = 'border-emerald-600 bg-emerald-50/40 dark:bg-emerald-950/20 text-slate-900 dark:text-white font-medium ring-1 ring-emerald-600/30';
                                            badgeClass = 'bg-emerald-600 border-emerald-600 text-white';
                                        }

                                        return (
                                            <button
                                                key={opt.key}
                                                disabled={isSubmitted}
                                                onClick={() => handleSelectOption(qIdStr, opt.key)}
                                                className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${optClass}`}
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <span className={`w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shrink-0 border transition-colors ${badgeClass}`}>
                                                        {opt.label}
                                                    </span>
                                                    <span className="text-xs sm:text-sm leading-normal font-medium truncate">
                                                        <RenderTextOrMath text={opt.text} />
                                                    </span>
                                                </div>

                                                {isSubmitted && isCorrect && (
                                                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0 ml-2" />
                                                )}
                                                {isSubmitted && isSelected && !isCorrect && (
                                                    <XCircle size={16} className="text-rose-600 shrink-0 ml-2" />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>

                                {isSubmitted && q.explanation && (
                                    <div className="mt-3.5 p-3.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-xs">
                                        <span className="font-bold text-amber-800 dark:text-amber-400 block mb-0.5">ব্যাখ্যা:</span>
                                        <div className="text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
                                            <RenderTextOrMath text={q.explanation} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {!isSubmitted && (
                    <div className="mt-8 text-center">
                        <button
                            onClick={() => setShowConfirmModal(true)}
                            className="w-full sm:w-auto min-w-[200px] px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
                        >
                            <Send size={14} />
                            <span>খাতা জমা দিন ({Object.keys(answers).length}/{questions.length})</span>
                        </button>
                    </div>
                )}
            </main>
        </div>
    );
}

export default function ModelTestExamPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
                <Loader2 className="animate-spin text-emerald-600" size={26} />
            </div>
        }>
            <ExamRunner />
        </Suspense>
    );
}