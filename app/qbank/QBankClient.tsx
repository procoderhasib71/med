'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Loader2, Moon, Sun, ArrowLeft, Bookmark, Lightbulb, CheckCircle2, XCircle, SlidersHorizontal, RotateCcw, Check } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTheme } from '@/hooks/useTheme';
import { fetchFilteredQuestions } from './actions';
import { doc, writeBatch, increment, arrayRemove, arrayUnion, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import { Question } from './actions';
import RenderTextOrMath from '@/app/components/RenderTextOrMath';

function CustomDropdown({ options, value, onChange, placeholder }: any) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsOpen(false);
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative flex-1 min-w-[140px]" ref={dropdownRef}>
            <div
                className="flex items-center justify-between border border-slate-200/90 dark:border-slate-800 p-2.5 sm:p-3 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 cursor-pointer text-xs sm:text-sm font-medium focus:outline-none min-h-[42px] shadow-xs transition-colors hover:border-slate-300 dark:hover:border-slate-700"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="truncate pr-1.5">{value || placeholder}</span>
                <ChevronDown size={14} className="text-slate-400 shrink-0" />
            </div>

            {isOpen && (
                <div className="absolute z-[100] min-w-full w-max max-w-[90vw] mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl max-h-60 overflow-y-auto p-1 backdrop-blur-md">
                    <div
                        className="px-3 py-2 text-xs sm:text-sm cursor-pointer rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-white font-bold whitespace-nowrap mb-1"
                        onClick={() => { onChange(''); setIsOpen(false); }}
                    >
                        {placeholder}
                    </div>
                    {options.map((opt: string) => (
                        <div
                            key={opt}
                            className={`flex items-center justify-between px-3 py-2 text-xs sm:text-sm rounded-lg cursor-pointer transition-colors whitespace-nowrap ${value === opt ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/70'}`}
                            onClick={() => { onChange(opt); setIsOpen(false); }}
                        >
                            <span>{opt}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function QBankClient({ allMappings = [] }: { allMappings?: any[] }) {
    const { isDarkMode, toggleTheme } = useTheme();
    const searchParams = useSearchParams();
    const router = useRouter();
    const urlSubject = searchParams.get('subject');

    const subjectMapping: Record<string, string> = {
        'botany': 'উদ্ভিদবিজ্ঞান',
        'zoology': 'প্রাণিবিজ্ঞান',
        'chem1': 'রসায়ন ১ম পত্র',
        'chem2': 'রসায়ন ২য় পত্র',
        'phys1': 'পদার্থবিজ্ঞান ১ম পত্র',
        'phys2': 'পদার্থবিজ্ঞান ২য় পত্র',
        'english': 'ইংরেজি',
        'gk_bd': 'সাধারণ জ্ঞান (বাংলাদেশ)',
        'gk_intl': 'সাধারণ জ্ঞান (আন্তর্জাতিক)',
    };

    const initialSubject = urlSubject ? (subjectMapping[urlSubject] || urlSubject) : '';

    const [mode, setMode] = useState<'practice' | 'solve'>('practice');
    const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});

    const [questions, setQuestions] = useState<Question[]>([]);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    const [showAdvanced, setShowAdvanced] = useState(false);
    const [filters, setFilters] = useState({
        subject: initialSubject, 
        chapter: '', 
        topic: '', 
        source: '',
        varsity: '',
        year: ''
    });

    const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
    const [solvedIds, setSolvedIds] = useState<Set<string>>(new Set());

    // ⭐️ Reload safe Auth & Firestore Single Read listener
    useEffect(() => {
        let unsubscribeDoc: (() => void) | null = null;

        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (user) {
                const userRef = doc(db, 'users', user.uid);
                unsubscribeDoc = onSnapshot(userRef, (docSnap) => {
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        setBookmarkedIds(new Set((data.bookmarks || []).map(String)));
                        setSolvedIds(new Set((data.solved || []).map(String)));
                    }
                });
            } else {
                setBookmarkedIds(new Set());
                setSolvedIds(new Set());
                if (unsubscribeDoc) unsubscribeDoc();
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeDoc) unsubscribeDoc();
        };
    }, []);

    const toggleBookmark = async (questionId: string) => {
        const user = auth.currentUser;
        if (!user) {
            router.push('/login');
            return;
        }

        const isBookmarked = bookmarkedIds.has(questionId);
        setBookmarkedIds(prev => {
            const next = new Set(prev);
            if (isBookmarked) next.delete(questionId);
            else next.add(questionId);
            return next;
        });

        try {
            const userRef = doc(db, 'users', user.uid);
            const batch = writeBatch(db);
            batch.set(userRef, {
                bookmarks: isBookmarked ? arrayRemove(questionId) : arrayUnion(questionId)
            }, { merge: true });
            await batch.commit();
        } catch (error) {
            console.error('Error toggling bookmark:', error);
        }
    };

    const availableSubjects = Array.from(new Set(allMappings.map(m => m.subject).filter(Boolean)));
    const availableChapters = Array.from(new Set(allMappings.filter(m => !filters.subject || m.subject === filters.subject).map(m => m.chapter).filter(Boolean)));
    const availableTopics = Array.from(new Set(allMappings.filter(m => (!filters.subject || m.subject === filters.subject) && (!filters.chapter || m.chapter === filters.chapter)).map(m => m.topic).filter(Boolean)));
    const availableSources = Array.from(new Set(allMappings.filter(m => (!filters.subject || m.subject === filters.subject) && (!filters.chapter || m.chapter === filters.chapter) && (!filters.topic || m.topic === filters.topic)).map(m => m.source).filter(Boolean)));

    const varsityList = [
        'Medical', 'Dental', 'DU', 'JU', 'RU', 'CU', 'Agri. Cluster', 'GST', 'BUET', 'CKRUET'
    ];

    const yearList = [
        '23-24', '22-23', '21-22', '20-21', '19-20', '18-19', '17-18', '16-17', '15-16'
    ];

    useEffect(() => {
        let isMounted = true;
        const loadQuestions = async () => {
            setLoading(true);
            const newQuestions = await fetchFilteredQuestions(page, filters);

            if (isMounted) {
                if (newQuestions.length < 10) setHasMore(false);
                else setHasMore(true);

                if (page === 1) setQuestions(newQuestions);
                else setQuestions(prev => [...prev, ...newQuestions]);

                setLoading(false);
            }
        };
        loadQuestions();
        return () => { isMounted = false; };
    }, [page, filters]);

    const handleOptionSelect = async (question: Question, key: string) => {
        if (mode !== 'practice' || selectedAnswers[question.id]) return;

        const qIdStr = String(question.id);
        setSelectedAnswers(p => ({ ...p, [qIdStr]: key }));
        setSolvedIds(prev => new Set(prev).add(qIdStr));

        const user = auth.currentUser;
        if (!user) return;

        const isCorrect = key.toLowerCase() === question.correct_option?.toLowerCase();
        const activeSubject = question.subject || filters.subject || 'সাধারণ';
        const activeChapter = (question as any).chapter || filters.chapter || 'সাধারণ অধ্যায়';

        try {
            const batch = writeBatch(db);

            const userRef = doc(db, 'users', user.uid);
            batch.set(userRef, {
                totalAttempted: increment(1),
                totalCorrect: increment(isCorrect ? 1 : 0),
                totalScore: increment(isCorrect ? 1 : 0),
                solved: arrayUnion(qIdStr)
            }, { merge: true });

            const subjectRef = doc(db, `users/${user.uid}/subject_progress`, activeSubject);
            batch.set(subjectRef, {
                totalAttempted: increment(1),
                correctAnswers: increment(isCorrect ? 1 : 0)
            }, { merge: true });

            const cleanDocId = `${activeSubject}_${activeChapter}`.replace(/[\/\\]/g, '_');
            const chapterRef = doc(db, `users/${user.uid}/chapter_progress`, cleanDocId);
            batch.set(chapterRef, {
                subject: activeSubject,
                chapter: activeChapter,
                totalAttempted: increment(1),
                correctAnswers: increment(isCorrect ? 1 : 0)
            }, { merge: true });

            if (!isCorrect) {
                const optionsMap: Record<string, string> = {
                    a: question.option_a,
                    b: question.option_b,
                    c: question.option_c,
                    d: question.option_d
                };

                const mistakeRef = doc(db, `users/${user.uid}/mistakes`, qIdStr);
                batch.set(mistakeRef, {
                    question: question.question,
                    options: [question.option_a, question.option_b, question.option_c, question.option_d].filter(Boolean),
                    correctAnswer: optionsMap[question.correct_option?.toLowerCase()] || question.correct_option,
                    userAnswer: optionsMap[key.toLowerCase()] || key,
                    explanation: question.explanation || '',
                    subject: activeSubject,
                    chapter: activeChapter,
                    timestamp: serverTimestamp()
                }, { merge: true });
            }

            await batch.commit();
        } catch (err) {
            console.error("Firestore sync error:", err);
        }
    };

    const handleFilterChange = (filterName: string, value: string) => {
        setFilters(prev => {
            const newFilters = { ...prev, [filterName]: value };
            if (filterName === 'subject') { newFilters.chapter = ''; newFilters.topic = ''; }
            else if (filterName === 'chapter') { newFilters.topic = ''; }
            return newFilters;
        });
        setPage(1);
        setQuestions([]);
        setHasMore(true);
    };

    const resetAdvancedFilters = () => {
        setFilters(prev => ({ ...prev, varsity: '', year: '' }));
        setPage(1);
        setQuestions([]);
        setHasMore(true);
    };

    const observer = useRef<IntersectionObserver | null>(null);
    const lastQuestionRef = useCallback((node: HTMLDivElement) => {
        if (loading) return;
        if (observer.current) observer.current.disconnect();

        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                setPage(prev => prev + 1);
            }
        });
        if (node) observer.current.observe(node);
    }, [loading, hasMore]);

    return (
        <div className="min-h-screen bg-slate-100/60 dark:bg-[#0B1120] font-sans text-slate-900 dark:text-slate-50 transition-colors duration-300 pb-20">
            <nav className="sticky top-0 z-50 border-b border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-[#0B1120]/85 backdrop-blur-md">
                <div className="mx-auto max-w-4xl px-3 sm:px-6">
                    <div className="flex h-14 sm:h-16 items-center justify-between">
                        <div className="flex items-center gap-2.5 sm:gap-3">
                            <button onClick={() => router.back()} className="p-1.5 sm:p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                <ArrowLeft size={16} />
                            </button>
                            <span className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                                ADQ<span className="text-emerald-600 dark:text-emerald-400">Live</span> QBank
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            <button onClick={toggleTheme} className="p-2 sm:p-2.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                                {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="max-w-4xl mx-auto px-3 sm:px-6 pt-4 sm:pt-6">
                <div className="flex items-center justify-between gap-2 mb-4">
                    <h1 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">MCQ Question Bank</h1>

                    <div className="flex bg-slate-200/80 dark:bg-slate-800/90 p-1 rounded-xl shadow-xs border border-slate-300/40 dark:border-slate-700/60">
                        <button
                            onClick={() => setMode('practice')}
                            className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-bold text-xs sm:text-sm transition-all ${mode === 'practice' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
                        >
                            Practice
                        </button>
                        <button
                            onClick={() => setMode('solve')}
                            className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-bold text-xs sm:text-sm transition-all ${mode === 'solve' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
                        >
                            Solve
                        </button>
                    </div>
                </div>

                {/* Filters Box */}
                <div className="mb-5 bg-white dark:bg-slate-900/60 p-3 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                        <CustomDropdown options={availableSubjects} value={filters.subject} onChange={(val: string) => handleFilterChange('subject', val)} placeholder="সব বিষয়" />
                        <CustomDropdown options={availableChapters} value={filters.chapter} onChange={(val: string) => handleFilterChange('chapter', val)} placeholder="সব অধ্যায়" />
                        <CustomDropdown options={availableTopics} value={filters.topic} onChange={(val: string) => handleFilterChange('topic', val)} placeholder="সব টপিক" />
                        <CustomDropdown options={availableSources} value={filters.source} onChange={(val: string) => handleFilterChange('source', val)} placeholder="সব উৎস" />
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                        <button
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:opacity-80 flex items-center gap-1.5 cursor-pointer select-none"
                        >
                            <SlidersHorizontal size={13} />
                            <span>{showAdvanced ? 'অ্যাডভান্সড ফিল্টার বন্ধ করুন' : 'অ্যাডভান্সড ফিল্টার (ভার্সিটি ও সাল)'}</span>
                            {(filters.varsity || filters.year) && (
                                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                            )}
                        </button>

                        {(filters.varsity || filters.year) && (
                            <button
                                onClick={resetAdvancedFilters}
                                className="text-[11px] font-semibold text-rose-500 hover:text-rose-600 flex items-center gap-1 cursor-pointer"
                            >
                                <RotateCcw size={12} />
                                রিসেট করুন
                            </button>
                        )}
                    </div>

                    {showAdvanced && (
                        <div className="grid grid-cols-2 gap-2 sm:gap-3 mt-3 pt-1">
                            <CustomDropdown 
                                options={varsityList} 
                                value={filters.varsity} 
                                onChange={(val: string) => handleFilterChange('varsity', val)} 
                                placeholder="সকল ভার্সিটি / মেডিকেল" 
                            />
                            <CustomDropdown 
                                options={yearList} 
                                value={filters.year} 
                                onChange={(val: string) => handleFilterChange('year', val)} 
                                placeholder="সকল শিক্ষাবর্ষ (সাল)" 
                            />
                        </div>
                    )}
                </div>

                {/* Questions List */}
                <div className="space-y-4 sm:space-y-5">
                    {questions.length === 0 && !loading ? (
                        <div className="bg-white dark:bg-slate-900 p-8 text-center rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-sm">
                            কোনো প্রশ্ন পাওয়া যায়নি। ফিল্টার পরিবর্তন করে দেখুন।
                        </div>
                    ) : (
                        questions.map((q, index) => {
                            const qIdStr = String(q.id);
                            const isAnswered = !!selectedAnswers[qIdStr];
                            const selectedOption = selectedAnswers[qIdStr];
                            const questionSuffix = q.tag && q.tag.trim() !== '' ? q.tag : q.source;
                            const options = { a: q.option_a, b: q.option_b, c: q.option_c, d: q.option_d };
                            const isBookmarked = bookmarkedIds.has(qIdStr);
                            const isSolved = solvedIds.has(qIdStr) || isAnswered;
                            const isLastElement = questions.length === index + 1;

                            return (
                                <div
                                    key={q.id}
                                    ref={isLastElement ? lastQuestionRef : null}
                                    className={`p-4 sm:p-6 rounded-2xl border transition-all ${
                                        isSolved 
                                            ? 'bg-emerald-50/20 dark:bg-emerald-950/10 border-emerald-200/60 dark:border-emerald-900/30 shadow-xs' 
                                            : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700'
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-100 dark:border-slate-800/80">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-black tracking-tight border border-emerald-200/60 dark:border-emerald-800/50">
                                                প্রশ্ন #{index + 1}
                                            </span>

                                            {/* ⭐️ Solved Badge */}
                                            {isSolved && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold border border-emerald-300/60 dark:border-emerald-800/50">
                                                    <Check size={12} strokeWidth={2.5} /> solved
                                                </span>
                                            )}

                                            {questionSuffix && (
                                                <span className="text-[11px] font-bold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20 px-2 py-0.5 rounded-md">
                                                    {questionSuffix}
                                                </span>
                                            )}
                                        </div>

                                        <button
                                            onClick={() => toggleBookmark(qIdStr)}
                                            className={`p-1.5 rounded-lg transition-colors ${isBookmarked ? 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                            title={isBookmarked ? 'বুকমার্ক সরান' : 'বুকমার্ক করুন'}
                                        >
                                            <Bookmark size={17} fill={isBookmarked ? 'currentColor' : 'none'} />
                                        </button>
                                    </div>

                                    <div className="text-[15px] sm:text-base md:text-lg font-bold text-slate-900 dark:text-slate-100 leading-snug sm:leading-relaxed mb-4">
                                        <RenderTextOrMath text={q.question} />
                                    </div>

                                    <div className="space-y-2 sm:space-y-2.5">
                                        {Object.entries(options).map(([key, value], optIndex) => {
                                            const optionLabel = ['A', 'B', 'C', 'D'][optIndex];
                                            const isCorrect = key.toLowerCase() === q.correct_option?.toLowerCase();
                                            const isUserSelected = key.toLowerCase() === selectedOption?.toLowerCase();

                                            let cardStyle = "border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 text-slate-800 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/70 hover:border-slate-300";
                                            let badgeStyle = "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700";

                                            if (mode === 'solve' || isAnswered) {
                                                if (isCorrect) {
                                                    cardStyle = "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-100 shadow-xs";
                                                    badgeStyle = "bg-emerald-600 text-white border-emerald-600";
                                                } else if (isUserSelected) {
                                                    cardStyle = "border-rose-500 bg-rose-50/80 dark:bg-rose-950/30 text-rose-950 dark:text-rose-100 shadow-xs";
                                                    badgeStyle = "bg-rose-600 text-white border-rose-600";
                                                }
                                            }

                                            return (
                                                <div
                                                    key={key}
                                                    onClick={() => handleOptionSelect(q, key)}
                                                    className={`p-2.5 sm:p-3.5 border rounded-xl cursor-pointer flex items-center gap-2.5 sm:gap-3.5 transition-all active:scale-[0.99] ${cardStyle}`}
                                                >
                                                    <span className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg text-xs sm:text-sm font-extrabold flex items-center justify-center shrink-0 shadow-xs transition-colors ${badgeStyle}`}>
                                                        {optionLabel}
                                                    </span>

                                                    <span className="text-xs sm:text-sm md:text-[15px] font-medium leading-relaxed w-full">
                                                        <RenderTextOrMath text={value} />
                                                    </span>

                                                    {(mode === 'solve' || isAnswered) && isCorrect && (
                                                        <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0 ml-auto" />
                                                    )}
                                                    {isAnswered && isUserSelected && !isCorrect && (
                                                        <XCircle size={18} className="text-rose-600 dark:text-rose-400 shrink-0 ml-auto" />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {(mode === 'solve' || isAnswered) && (
                                        <div className="mt-3.5 sm:mt-4 p-3 sm:p-4 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/40 rounded-xl">
                                            <div className="flex items-start gap-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                                <Lightbulb size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                                <div>
                                                    <span className="font-bold text-emerald-800 dark:text-emerald-300 mr-1.5">ব্যাখ্যা:</span>
                                                    <RenderTextOrMath text={q.explanation || 'কোনো ব্যাখ্যা দেওয়া নেই।'} />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}

                    {loading && (
                        <div className="flex justify-center items-center py-6">
                            <Loader2 className="animate-spin text-emerald-600 dark:text-emerald-400" size={28} />
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}