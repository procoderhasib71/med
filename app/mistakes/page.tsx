'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth, monitoredGetDoc as getDoc } from '@/lib/firebase';
import { fetchQuestionsByIds, Question } from '../qbank/actions';
import {
  ArrowLeft,
  Trash2,
  CheckCircle2,
  XCircle,
  Sparkles,
  ExternalLink,
  Lightbulb,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import RenderTextOrMath from '@/app/components/RenderTextOrMath';

interface MistakeItem {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  userAnswer?: string;
  explanation?: string;
  subject?: string;
  tag?: string;      // 🏷️ Turso Tag
  source?: string;   // 🏷️ Fallback Source
  timestamp?: number;
}

const PAGE_SIZE = 10;

export default function MistakesPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [allMistakes, setAllMistakes] = useState<MistakeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | string>('all');

  // ⚡ ইনফিনিটি স্ক্রল ও পেজিনেশন স্টেট
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);

  // 🔄 হোম পোর্টাল ব্যাজ ক্যাশ আপডেট করার ফাংশন
  const syncPortalCache = (count: number) => {
    if (typeof window === 'undefined') return;
    try {
      const cached = localStorage.getItem('user_portal_stats');
      if (cached) {
        const parsed = JSON.parse(cached);
        parsed.mistakeCount = count;
        localStorage.setItem('user_portal_stats', JSON.stringify(parsed));
      }
    } catch { }
  };

  useEffect(() => {
    // লোকাল ক্যাশ থেকে তখনই লোড করবে যদি তাতে আসল ডেটা থাকে (ফাঁকা অ্যারে থাকলে লোডিং বন্ধ করবে না)
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('user_mistakes_cache');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setAllMistakes(parsed);
            setLoading(false);
          }
        } catch {
          localStorage.removeItem('user_mistakes_cache');
        }
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        await fetchMistakes(user.uid);
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  const fetchMistakes = async (uid: string) => {
    try {
      const mistakeDocRef = doc(db, 'users', uid, 'stats', 'mistakes');
      console.log(`🔥 [FIRESTORE READ: 1 Doc] | Path: users/${uid}/stats/mistakes (Fetching Mistakes)`);
      const snap = await getDoc(mistakeDocRef);

      if (!snap.exists()) {
        setAllMistakes([]);
        syncPortalCache(0);
        if (typeof window !== 'undefined') localStorage.removeItem('user_mistakes_cache');
        return;
      }

      const data = snap.data();
      const mistakeEntries: { id: string; userAnswer?: string; timestamp?: number }[] = [];
      const userAnswersMap: Record<string, { userAnswer?: string; timestamp?: number }> = {};

      // ১. items ম্যাপ থেকে ডেটা রিড
      if (data.items && typeof data.items === 'object') {
        Object.entries(data.items).forEach(([key, val]: any) => {
          if (val && typeof val === 'object') {
            const mId = String(val.id || key);
            mistakeEntries.push({ id: mId, userAnswer: val.userAnswer, timestamp: val.timestamp });
            userAnswersMap[mId] = val;
          }
        });
      }

      // ২. সরাসরি রুট লেভেলে ডেটা থাকলে তাও নেওয়া
      Object.entries(data).forEach(([key, val]: any) => {
        if (key !== 'items' && val && typeof val === 'object' && !userAnswersMap[key] && (val.id || val.userAnswer)) {
          const mId = String(val.id || key);
          mistakeEntries.push({ id: mId, userAnswer: val.userAnswer, timestamp: val.timestamp });
          userAnswersMap[mId] = val;
        }
      });

      // হোম পোর্টাল ব্যাজ সংখ্যা আপডেট
      syncPortalCache(mistakeEntries.length);

      if (mistakeEntries.length === 0) {
        setAllMistakes([]);
        if (typeof window !== 'undefined') localStorage.removeItem('user_mistakes_cache');
        return;
      }

      // লেটেস্ট ভুল প্রশ্ন আগে দেখানোর জন্য সর্ট
      mistakeEntries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      const ids = mistakeEntries.map(m => String(m.id));

      // মূল প্রশ্নগুলো Turso থেকে আনা
      const fetchedQuestions: Question[] = await fetchQuestionsByIds(ids);

      // মার্জ করা (tag ও source সহ)
      const fullMistakes: MistakeItem[] = fetchedQuestions.map((q) => {
        const entry = userAnswersMap[String(q.id)] || userAnswersMap[q.id];
        return {
          id: String(q.id),
          question: q.question,
          options: [q.option_a, q.option_b, q.option_c, q.option_d].filter(Boolean),
          correctAnswer: q.correct_option,
          userAnswer: entry?.userAnswer,
          explanation: q.explanation,
          subject: q.subject,
          tag: q.tag,
          source: q.source,
          timestamp: entry?.timestamp
        };
      });

      setAllMistakes(fullMistakes);
      if (typeof window !== 'undefined') {
        localStorage.setItem('user_mistakes_cache', JSON.stringify(fullMistakes));
      }
    } catch (err) {
      console.error("ভুল প্রশ্ন লোড করতে সমস্যা:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMistake = async (id: string) => {
    if (!currentUser) return;

    // UI এবং ক্যাশ থেকে তাৎক্ষণিক বাদ দেওয়া
    const updated = allMistakes.filter((m) => m.id !== id);
    setAllMistakes(updated);
    syncPortalCache(updated.length);

    if (typeof window !== 'undefined') {
      localStorage.setItem('user_mistakes_cache', JSON.stringify(updated));
    }

    try {
      const mistakeDocRef = doc(db, 'users', currentUser.uid, 'stats', 'mistakes');
      const startTime = Date.now();

      // items ম্যাপ এবং রুট দুই জায়গা থেকেই মুছে দেওয়া
      await updateDoc(mistakeDocRef, {
        [`items.${id}`]: deleteField(),
        [id]: deleteField()
      });

      console.log(`✍️ [FIRESTORE WRITE: 1 Doc] | Removed Mistake: ${id} (${Date.now() - startTime}ms)`);
    } catch (err) {
      console.error("ডিলিট করতে সমস্যা হয়েছে:", err);
    }
  };

  const subjects = ['all', ...Array.from(new Set(allMistakes.map(m => m.subject).filter(Boolean)))];
  const filteredMistakes = activeTab === 'all'
    ? allMistakes
    : allMistakes.filter(m => m.subject === activeTab);

  // ১০টি করে স্লাইস করা ডাটা
  const paginatedMistakes = filteredMistakes.slice(0, visibleCount);
  const hasMore = visibleCount < filteredMistakes.length;

  const handleTabChange = (sub: string) => {
    setActiveTab(sub);
    setVisibleCount(PAGE_SIZE);
  };

  // 🚀 ইনফিনিটি স্ক্রল হ্যান্ডলার
  const observer = useRef<IntersectionObserver | null>(null);
  const lastElementRef = useCallback((node: HTMLDivElement | null) => {
    if (loading || loadingMore) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore) {
        setLoadingMore(true);
        setTimeout(() => {
          setVisibleCount((prev) => prev + PAGE_SIZE);
          setLoadingMore(false);
        }, 200);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, loadingMore, hasMore]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 font-sans transition-colors pb-16">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-[#0B1120]/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-lg font-black tracking-tight flex items-center gap-2">
                ভুল প্রশ্নের ব্যাংক 🩺
              </h1>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                মোট ভুল: {filteredMistakes.length} টি
              </span>
            </div>
          </div>
          <Link
            href="/qbank"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-all border border-emerald-200/60 dark:border-emerald-800/60"
          >
            প্র্যাকটিস করুন <ExternalLink size={13} />
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 pt-6">
        {/* Subject Filter Pills */}
        {subjects.length > 2 && (
          <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-none mb-4">
            {subjects.map((sub: any) => (
              <button
                key={sub}
                onClick={() => handleTabChange(sub)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all capitalize cursor-pointer ${activeTab === sub
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-500'
                  }`}
              >
                {sub === 'all' ? 'সব বিষয়' : sub}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="py-24 text-center">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">ভুল প্রশ্নগুলো আনা হচ্ছে...</p>
          </div>
        ) : filteredMistakes.length === 0 ? (
          <div className="py-20 text-center bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 max-w-lg mx-auto shadow-sm">
            <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-200/60 dark:border-emerald-800/40">
              <Sparkles size={30} />
            </div>
            <h3 className="text-lg font-bold mb-1">কোনো ভুল প্রশ্ন নেই!</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              আপনি পরীক্ষায় বা প্র্যাকটিসে যেসব প্রশ্নের ভুল উত্তর দেবেন, সেগুলো এখানে স্বয়ংক্রিয়ভাবে জমা হবে যাতে আবার রিভিশন দিতে পারেন।
            </p>
            <Link
              href="/qbank"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md shadow-emerald-600/20 transition-all"
            >
              প্রশ্নব্যাংক শুরু করুন
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {paginatedMistakes.map((item, index) => {
              const isLast = paginatedMistakes.length === index + 1;
              const questionTag = item.tag && item.tag.trim() !== '' ? item.tag : item.source;
              return (
                <div
                  key={item.id}
                  ref={isLast ? lastElementRef : null}
                  className="bg-white dark:bg-[#0f172a] border border-slate-200/90 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-xs transition-all hover:border-slate-300 dark:hover:border-slate-700"
                >
                  {/* কার্ড হেডার: কাউন্ট, সাবজেক্ট ব্যাজ, Turso Tag এবং ডিলিট বাটন */}
                  <div className="flex items-center justify-between gap-2 mb-3.5 pb-2.5 border-b border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black flex items-center justify-center">
                        {index + 1}
                      </span>
                      {item.subject && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 text-xs font-bold border border-emerald-200/50 dark:border-emerald-800/40">
                          {item.subject}
                        </span>
                      )}
                      {/* 🏷️ Turso Tag ব্যাজ */}
                      {questionTag && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-extrabold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20">
                          {questionTag}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveMistake(item.id)}
                      title="ঠিক করেছি / তালিকা থেকে সরান"
                      className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-all cursor-pointer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {/* প্রশ্ন */}
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 leading-snug mb-4">
                    <RenderTextOrMath text={item.question} />
                  </h2>
                  {/* অপশন গ্রিড (২ কলাম) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 mb-4">
                    {item.options?.map((opt, optIdx) => {
                      const optionLabel = ['A', 'B', 'C', 'D'][optIdx];
                      const optionKey = ['a', 'b', 'c', 'd'][optIdx];
                      const isCorrect = optionKey === item.correctAnswer?.toLowerCase() || opt === item.correctAnswer;
                      const isUserPick = optionKey === item.userAnswer?.toLowerCase() || opt === item.userAnswer;
                      let cardBg = "bg-slate-50/60 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-200";
                      let badgeStyle = "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700";
                      if (isCorrect) {
                        cardBg = "bg-emerald-500/10 border-emerald-500 text-emerald-950 dark:text-emerald-100 font-bold shadow-xs";
                        badgeStyle = "bg-emerald-600 text-white border-emerald-600";
                      } else if (isUserPick) {
                        cardBg = "bg-rose-500/10 border-rose-500 text-rose-950 dark:text-rose-100 font-bold shadow-xs";
                        badgeStyle = "bg-rose-600 text-white border-rose-600";
                      }
                      return (
                        <div
                          key={optIdx}
                          className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${cardBg}`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 transition-colors ${badgeStyle}`}>
                              {optionLabel}
                            </span>
                            <span className="text-sm font-semibold truncate">
                              <RenderTextOrMath text={opt} />
                            </span>
                          </div>
                          {isCorrect && (
                            <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 ml-2" />
                          )}
                          {isUserPick && !isCorrect && (
                            <XCircle size={16} className="text-rose-600 dark:text-rose-400 shrink-0 ml-2" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {/* ব্যাখ্যা (Explanation) */}
                  {item.explanation && item.explanation.trim() !== '' && (
                    <div className="mt-2.5 sm:mt-3 p-3 sm:p-4 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/40 rounded-2xl">
                      <div className="flex items-start gap-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                        <Lightbulb size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-emerald-800 dark:text-emerald-300 mr-1">ব্যাখ্যা:</span>
                          <RenderTextOrMath text={item.explanation} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {/* পেজিনেশন লোডার */}
            {loadingMore && (
              <div className="flex justify-center items-center py-6">
                <Loader2 className="animate-spin text-emerald-600 dark:text-emerald-400" size={24} />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}