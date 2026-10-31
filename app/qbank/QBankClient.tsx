'use client';

import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import BrandLoader from '@/components/BrandLoader';
import {
    ChevronDown,
    Loader2,
    Bookmark,
    Lightbulb,
    CheckCircle2,
    XCircle,
    SlidersHorizontal,
    RotateCcw,
    Check,
    Flag,
    AlertCircle,
    Search
} from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import { fetchFilteredQuestions, Question } from './actions';
import { getMe, getSolved, reportQuestion, setBookmark, syncAnswers } from '@/lib/siteApi';
import { useLang } from '@/lib/i18n';
import { onAuthStateChanged } from '@/lib/session';
import { session as auth } from '@/lib/session';
import RenderTextOrMath from '@/app/components/RenderTextOrMath';
import syllabusData from '@/app/constants/syllabusData.json';

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */

const DATA_CACHE_VERSION = 'v1.4';
const CACHE_VERSION_KEY = 'adq_qbank_cache_version';
const CACHE_PREFIX = 'qbank_cache_';
const CACHE_INDEX_KEY = 'adq_qbank_cache_index';
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 60;

const PAGE_SIZE = 10;
const BATCH_QUESTION_THRESHOLD = 5;

const LEGACY_PENDING_KEY = 'qbank_pending_sync_queue';
const pendingKey = (uid: string) => `qbank_pending_${uid}`;
const TAB_ID = Math.random().toString(36).slice(2);
const inflightPrefix = (uid: string) => `qbank_inflight_${uid}_`;
const inflightKey = (uid: string) => `${inflightPrefix(uid)}${TAB_ID}`;
const INFLIGHT_STALE_MS = 30 * 1000;


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

/* ------------------------------------------------------------------ */
/* Safe localStorage wrapper                                          */
/* ------------------------------------------------------------------ */

const safeStorage = {
    getItem: (key: string): string | null => {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                return localStorage.getItem(key);
            }
        } catch {
            return null;
        }
        return null;
    },
    setItem: (key: string, value: string): boolean => {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                localStorage.setItem(key, value);
                return true;
            }
        } catch {
            return false;
        }
        return false;
    },
    removeItem: (key: string): void => {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                localStorage.removeItem(key);
            }
        } catch {
            // Error ignored
        }
    }
};

const readJSON = (key: string): any => {
    const raw = safeStorage.getItem(key);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        safeStorage.removeItem(key);
        return null;
    }
};

/* ------------------------------------------------------------------ */
/* Cache helpers                                                      */
/* ------------------------------------------------------------------ */

const readIndex = (): string[] => {
    const v = readJSON(CACHE_INDEX_KEY);
    return Array.isArray(v) ? v.filter((k: unknown): k is string => typeof k === 'string') : [];
};

const evictCache = (ratio: number) => {
    const index = readIndex();
    const n = Math.ceil(index.length * ratio);
    index.slice(0, n).forEach((k) => safeStorage.removeItem(k));
    safeStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index.slice(n)));
};

const readCache = (key: string, allowStale: boolean): Question[] | null => {
    const parsed = readJSON(key);
    if (!parsed || !Array.isArray(parsed.d) || typeof parsed.t !== 'number') {
        if (parsed) safeStorage.removeItem(key);
        return null;
    }
    if (!allowStale && Date.now() - parsed.t >= CACHE_TTL_MS) return null;
    return parsed.d as Question[];
};

const writeCache = (key: string, data: Question[]) => {
    const payload = JSON.stringify({ t: Date.now(), d: data });
    let ok = safeStorage.setItem(key, payload);
    if (!ok) {
        evictCache(0.5);
        ok = safeStorage.setItem(key, payload);
    }
    if (!ok) return;

    const index = readIndex().filter((k) => k !== key);
    index.push(key);
    while (index.length > CACHE_MAX_ENTRIES) {
        const old = index.shift();
        if (old) safeStorage.removeItem(old);
    }
    safeStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(index));
};

const getCacheKey = (pageNo: number, f: Filters) =>
    `${CACHE_PREFIX}${f.subject}_${f.chapter}_${f.topic}_${f.source}_${f.varsity}_${f.year}_p${pageNo}`;

const appendUnique = (prev: Question[], next: Question[]) => {
    const seen = new Set(prev.map((x) => String(x.id)));
    return [...prev, ...next.filter((x) => !seen.has(String(x.id)))];
};

/* ------------------------------------------------------------------ */
/* Queue helpers (Subject-wise Solved Tracking)                       */
/* ------------------------------------------------------------------ */

interface PendingSessionData {
    attempted: number;
    correct: number;
    score: number;
    solvedBySubject: Record<string, string[]>;
    subjects: Record<string, { subject: string; attempted: number; correct: number }>;
    chapters: Record<string, { subject: string; chapter: string; attempted: number; correct: number }>;
    mistakes: Record<string, { id: string; userAnswer: string; timestamp: number }>;
}

interface AnswerEntry {
    qId: string;
    answer: string;
    correct: boolean;
    subject: string;
    chapter: string;
}

const getEmptyQueue = (): PendingSessionData => ({
    attempted: 0,
    correct: 0,
    score: 0,
    solvedBySubject: {},
    subjects: {},
    chapters: {},
    mistakes: {}
});

const sanitizeQueue = (raw: any): PendingSessionData => {
    const q = getEmptyQueue();
    if (!raw || typeof raw !== 'object') return q;
    q.attempted = Number(raw.attempted) || 0;
    q.correct = Number(raw.correct) || 0;
    q.score = Number(raw.score) || 0;
    q.solvedBySubject = raw.solvedBySubject && typeof raw.solvedBySubject === 'object' ? raw.solvedBySubject : {};
    q.subjects = raw.subjects && typeof raw.subjects === 'object' ? raw.subjects : {};
    q.chapters = raw.chapters && typeof raw.chapters === 'object' ? raw.chapters : {};
    q.mistakes = raw.mistakes && typeof raw.mistakes === 'object' ? raw.mistakes : {};
    return q;
};

const mergeQueues = (target: PendingSessionData, src: PendingSessionData) => {
    target.attempted += src.attempted;
    target.correct += src.correct;
    target.score += src.score;

    for (const [subKey, ids] of Object.entries(src.solvedBySubject || {})) {
        const existing = target.solvedBySubject[subKey] || [];
        target.solvedBySubject[subKey] = Array.from(new Set([...existing, ...ids]));
    }

    for (const [k, v] of Object.entries(src.subjects)) {
        const t = (target.subjects[k] ||= { subject: v.subject, attempted: 0, correct: 0 });
        t.attempted += v.attempted;
        t.correct += v.correct;
    }
    for (const [k, v] of Object.entries(src.chapters)) {
        const t = (target.chapters[k] ||= { subject: v.subject, chapter: v.chapter, attempted: 0, correct: 0 });
        t.attempted += v.attempted;
        t.correct += v.correct;
    }
    for (const [k, v] of Object.entries(src.mistakes)) {
        const existing = target.mistakes[k];
        if (!existing || (v.timestamp || 0) >= (existing.timestamp || 0)) target.mistakes[k] = v;
    }
};

const persistQueue = (uid: string, q: PendingSessionData) => {
    if (q.attempted === 0) {
        safeStorage.removeItem(pendingKey(uid));
        return;
    }
    const payload = JSON.stringify(q);
    if (!safeStorage.setItem(pendingKey(uid), payload)) {
        evictCache(1);
        safeStorage.setItem(pendingKey(uid), payload);
    }
};

/* ------------------------------------------------------------------ */
/* Dropdown Component                                                 */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* Main Client Logic                                                  */
/* ------------------------------------------------------------------ */

function QBankInner() {
    const searchParams = useSearchParams();
    const { t } = useLang();
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

    const [currentUser, setCurrentUser] = useState<any>(null);
    const [mode, setMode] = useState<'practice' | 'solve'>('practice');
    const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});

    const [questions, setQuestions] = useState<Question[]>([]);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [reloadTick, setReloadTick] = useState(0);
    const loadErrorRef = useRef(false);

    const [showAdvanced, setShowAdvanced] = useState(false);

    const [filters, setFilters] = useState<Filters>({ ...emptyFilters, subject: initialSubject });
    const [activeFilters, setActiveFilters] = useState<Filters>({ ...emptyFilters, subject: initialSubject });

    const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
    const [solvedIds, setSolvedIds] = useState<Set<string>>(new Set());

    const [reportingQuestion, setReportingQuestion] = useState<Question | null>(null);
    const [reportReason, setReportReason] = useState('');
    const [reportSubmitting, setReportSubmitting] = useState(false);

    const [toast, setToast] = useState<string | null>(null);
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const clickedQuestionsRef = useRef<Set<string>>(new Set());

    const showToast = useCallback((message: string) => {
        setToast(message);
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setToast(null), 3000);
    }, []);

    const isSyncingRef = useRef<boolean>(false);
    const storageOkRef = useRef<boolean>(false);
    const memQueueRef = useRef<{ uid: string | null; q: PendingSessionData }>({ uid: null, q: getEmptyQueue() });
    const authReadyRef = useRef<boolean>(false);
    const earlyAnswersRef = useRef<AnswerEntry[]>([]);

    const readQueue = useCallback((uid: string): PendingSessionData => {
        if (storageOkRef.current) return sanitizeQueue(readJSON(pendingKey(uid)));
        return memQueueRef.current.uid === uid ? memQueueRef.current.q : getEmptyQueue();
    }, []);

    const writeQueue = useCallback((uid: string, q: PendingSessionData) => {
        memQueueRef.current = { uid, q };
        if (storageOkRef.current) persistQueue(uid, q);
    }, []);

    const recordAnswer = useCallback((uid: string, e: AnswerEntry): number => {
        const q = readQueue(uid);
        q.attempted += 1;
        if (e.correct) {
            q.correct += 1;
            q.score += 1;
        }

        // Database er nam onujayi subject store kora
        const subKey = e.subject.trim();
        if (!q.solvedBySubject[subKey]) q.solvedBySubject[subKey] = [];
        if (!q.solvedBySubject[subKey].includes(e.qId)) {
            q.solvedBySubject[subKey].push(e.qId);
        }

        if (!q.subjects[subKey]) q.subjects[subKey] = { subject: e.subject, attempted: 0, correct: 0 };
        q.subjects[subKey].attempted += 1;
        if (e.correct) q.subjects[subKey].correct += 1;

        const chapKey = `${e.subject}_${e.chapter}`;
        if (!q.chapters[chapKey]) q.chapters[chapKey] = { subject: e.subject, chapter: e.chapter, attempted: 0, correct: 0 };
        q.chapters[chapKey].attempted += 1;
        if (e.correct) q.chapters[chapKey].correct += 1;

        if (!e.correct) {
            q.mistakes[e.qId] = { id: e.qId, userAnswer: e.answer, timestamp: Date.now() };
        }

        writeQueue(uid, q);
        return q.attempted;
    }, [readQueue, writeQueue]);

    const recoverOrphans = useCallback((uid: string) => {
        let keys: string[] = [];
        try {
            keys = Object.keys(localStorage);
        } catch {
            return;
        }
        const prefix = inflightPrefix(uid);
        const q = readQueue(uid);
        let merged = false;

        keys.forEach((key) => {
            if (!key.startsWith(prefix) || key === inflightKey(uid)) return;
            const rec = readJSON(key);
            if (!rec || !rec.data) {
                safeStorage.removeItem(key);
                return;
            }
            if (Date.now() - (Number(rec.startedAt) || 0) < INFLIGHT_STALE_MS) return;
            mergeQueues(q, sanitizeQueue(rec.data));
            safeStorage.removeItem(key);
            merged = true;
        });

        if (merged) writeQueue(uid, q);
    }, [readQueue, writeQueue]);

    // 🚀 BATCH SYNC: Subject-wise Bucketing
    const flushPendingSync = useCallback(async () => {
        const user = auth.currentUser;
        if (!user || isSyncingRef.current) return;
        const uid = user.uid;

        const data = readQueue(uid);
        if (data.attempted === 0) return;

        isSyncingRef.current = true;
        let success = false;

        if (storageOkRef.current) {
            safeStorage.setItem(inflightKey(uid), JSON.stringify({ owner: TAB_ID, startedAt: Date.now(), data }));
        }
        writeQueue(uid, getEmptyQueue());

        try {
            // সার্ভার একবারে Turso তে লেখে (মোট স্কোর, solved, progress, ভুল; ভুলের লিস্ট ৫০০ তে সীমিত)
            await syncAnswers(data);
            success = true;

            safeStorage.removeItem(inflightKey(uid));
        } catch (err) {
            console.error("Answer sync error:", err);
            const current = readQueue(uid);
            mergeQueues(current, data);
            writeQueue(uid, current);
            safeStorage.removeItem(inflightKey(uid));
        } finally {
            isSyncingRef.current = false;
        }

        if (success) {
            if (readQueue(uid).attempted >= BATCH_QUESTION_THRESHOLD) {
                flushPendingSync();
            }
        }
    }, [readQueue, writeQueue]);

    useEffect(() => {
        const testKey = '__adq_storage_test__';
        storageOkRef.current = safeStorage.setItem(testKey, '1') && safeStorage.getItem(testKey) === '1';
        safeStorage.removeItem(testKey);

        const currentSavedVersion = safeStorage.getItem(CACHE_VERSION_KEY);
        if (currentSavedVersion !== DATA_CACHE_VERSION) {
            try {
                if (typeof window !== 'undefined' && window.localStorage) {
                    Object.keys(localStorage).forEach((key) => {
                        if (key.startsWith(CACHE_PREFIX)) {
                            localStorage.removeItem(key);
                        }
                    });
                }
            } catch {
                // Ignore
            }
            safeStorage.removeItem(CACHE_INDEX_KEY);
            safeStorage.setItem(CACHE_VERSION_KEY, DATA_CACHE_VERSION);
        }
    }, []);

    // 🎯 Auth State & User Profile Load
    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            authReadyRef.current = true;
            setCurrentUser(user);

            if (!user) {
                setBookmarkedIds(new Set());
                setSolvedIds(new Set());
                earlyAnswersRef.current = [];
                return;
            }

            const uid = user.uid;

            const legacy = readJSON(LEGACY_PENDING_KEY);
            if (legacy) {
                const q = readQueue(uid);
                mergeQueues(q, sanitizeQueue(legacy));
                writeQueue(uid, q);
                safeStorage.removeItem(LEGACY_PENDING_KEY);
            }

            recoverOrphans(uid);
            flushPendingSync();

            if (earlyAnswersRef.current.length > 0) {
                const early = earlyAnswersRef.current;
                earlyAnswersRef.current = [];
                let attempted = 0;
                early.forEach((entry) => {
                    attempted = recordAnswer(uid, entry);
                });
                if (attempted >= BATCH_QUESTION_THRESHOLD) flushPendingSync();
            }

            (async () => {
                try {
                    const me = await getMe();
                    if (auth.currentUser?.uid !== uid) return;
                    setBookmarkedIds(new Set(me.bookmarks.map(String)));
                } catch (e) {
                    console.error("User doc fetch error:", e);
                }
            })();
        });

        return () => unsubscribeAuth();
    }, [flushPendingSync, readQueue, writeQueue, recordAnswer, recoverOrphans]);

    // 🎯 Solved IDs Database Sync (Refresh korleo solved badge theke jabe)
    useEffect(() => {
        if (!currentUser || !activeFilters.subject) return;

        const uid = currentUser.uid;
        const subDocName = activeFilters.subject.trim();

        (async () => {
            try {
                const ids = await getSolved(subDocName);
                if (auth.currentUser?.uid !== uid) return;
                setSolvedIds(prev => new Set([...prev, ...ids]));
            } catch (err) {
                console.error("Subject solved fetch error:", err);
            }
        })();
    }, [currentUser, activeFilters.subject]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') flushPendingSync();
        };
        const handleLeave = () => { flushPendingSync(); };
        const handleOnline = () => { flushPendingSync(); };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', handleLeave);
        window.addEventListener('pagehide', handleLeave);
        window.addEventListener('online', handleOnline);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', handleLeave);
            window.removeEventListener('pagehide', handleLeave);
            window.removeEventListener('online', handleOnline);
            flushPendingSync();
        };
    }, [flushPendingSync]);

    const quickReportOptions = [
        t('ভুল উত্তর মার্ক করা', 'Wrong answer marked'),
        t('টাইপো / বানান ভুল', 'Typo / spelling'),
        t('ব্যাখ্যায় ভুল আছে', 'Explanation is wrong'),
        t('অপশন বা প্রশ্নে তথ্য মিসিং', 'Missing info in question or options'),
        t('একাধিক সঠিক উত্তর আছে', 'More than one correct answer'),
        t('প্রশ্নটি সিলেবাসের বাইরে', 'Out of syllabus'),
    ];

    const handleQuickTagClick = (tag: string) => {
        setReportReason(prev => {
            if (!prev.trim()) return tag;
            if (prev.includes(tag)) return prev;
            return `${prev}, ${tag}`;
        });
    };

    const toggleBookmark = async (questionId: string) => {
        const user = auth.currentUser;
        if (!user) {
            showToast(t('বুকমার্ক করতে লগইন করুন।', 'Log in to bookmark.'));
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
            await setBookmark(questionId, !isBookmarked);
        } catch (error) {
            console.error('Error toggling bookmark:', error);
            setBookmarkedIds(prev => {
                const next = new Set(prev);
                if (isBookmarked) next.add(questionId);
                else next.delete(questionId);
                return next;
            });
            showToast(t('বুকমার্ক সেভ করা যায়নি।', 'Could not save the bookmark.'));
        }
    };

    const handleReportSubmit = async () => {
        if (!reportingQuestion || !reportReason.trim()) return;
        const user = auth.currentUser;
        if (!user) {
            showToast(t('রিপোর্ট করতে লগইন করুন।', 'Log in to report.'));
            router.push('/login');
            return;
        }

        setReportSubmitting(true);
        try {
            await reportQuestion(String(reportingQuestion.id), reportReason.trim());

            showToast(t('ধন্যবাদ! আপনার রিপোর্ট জমা হয়েছে।', 'Thanks! Your report was sent.'));
            setReportingQuestion(null);
            setReportReason('');
        } catch (err) {
            console.error("Report submit error:", err);
            showToast(t('রিপোর্ট পাঠাতে সমস্যা হয়েছে।', 'Could not send the report.'));
        } finally {
            setReportSubmitting(false);
        }
    };

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

    useEffect(() => {
        let cancelled = false;
        const cacheKey = getCacheKey(page, activeFilters);

        const applyPage = (pageData: Question[]) => {
            setHasMore(pageData.length >= PAGE_SIZE);
            setQuestions(prev => (page === 1 ? pageData : appendUnique(prev, pageData)));
        };

        const cached = readCache(cacheKey, false);
        if (cached) {
            applyPage(cached);
            loadErrorRef.current = false;
            setLoadError(false);
            setLoading(false);
            return () => { cancelled = true; };
        }

        (async () => {
            setLoading(true);
            try {
                const fresh = await fetchFilteredQuestions(page, activeFilters);
                if (cancelled) return;
                writeCache(cacheKey, fresh);
                loadErrorRef.current = false;
                setLoadError(false);
                applyPage(fresh);
            } catch (err) {
                console.error("Fetch questions error:", err);
                if (cancelled) return;
                const stale = readCache(cacheKey, true);
                if (stale) {
                    applyPage(stale);
                } else {
                    loadErrorRef.current = true;
                    setLoadError(true);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [page, activeFilters, reloadTick]);

    const applyFilterState = useCallback((next: Filters) => {
        clickedQuestionsRef.current.clear();
        setFilters(next);
        setPage(1);
        setQuestions([]);
        setHasMore(true);
        loadErrorRef.current = false;
        setLoadError(false);
        setActiveFilters({ ...next });
    }, []);

    const prevInitialSubjectRef = useRef(initialSubject);
    useEffect(() => {
        if (prevInitialSubjectRef.current === initialSubject) return;
        prevInitialSubjectRef.current = initialSubject;
        applyFilterState({ ...emptyFilters, subject: initialSubject });
    }, [initialSubject, applyFilterState]);

    const handleFilterChange = (filterName: string, value: string) => {
        setFilters(prev => {
            const newFilters = { ...prev, [filterName]: value };
            if (filterName === 'subject') {
                newFilters.chapter = '';
                newFilters.topic = '';
                newFilters.source = '';
            } else if (filterName === 'chapter') {
                newFilters.topic = '';
                newFilters.source = '';
            }
            return newFilters;
        });
    };

    const handleApplyFilters = () => {
        if (JSON.stringify(filters) === JSON.stringify(activeFilters)) {
            if (loadErrorRef.current) {
                loadErrorRef.current = false;
                setLoadError(false);
                setReloadTick(t => t + 1);
            }
            return;
        }
        applyFilterState(filters);
    };

    const handleResetAllFilters = () => {
        applyFilterState({ ...emptyFilters, subject: initialSubject });
    };

    const handleRetry = () => {
        loadErrorRef.current = false;
        setLoadError(false);
        setReloadTick(t => t + 1);
    };

    // 🚀 ULTRA-OPTIMISTIC OPTION SELECT HANDLER
    const handleOptionSelect = (question: Question, key: string) => {
        if (mode !== 'practice') return;
        const qIdStr = String(question.id);

        if (clickedQuestionsRef.current.has(qIdStr) || selectedAnswers[qIdStr]) {
            return;
        }

        clickedQuestionsRef.current.add(qIdStr);
        const alreadySolved = solvedIds.has(qIdStr);

        setSelectedAnswers(p => ({ ...p, [qIdStr]: key }));
        setSolvedIds(prev => new Set(prev).add(qIdStr));

        if (alreadySolved) return;

        const isCorrect = key.toLowerCase() === question.correct_option?.toLowerCase();
        const entry: AnswerEntry = {
            qId: qIdStr,
            answer: key,
            correct: isCorrect,
            subject: question.subject || activeFilters.subject || 'সাধারণ',
            chapter: (question as any).chapter || activeFilters.chapter || 'সাধারণ অধ্যায়'
        };

        const user = auth.currentUser;
        if (!user) {
            if (!authReadyRef.current) {
                earlyAnswersRef.current.push(entry);
            } else {
                showToast(t('প্রোগ্রেস সেভ করতে দয়া করে লগইন করুন।', 'Please log in to save your progress.'));
            }
            return;
        }

        const attempted = recordAnswer(user.uid, entry);

        if (attempted >= BATCH_QUESTION_THRESHOLD) {
            flushPendingSync();
        }
    };

    const observer = useRef<IntersectionObserver | null>(null);
    const lastQuestionRef = useCallback((node: HTMLDivElement | null) => {
        if (loading) return;
        if (observer.current) observer.current.disconnect();

        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore && !loadErrorRef.current) {
                setPage(prev => prev + 1);
            }
        });
        if (node) observer.current.observe(node);
    }, [loading, hasMore]);

    useEffect(() => {
        return () => observer.current?.disconnect();
    }, []);

    const hasActiveCustomFilters = activeFilters.chapter || activeFilters.topic || activeFilters.source || activeFilters.varsity || activeFilters.year;

    return (
        <div className="min-h-screen bg-slate-100/60 dark:bg-[#0B1120] font-sans text-slate-900 dark:text-slate-50 transition-colors duration-300 pb-20">

            <main className="max-w-4xl mx-auto px-2.5 sm:px-6 pt-3 sm:pt-6">
                <div className="flex items-center justify-between gap-2 mb-2 sm:mb-4 px-0.5">
                    <div>
                        <h1 className="text-sm sm:text-xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                            {t('MCQ প্রশ্নব্যাংক', 'MCQ Question Bank')}
                        </h1>
                        <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium truncate max-w-[160px] sm:max-w-md">
                            {activeFilters.subject || t('সকল বিষয়', 'All subjects')} {activeFilters.chapter ? `• ${activeFilters.chapter}` : ''}
                        </p>
                    </div>

                    <div className="flex bg-slate-200/80 dark:bg-slate-800/90 p-0.5 sm:p-1 rounded-xl shadow-xs border border-slate-300/40 dark:border-slate-700/60">
                        <button
                            onClick={() => setMode('practice')}
                            className={`px-2 py-1 sm:px-4 sm:py-1.5 rounded-lg font-bold text-[11px] sm:text-sm transition-all cursor-pointer ${mode === 'practice' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
                        >
                            {t('প্র্যাকটিস', 'Practice')}
                        </button>
                        <button
                            onClick={() => setMode('solve')}
                            className={`px-2 py-1 sm:px-4 sm:py-1.5 rounded-lg font-bold text-[11px] sm:text-sm transition-all cursor-pointer ${mode === 'solve' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'}`}
                        >
                            {t('সমাধান', 'Solve')}
                        </button>
                    </div>
                </div>

                <div className="mb-3.5 sm:mb-5 bg-white dark:bg-[#0c1322] p-2.5 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-3">
                        <CustomDropdown options={availableSubjects} value={filters.subject} onChange={(val: string) => handleFilterChange('subject', val)} placeholder={t('সব বিষয়', 'All subjects')} />
                        <CustomDropdown options={availableChapters} value={filters.chapter} onChange={(val: string) => handleFilterChange('chapter', val)} placeholder={t('সব অধ্যায়', 'All chapters')} />
                        <CustomDropdown options={availableTopics} value={filters.topic} onChange={(val: string) => handleFilterChange('topic', val)} placeholder={t('সব টপিক', 'All topics')} />
                        <CustomDropdown options={availableSources} value={filters.source} onChange={(val: string) => handleFilterChange('source', val)} placeholder={t('সব উৎস', 'All sources')} />
                    </div>

                    {showAdvanced && (
                        <div className="grid grid-cols-2 gap-1.5 sm:gap-3 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                            <CustomDropdown options={varsityList} value={filters.varsity} onChange={(val: string) => handleFilterChange('varsity', val)} placeholder={t('সব ভার্সিটি', 'All universities')} />
                            <CustomDropdown options={yearList} value={filters.year} onChange={(val: string) => handleFilterChange('year', val)} placeholder={t('সকল শিক্ষাবর্ষ (সাল)', 'All sessions (year)')} />
                        </div>
                    )}

                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="text-[11px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:opacity-80 flex items-center gap-1 cursor-pointer select-none"
                            >
                                <SlidersHorizontal size={12} />
                                <span>{showAdvanced ? t('অ্যাডভান্সড বন্ধ', 'Hide advanced') : t('অ্যাডভান্সড ফিল্টার', 'Advanced filters')}</span>
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
                                    <span>{t('রিসেট', 'Reset')}</span>
                                </button>
                            )}
                        </div>

                        <button
                            onClick={handleApplyFilters}
                            className="flex items-center gap-1 px-3 py-1.5 sm:px-4 sm:py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-[11px] sm:text-xs md:text-sm font-bold shadow-xs transition-all cursor-pointer"
                        >
                            <Search size={12} className="shrink-0" />
                            <span>{t('ফিল্টার করুন', 'Apply filters')}</span>
                        </button>
                    </div>
                </div>

                <div className="space-y-3 sm:space-y-4">
                    {questions.length === 0 && !loading && !loadError ? (
                        <div className="bg-white dark:bg-slate-900 p-8 text-center rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs sm:text-sm">
                            {t('কোনো প্রশ্ন পাওয়া যায়নি। ফিল্টার পরিবর্তন করে দেখুন।', 'No questions found. Try other filters.')}
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
                                    className={`p-4 sm:p-5 rounded-3xl border transition-all ${isSolved
                                        ? 'bg-emerald-50/20 dark:bg-emerald-950/10 border-emerald-200/60 dark:border-emerald-900/30 shadow-xs'
                                        : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700'
                                        }`}
                                >
                                    {/* Top Header: choto screen e Q number → tag → tick → actions (ek line), tarpor niche pura width e question */}
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-2.5 mb-3.5 sm:flex-nowrap sm:items-start sm:justify-between sm:gap-3">
                                        {/* choto screen e contents (children outer flex er item), boro screen e agerr moto wrapper */}
                                        <div className="contents sm:flex sm:flex-wrap sm:items-center sm:gap-2.5 sm:min-w-0 sm:flex-1">
                                            {/* Number */}
                                            <span className="order-1 inline-flex items-center justify-center w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-black shrink-0 border border-emerald-200/60 dark:border-emerald-800/50">
                                                {index + 1}
                                            </span>

                                            {/* Tag */}
                                            {questionSuffix && (
                                                <span className="order-2 sm:order-3 inline-flex items-center text-[10px] sm:text-xs font-bold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20 px-2 py-0.5 rounded-lg shrink-0">
                                                    {questionSuffix}
                                                </span>
                                            )}

                                            {/* Tick */}
                                            {isSolved && (
                                                <Check
                                                    size={16}
                                                    strokeWidth={2}
                                                    className="order-3 sm:order-4 text-emerald-500 dark:text-emerald-400 shrink-0 self-center"
                                                />
                                            )}

                                            {/* Question Text: choto screen e pura width (w-full), boro screen e agerr moto */}
                                            <h3 className="order-5 sm:order-2 w-full sm:w-auto text-sm sm:text-base md:text-lg font-bold text-slate-900 dark:text-slate-100 leading-snug">
                                                <RenderTextOrMath text={q.question} />
                                            </h3>
                                        </div>

                                        {/* Actions: Report & Bookmark (choto screen e prothom line er dan pashe) */}
                                        <div className="order-4 ml-auto sm:order-none sm:ml-0 flex items-center gap-1 shrink-0 sm:pt-0.5">
                                            <button
                                                onClick={() => setReportingQuestion(q)}
                                                className="p-1.5 rounded-xl text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
                                                title={t('প্রশ্নটি রিপোর্ট করুন', 'Report this question')}
                                            >
                                                <Flag size={14} />
                                            </button>
                                            <button
                                                onClick={() => toggleBookmark(qIdStr)}
                                                className={`p-1.5 rounded-xl transition-colors cursor-pointer ${isBookmarked
                                                    ? 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40'
                                                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                    }`}
                                                title={isBookmarked ? t('বুকমার্ক সরান', 'Remove bookmark') : t('বুকমার্ক করুন', 'Bookmark')}
                                            >
                                                <Bookmark size={15} fill={isBookmarked ? 'currentColor' : 'none'} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Options Grid */}
                                    <div className="space-y-2 sm:space-y-2.5">
                                        {Object.entries(options).map(([key, value], optIndex) => {
                                            const optionLabel = ['A', 'B', 'C', 'D'][optIndex];
                                            const isCorrect = key.toLowerCase() === q.correct_option?.toLowerCase();
                                            const isUserSelected = key.toLowerCase() === selectedOption?.toLowerCase();

                                            let cardStyle = "border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 text-slate-800 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/70";
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
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => handleOptionSelect(q, key)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault();
                                                            handleOptionSelect(q, key);
                                                        }
                                                    }}
                                                    className={`p-2.5 sm:p-3.5 border rounded-2xl cursor-pointer flex items-center gap-2.5 sm:gap-3.5 transition-all active:scale-[0.99] ${cardStyle}`}
                                                >
                                                    <span className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 shadow-xs transition-colors ${badgeStyle}`}>
                                                        {optionLabel}
                                                    </span>

                                                    <span className="text-xs sm:text-sm md:text-[15px] font-medium leading-relaxed w-full">
                                                        <RenderTextOrMath text={value} />
                                                    </span>

                                                    {(mode === 'solve' || isAnswered) && isCorrect && (
                                                        <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 ml-auto" />
                                                    )}
                                                    {isAnswered && isUserSelected && !isCorrect && (
                                                        <XCircle size={16} className="text-rose-600 dark:text-rose-400 shrink-0 ml-auto" />
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Explanation */}
                                    {(mode === 'solve' || isAnswered) && q.explanation && q.explanation.trim() !== '' && (
                                        <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/40 rounded-2xl">
                                            <div className="flex items-start gap-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                                <Lightbulb size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                                <div>
                                                    <span className="font-bold text-emerald-800 dark:text-emerald-300 mr-1">{t('ব্যাখ্যা:', 'Explanation:')}</span>
                                                    <RenderTextOrMath text={q.explanation} />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}

                    {loading && (
                        <div className="flex justify-center items-center py-5">
                            <Loader2 className="animate-spin text-emerald-600 dark:text-emerald-400" size={24} />
                        </div>
                    )}

                    {loadError && !loading && (
                        <div className="bg-white dark:bg-slate-900 p-5 text-center rounded-2xl border border-rose-200 dark:border-rose-900/40 text-slate-600 dark:text-slate-300 text-xs sm:text-sm space-y-2.5">
                            <p>{t('প্রশ্ন লোড করা যায়নি। ইন্টারনেট কানেকশন চেক করুন।', 'Could not load questions. Check your internet connection.')}</p>
                            <button
                                type="button"
                                onClick={handleRetry}
                                className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold transition-all cursor-pointer"
                            >
                                {t('আবার চেষ্টা করুন', 'Try again')}
                            </button>
                        </div>
                    )}
                </div>
            </main>

            {toast && (
                <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs sm:text-sm font-semibold shadow-2xl max-w-[90vw] text-center">
                    {toast}
                </div>
            )}

            {reportingQuestion && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 bg-black/70 backdrop-blur-xs">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-6 max-w-md w-full shadow-2xl space-y-3.5 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center gap-2 text-amber-500 font-bold text-sm sm:text-base">
                            <AlertCircle size={18} />
                            <span>{t('প্রশ্নে কোনো ভুল পেয়েছেন?', 'Found a mistake in this question?')}</span>
                        </div>

                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                            {t('দ্রুত সিলেক্ট করতে নিচের পয়েন্টগুলোতে ক্লিক করুন অথবা বিস্তারিত লিখুন:', 'Tap a reason below or write the details:')}
                        </p>

                        <div className="flex flex-wrap gap-1 pt-0.5">
                            {quickReportOptions.map((tag) => {
                                const isSelected = reportReason.includes(tag);
                                return (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={() => handleQuickTagClick(tag)}
                                        className={`px-2 py-0.5 rounded-lg text-[10px] sm:text-xs font-medium transition-all cursor-pointer border ${isSelected
                                            ? 'bg-amber-500/20 text-amber-500 border-amber-500/50 dark:bg-amber-500/25 dark:text-amber-400'
                                            : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700/60'
                                            }`}
                                    >
                                        + {tag}
                                    </button>
                                );
                            })}
                        </div>

                        <textarea
                            value={reportReason}
                            onChange={(e) => setReportReason(e.target.value)}
                            placeholder={t('যেমন: সঠিক উত্তর C হবে, কিন্তু B দেওয়া আছে...', 'e.g. The answer should be C, but B is marked...')}
                            className="w-full h-20 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 transition-colors resize-none"
                        />

                        <div className="flex items-center justify-end gap-2 pt-0.5">
                            <button
                                type="button"
                                onClick={() => { setReportingQuestion(null); setReportReason(''); }}
                                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                                {t('বাতিল', 'Cancel')}
                            </button>
                            <button
                                type="button"
                                onClick={handleReportSubmit}
                                disabled={reportSubmitting || !reportReason.trim()}
                                className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm cursor-pointer"
                            >
                                {reportSubmitting ? t('জমা হচ্ছে...', 'Sending...') : t('রিপোর্ট পাঠান', 'Send report')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function QBankClient() {
    return (
        <Suspense
            fallback={<BrandLoader />}
        >
            <QBankInner />
        </Suspense>
    );
}
