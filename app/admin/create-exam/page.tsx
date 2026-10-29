'use client';

import React, { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import {
    ChevronDown,
    Loader2,
    Moon,
    Sun,
    ArrowLeft,
    SlidersHorizontal,
    RotateCcw,
    Check,
    Search,
    Sparkles,
    Send,
    CheckCircle2,
    Filter,
    Radio,
    Calendar,
    Clock
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/hooks/useTheme';
import { saveModelTest } from '@/lib/siteApi';
import { session as auth } from '@/lib/session';
import { authFetch } from '@/lib/authFetch';
import AdminGate from '@/components/AdminGate';
import syllabusData from '@/app/constants/syllabusData.json';
import RenderTextOrMath from '@/app/components/RenderTextOrMath';

export interface Question {
    id: string | number;
    subject: string;
    chapter?: string;
    topic?: string;
    source?: string;
    tag?: string;
    question: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    correct_option: string;
    explanation?: string;
}

const syllabus = syllabusData as Record<string, Record<string, { topics: string[]; sources: string[] }>>;

const emptyFilters = {
    subject: '',
    chapter: '',
    topic: '',
    source: '',
    varsity: '',
    year: ''
};
type Filters = typeof emptyFilters;

const PAGE_SIZE = 10;

interface CustomDropdownProps {
    options: string[];
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
}

function CustomDropdown({ options, value, onChange, placeholder }: CustomDropdownProps) {
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
        <div className="relative w-full" ref={dropdownRef}>
            <div
                className="flex items-center justify-between border border-slate-200/90 dark:border-slate-800/90 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl bg-slate-50/70 dark:bg-slate-900/90 text-slate-800 dark:text-slate-200 cursor-pointer text-[11px] sm:text-xs md:text-sm font-medium focus:outline-none min-h-[34px] sm:min-h-[38px] transition-all hover:border-emerald-500/40"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="truncate pr-1">{value || placeholder}</span>
                <ChevronDown size={13} className="text-slate-400 shrink-0" />
            </div>

            {isOpen && (
                <div className="absolute z-[100] min-w-full w-max max-w-[85vw] sm:max-w-xs mt-1 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-h-52 overflow-y-auto p-1 backdrop-blur-md">
                    <div
                        className="px-2.5 py-1.5 text-[11px] sm:text-xs cursor-pointer rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-900 dark:text-white font-bold truncate mb-0.5"
                        onClick={() => { onChange(''); setIsOpen(false); }}
                    >
                        {placeholder}
                    </div>
                    {options.map((opt: string) => (
                        <div
                            key={opt}
                            className={`flex items-center justify-between px-2.5 py-1.5 text-[11px] sm:text-xs rounded-lg cursor-pointer transition-colors ${value === opt ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'}`}
                            onClick={() => { onChange(opt); setIsOpen(false); }}
                        >
                            <span className="truncate">{opt}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function AdminCreateExamInner() {
    const { isDarkMode, toggleTheme } = useTheme();
    const router = useRouter();

    // Basic Config
    const [title, setTitle] = useState('');
    const [duration, setDuration] = useState('25');
    const [negativeMark, setNegativeMark] = useState('0.25');

    // 🔴 Live Exam Sync States
    const [isLiveExam, setIsLiveExam] = useState(false);
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');

    const [filters, setFilters] = useState<Filters>({ ...emptyFilters });
    const [activeFilters, setActiveFilters] = useState<Filters | null>(null);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const [questions, setQuestions] = useState<Question[]>([]);
    const [selectedQuestions, setSelectedQuestions] = useState<Map<string, Question>>(new Map());

    // Pagination & Infinite Scroll States
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const availableSubjects = Object.keys(syllabus || {});
    const availableChapters = filters.subject && syllabus[filters.subject]
        ? Object.keys(syllabus[filters.subject])
        : [];
    const availableTopics = filters.subject && filters.chapter && syllabus[filters.subject]?.[filters.chapter]
        ? syllabus[filters.subject][filters.chapter].topics || []
        : [];
    const availableSources = filters.subject && filters.chapter && syllabus[filters.subject]?.[filters.chapter]
        ? syllabus[filters.subject][filters.chapter].sources || []
        : [];

    const varsityList = ['MAT', 'DAT', 'AFMC'];
    const yearList = ['25-26', '24-25', '23-24', '22-23', '21-22', '20-21', '19-20', '18-19', '17-18', '16-17', '15-16'];

    // Turso API fetch
    const fetchQuestions = useCallback(async (f: Filters, search: string, pageNumber: number) => {
        try {
            setLoading(true);
            const queryParams = new URLSearchParams({
                subject: f.subject || '',
                chapter: f.chapter || '',
                topic: f.topic || '',
                source: f.source || '',
                varsity: f.varsity || '',
                year: f.year || '',
                search: search.trim(),
                page: String(pageNumber),
                limit: String(PAGE_SIZE)
            });

            const res = await authFetch(`/api/admin/questions?${queryParams.toString()}`);
            const data = await res.json();

            if (data.success && Array.isArray(data.questions)) {
                setHasMore(data.questions.length >= PAGE_SIZE);
                setQuestions(prev => {
                    if (pageNumber === 1) return data.questions;
                    const existingIds = new Set(prev.map(q => String(q.id)));
                    const filteredNew = data.questions.filter((q: Question) => !existingIds.has(String(q.id)));
                    return [...prev, ...filteredNew];
                });
            } else {
                setHasMore(false);
            }
        } catch (err) {
            console.error('Fetch questions error:', err);
            setHasMore(false);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!activeFilters) return;
        fetchQuestions(activeFilters, searchTerm, page);
    }, [activeFilters, page, fetchQuestions]);

    const handleFilterChange = (filterName: string, value: string) => {
        setFilters(prev => {
            const next = { ...prev, [filterName]: value };
            if (filterName === 'subject') {
                next.chapter = '';
                next.topic = '';
                next.source = '';
            } else if (filterName === 'chapter') {
                next.topic = '';
                next.source = '';
            }
            return next;
        });
    };

    const handleApplyFilters = () => {
        setPage(1);
        setQuestions([]);
        setHasMore(true);
        setActiveFilters({ ...filters });
    };

    const handleResetAllFilters = () => {
        setFilters({ ...emptyFilters });
        setActiveFilters(null);
        setQuestions([]);
        setSearchTerm('');
        setPage(1);
        setHasMore(false);
    };

    const toggleSelect = (q: Question) => {
        const idStr = String(q.id);
        setSelectedQuestions(prev => {
            const next = new Map(prev);
            if (next.has(idStr)) {
                next.delete(idStr);
            } else {
                next.set(idStr, q);
            }
            return next;
        });
    };

    const handleSelectAll = () => {
        if (questions.length === 0) return;
        const allInCurrent = questions.every(q => selectedQuestions.has(String(q.id)));
        setSelectedQuestions(prev => {
            const next = new Map(prev);
            if (allInCurrent) {
                questions.forEach(q => next.delete(String(q.id)));
            } else {
                questions.forEach(q => next.set(String(q.id), q));
            }
            return next;
        });
    };

    const handleRandom20 = () => {
        if (questions.length === 0) return;
        const shuffled = [...questions].sort(() => 0.5 - Math.random());
        const picked = shuffled.slice(0, 20);
        setSelectedQuestions(prev => {
            const next = new Map(prev);
            picked.forEach(q => next.set(String(q.id), q));
            return next;
        });
    };

    // Infinity scroll handler
    const observer = useRef<IntersectionObserver | null>(null);
    const lastQuestionRef = useCallback((node: HTMLDivElement | null) => {
        if (loading) return;
        if (observer.current) observer.current.disconnect();

        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                setPage(prev => prev + 1);
            }
        });

        if (node) observer.current.observe(node);
    }, [loading, hasMore]);

    // 🚀 Firestore Exam Save (Fully Synced with model-test portal)
    const handleCreateExam = async () => {
        if (!title.trim()) {
            alert('Porikkhar nam (Title) likhun!');
            return;
        }
        if (selectedQuestions.size === 0) {
            alert('Kompokkhe ekti proshno select korun!');
            return;
        }

        // Live exam validation
        if (isLiveExam) {
            if (!startTime) {
                alert('Live porikkhar shuru howar shomoy (Start Time) select korun!');
                return;
            }
            if (!endTime) {
                alert('Live porikkhar shesh howar shomoy (End Time) select korun!');
                return;
            }
            if (new Date(endTime).getTime() <= new Date(startTime).getTime()) {
                alert('End time obosshoi Start time er porer shomoy hote hobe!');
                return;
            }
        }

        try {
            setSubmitting(true);
            const examId = `exam_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const questionArray = Array.from(selectedQuestions.values()).map(q => ({
                id: String(q.id),
                question: q.question,
                option_a: q.option_a,
                option_b: q.option_b,
                option_c: q.option_c,
                option_d: q.option_d,
                correct_option: q.correct_option,
                explanation: q.explanation || '',
                subject: q.subject || activeFilters?.subject || '',
                chapter: q.chapter || '',
                tag: q.tag || ''
            }));

            // Sync with model-test portal structure
            const examPayload: any = {
                id: examId,
                title: title.trim(),
                subject: activeFilters?.subject || 'সমন্বিত',
                duration_minutes: parseInt(duration) || 25,
                negative_marking: parseFloat(negativeMark) || 0.25,
                total_marks: questionArray.length,
                total_questions: questionArray.length,
                questions: questionArray,
                is_live: isLiveExam,
                is_archive: !isLiveExam,
                type: isLiveExam ? 'live' : 'archive',
                createdBy: auth.currentUser?.email || 'admin'
            };

            if (isLiveExam) {
                examPayload.start_time = new Date(startTime).toISOString();
                examPayload.end_time = new Date(endTime).toISOString();
            }

            await saveModelTest(examId, examPayload);
            alert(isLiveExam ? '🔴 লাইভ মডেল টেস্ট সফলভাবে পাবলিশ হয়েছে!' : 'মডেল টেস্ট সফলভাবে তৈরি হয়েছে!');
            router.push('/model-test');
        } catch (err: any) {
            console.error('Save exam error:', err);
            alert(`Error: ${err.message || 'Save kora jayni'}`);
        } finally {
            setSubmitting(false);
        }
    };

    const hasActiveCustomFilters = filters.chapter || filters.topic || filters.source || filters.varsity || filters.year;

    return (
        <div className="min-h-screen bg-slate-100/60 dark:bg-[#0B1120] font-sans text-slate-900 dark:text-slate-50 transition-colors duration-300 pb-28">
            {/* Top Navigation */}
            <nav className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-[#0B1120]/85 backdrop-blur-md">
                <div className="mx-auto max-w-4xl px-3 sm:px-6">
                    <div className="flex h-13 sm:h-16 items-center justify-between">
                        <div className="flex items-center gap-2 sm:gap-3">
                            <button onClick={() => router.back()} className="p-1.5 sm:p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                                <ArrowLeft size={15} />
                            </button>
                            <span className="text-sm sm:text-base font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                                <Sparkles size={16} className="text-emerald-500" /> মডেল টেস্ট জেনারেটর
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            <button onClick={toggleTheme} className="p-1.5 sm:p-2.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer">
                                {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="max-w-4xl mx-auto px-2.5 sm:px-6 pt-3 sm:pt-6">
                {/* 1. Exam Configuration Card */}
                <div className="mb-3.5 sm:mb-5 bg-white dark:bg-[#0c1322] p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                            <Sparkles size={15} /> পরীক্ষার প্রাথমিক কনফিগারেশন
                        </h2>

                        {/* 🔴 Live Exam Switcher */}
                        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                            <button
                                type="button"
                                onClick={() => setIsLiveExam(false)}
                                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${!isLiveExam
                                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                            >
                                সাধারণ টেস্ট
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsLiveExam(true)}
                                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${isLiveExam
                                    ? 'bg-rose-600 text-white shadow-xs'
                                    : 'text-rose-500 hover:text-rose-600'
                                    }`}
                            >
                                <span className={`w-1.5 h-1.5 rounded-full ${isLiveExam ? 'bg-white animate-pulse' : 'bg-rose-500'}`}></span>
                                লাইভ এক্সাম
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 mb-3">
                        <div className="sm:col-span-2">
                            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">পরীক্ষার নাম (Title)</label>
                            <input
                                type="text"
                                placeholder="যেমন: উদ্ভিদবিজ্ঞান ফুল পেপার মক টেস্ট ০১"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-medium focus:outline-none focus:border-emerald-500"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">সময় (মিনিট)</label>
                            <input
                                type="number"
                                value={duration}
                                onChange={(e) => setDuration(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-medium focus:outline-none focus:border-emerald-500"
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">নেগেটিভ মার্কিং</label>
                            <input
                                type="number"
                                step="0.05"
                                value={negativeMark}
                                onChange={(e) => setNegativeMark(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-medium focus:outline-none focus:border-emerald-500"
                            />
                        </div>
                    </div>

                    {/* 🕒 Live Exam Date & Time Schedule Box */}
                    {isLiveExam && (
                        <div className="p-3 sm:p-4 rounded-xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/40 transition-all">
                            <span className="text-xs font-black text-rose-700 dark:text-rose-400 flex items-center gap-1.5 mb-2.5">
                                <Clock size={14} /> লাইভ সময়সূচি নির্ধারণ (Schedule Window)
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                        শুরুর সময় (Start Time)
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 text-xs font-semibold focus:outline-none focus:border-rose-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                                        শেষের সময় (End Time)
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 text-xs font-semibold focus:outline-none focus:border-rose-500"
                                    />
                                </div>
                            </div>
                            <span className="text-[10px] text-rose-600/80 dark:text-rose-400/70 block mt-2">
                                * নির্ধারিত সময়ের মধ্যে শিক্ষার্থীরা লাইভ পরীক্ষা দিতে পারবে। সময় শেষ হলে স্বয়ংক্রিয়ভাবে আর্কাইভে চলে যাবে।
                            </span>
                        </div>
                    )}
                </div>

                {/* 2. Syllabus Filter Accordion */}
                <div className="mb-3.5 sm:mb-5 bg-white dark:bg-[#0c1322] p-2.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-3">
                        <CustomDropdown options={availableSubjects} value={filters.subject} onChange={(val: string) => handleFilterChange('subject', val)} placeholder="সব বিষয়" />
                        <CustomDropdown options={availableChapters} value={filters.chapter} onChange={(val: string) => handleFilterChange('chapter', val)} placeholder="সব অধ্যায়" />
                        <CustomDropdown options={availableTopics} value={filters.topic} onChange={(val: string) => handleFilterChange('topic', val)} placeholder="সব টপিক" />
                        <CustomDropdown options={availableSources} value={filters.source} onChange={(val: string) => handleFilterChange('source', val)} placeholder="সব উৎস" />
                    </div>

                    {showAdvanced && (
                        <div className="grid grid-cols-2 gap-1.5 sm:gap-3 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                            <CustomDropdown options={varsityList} value={filters.varsity} onChange={(val: string) => handleFilterChange('varsity', val)} placeholder="সব ভার্সিটি" />
                            <CustomDropdown options={yearList} value={filters.year} onChange={(val: string) => handleFilterChange('year', val)} placeholder="সকল শিক্ষাবর্ষ (সাল)" />
                        </div>
                    )}

                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="text-[11px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:opacity-80 flex items-center gap-1 cursor-pointer select-none"
                            >
                                <SlidersHorizontal size={12} />
                                <span>{showAdvanced ? 'অ্যাডভান্সড বন্ধ' : 'অ্যাডভান্সড ফিল্টার'}</span>
                                {(filters.varsity || filters.year) && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                                )}
                            </button>

                            {hasActiveCustomFilters && (
                                <button
                                    onClick={handleResetAllFilters}
                                    className="text-[10px] sm:text-[11px] font-semibold text-rose-500 hover:text-rose-600 flex items-center gap-0.5 cursor-pointer"
                                >
                                    <RotateCcw size={11} />
                                    <span>রিসেট</span>
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                placeholder="প্রশ্ন বা টপিক খুঁজুন..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-32 sm:w-48 px-2.5 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                            />
                            <button
                                onClick={handleApplyFilters}
                                className="flex items-center gap-1 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
                            >
                                <Search size={12} />
                                <span>ফিল্টার করুন</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* 3. Batch Controls Bar */}
                {activeFilters && (
                    <div className="flex items-center justify-between mb-3 px-1">
                        <span className="text-xs sm:text-sm font-extrabold text-slate-600 dark:text-slate-300">
                            মোট লোড হয়েছে: {questions.length} টি
                        </span>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleSelectAll}
                                className="px-3 py-1.5 rounded-xl bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                            >
                                সব সিলেক্ট
                            </button>
                            <button
                                type="button"
                                onClick={handleRandom20}
                                className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-100 transition-colors cursor-pointer"
                            >
                                র‍্যান্ডম ২০টি
                            </button>
                        </div>
                    </div>
                )}

                {/* 4. Question Select List */}
                {!activeFilters ? (
                    <div className="bg-white dark:bg-slate-900 p-12 text-center rounded-3xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                        <Filter className="w-8 h-8 text-emerald-500 opacity-60 mb-1" />
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">প্রশ্ন প্রদর্শন বন্ধ আছে</span>
                        <p className="max-w-xs text-slate-400">উপরের ড্রপডাউন থেকে বিষয় ও অধ্যায় নির্বাচন করে <strong>"ফিল্টার করুন"</strong> বাটনে চাপ দিন।</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {questions.length === 0 && !loading && (
                            <div className="bg-white dark:bg-slate-900 p-8 text-center rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                                কোনো প্রশ্ন পাওয়া যায়নি। ফিল্টার পরিবর্তন করে দেখুন।
                            </div>
                        )}

                        {questions.map((q, index) => {
                            const isChecked = selectedQuestions.has(String(q.id));
                            const questionSuffix = q.tag && q.tag.trim() !== '' ? q.tag : q.source;
                            const options = { a: q.option_a, b: q.option_b, c: q.option_c, d: q.option_d };
                            const isLastItem = index === questions.length - 1;

                            return (
                                <div
                                    key={q.id}
                                    ref={isLastItem ? lastQuestionRef : null}
                                    onClick={() => toggleSelect(q)}
                                    className={`p-4 sm:p-5 rounded-3xl border transition-all cursor-pointer select-none ${isChecked
                                        ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-500 shadow-xs ring-1 ring-emerald-500/30'
                                        : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 hover:border-slate-300'
                                        }`}
                                >
                                    <div className="flex items-start gap-2.5 mb-3">
                                        <div className="pt-0.5 shrink-0">
                                            {isChecked ? (
                                                <div className="w-5 h-5 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                                                    <Check size={13} strokeWidth={3} />
                                                </div>
                                            ) : (
                                                <div className="w-5 h-5 rounded-lg border-2 border-slate-300 dark:border-slate-600" />
                                            )}
                                        </div>

                                        <div className="flex flex-wrap items-center gap-1.5 min-w-0 flex-1">
                                            <span className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-black flex items-center justify-center border border-emerald-200/60 dark:border-emerald-800/50">
                                                {index + 1}
                                            </span>

                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                                {q.subject}
                                            </span>

                                            {questionSuffix && (
                                                <span className="text-[10px] font-bold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20 px-2 py-0.5 rounded-lg">
                                                    {questionSuffix}
                                                </span>
                                            )}

                                            <h3 className="w-full mt-1 text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
                                                <RenderTextOrMath text={q.question} />
                                            </h3>
                                        </div>
                                    </div>

                                    {/* 2x2 Option Preview */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-7">
                                        {Object.entries(options).map(([key, value], optIdx) => {
                                            const label = ['A', 'B', 'C', 'D'][optIdx];
                                            const isCorrect = key.toLowerCase() === q.correct_option?.toLowerCase();

                                            return (
                                                <div
                                                    key={key}
                                                    className={`p-2 rounded-xl border text-xs flex items-center gap-2 ${isCorrect
                                                        ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-400 text-emerald-900 dark:text-emerald-200 font-bold'
                                                        : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                                                        }`}
                                                >
                                                    <span className="w-5 h-5 rounded-md bg-white dark:bg-slate-700 text-[10px] font-bold flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-600">
                                                        {label}
                                                    </span>
                                                    <span className="truncate flex-1">
                                                        <RenderTextOrMath text={value} />
                                                    </span>
                                                    {isCorrect && (
                                                        <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}

                        {loading && (
                            <div className="flex flex-col items-center justify-center py-6 text-slate-400">
                                <Loader2 className="animate-spin text-emerald-600 mb-2" size={24} />
                                <span className="text-xs">পরবর্তী ১০টি প্রশ্ন লোড হচ্ছে...</span>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Bottom Bar: Total Count & Direct Publish Button */}
            <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-[#0c1322]/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-3 sm:p-4">
                <div className="max-w-4xl mx-auto flex items-center justify-between px-2">
                    <div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-bold">সিলেক্টেড প্রশ্ন</span>
                        <span className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400">
                            {selectedQuestions.size} টি প্রশ্ন {isLiveExam && <span className="text-rose-500 ml-1 text-xs font-bold">🔴 Live Exam</span>}
                        </span>
                    </div>

                    <button
                        onClick={handleCreateExam}
                        disabled={submitting || selectedQuestions.size === 0}
                        className={`px-5 py-2.5 rounded-xl text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95 ${isLiveExam ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
                            }`}
                    >
                        {submitting ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                <span>সেভ হচ্ছে...</span>
                            </>
                        ) : (
                            <>
                                <Send size={15} />
                                <span>{isLiveExam ? 'লাইভ পরীক্ষা পাবলিশ করুন' : 'মডেল টেস্ট তৈরি করুন'}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function AdminCreateExamPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-slate-100/60 dark:bg-[#0B1120]">
                <Loader2 className="animate-spin text-emerald-600" size={28} />
            </div>
        }>
            <AdminGate>
                <AdminCreateExamInner />
            </AdminGate>
        </Suspense>
    );
}