'use client';

import { useState, useEffect } from 'react';
import { useLang } from '@/lib/i18n';
import CourseTag from '@/components/CourseTag';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Award,
  BookOpen,
  ExternalLink,
  ChevronDown,
  Layers,
  AlertTriangle,
  X,
  ChevronRight,
  Flame
} from 'lucide-react';
import { onAuthStateChanged } from '@/lib/session';
import { getMe, getProgress } from '@/lib/siteApi';
import { session as auth } from '@/lib/session';
import Link from 'next/link';

interface ChapterStat {
  id: string;
  subject: string;
  chapter: string;
  totalAttempted: number;
  correctAnswers: number;
}

interface SubjectStat {
  subjectId: string;
  name: string;
  totalAttempted: number;
  correctAnswers: number;
}

export default function AnalysisPage() {
    const { t, n, lang } = useLang();
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [totalAttempted, setTotalAttempted] = useState(0);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [totalScore, setTotalScore] = useState(0);

  const [subjectProgressList, setSubjectProgressList] = useState<SubjectStat[]>([]);
  const [chapterProgressList, setChapterProgressList] = useState<ChapterStat[]>([]);
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);

  const [showWarningModal, setShowWarningModal] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('analysis_cache_data');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setTotalAttempted(parsed.totalAttempted || 0);
          setTotalCorrect(parsed.totalCorrect || 0);
          setTotalScore(parsed.totalScore || 0);
          setSubjectProgressList(parsed.subjectProgressList || []);
          setChapterProgressList(parsed.chapterProgressList || []);
          setLoading(false);
        } catch {
          localStorage.removeItem('analysis_cache_data');
        }
      }
    }

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const [me, progress] = await Promise.all([getMe(), getProgress()]);
          const userSnap = { exists: () => true, data: () => me as Record<string, any> };
          const progressSnap = { exists: () => true, data: () => progress as Record<string, any> };

          let att = 0;
          let cor = 0;
          let sco = 0;

          if (userSnap.exists()) {
            const data = userSnap.data();
            att = Number(data.totalAttempted || 0);
            cor = Number(data.totalCorrect || 0);
            sco = Number(data.totalScore || 0);
            setTotalAttempted(att);
            setTotalCorrect(cor);
            setTotalScore(sco);
          }

          let chapList: ChapterStat[] = [];
          let subList: SubjectStat[] = [];

          if (progressSnap.exists()) {
            const data = progressSnap.data();

            const rawChapters = data.chapters || {};
            const cleanChaptersMap: Record<string, any> = { ...rawChapters };

            Object.keys(data).forEach((key) => {
              if (key.startsWith('chapters.')) {
                const parts = key.split('.');
                const chapKey = parts[1];
                const field = parts[2];
                if (!cleanChaptersMap[chapKey]) cleanChaptersMap[chapKey] = {};
                cleanChaptersMap[chapKey][field] = data[key];
              }
            });

            chapList = Object.entries(cleanChaptersMap).map(([id, val]: any) => ({
              id,
              subject: String(val.subject || '').trim(),
              chapter: String(val.chapter || id.split('_')[1] || 'অধ্যায়').trim(),
              totalAttempted: Number(val.totalAttempted || 0),
              correctAnswers: Number(val.correctAnswers || 0),
            }));

            const rawSubjects = data.subjects || {};
            const cleanSubjectsMap: Record<string, any> = { ...rawSubjects };

            Object.keys(data).forEach((key) => {
              if (key.startsWith('subjects.')) {
                const parts = key.split('.');
                const subKey = parts[1];
                const field = parts[2];
                if (!cleanSubjectsMap[subKey]) cleanSubjectsMap[subKey] = {};
                cleanSubjectsMap[subKey][field] = data[key];
              }
            });

            subList = Object.entries(cleanSubjectsMap).map(([subId, val]: any) => {
              const name = String(val.subject || subId).trim();
              return {
                subjectId: name,
                name: name,
                totalAttempted: Number(val.totalAttempted || 0),
                correctAnswers: Number(val.correctAnswers || 0),
              };
            });
          }

          setChapterProgressList(chapList);
          setSubjectProgressList(subList);

          if (typeof window !== 'undefined') {
            localStorage.setItem('analysis_cache_data', JSON.stringify({
              totalAttempted: att,
              totalCorrect: cor,
              totalScore: sco,
              subjectProgressList: subList,
              chapterProgressList: chapList
            }));
          }
        } catch (error) {
          console.error("Analysis data fetch error:", error);
        } finally {
          setLoading(false);
        }
      } else {
        router.push('/login');
      }
    });

    return () => unsubscribeAuth();
  }, [router]);

  const overallAccuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;
  const totalWrong = Math.max(0, totalAttempted - totalCorrect);

  const toggleSubject = (subId: string) => {
    setExpandedSubject(prev => prev === subId ? null : subId);
  };

  // 🎨 প্রফেশনাল গ্রেডিয়েন্ট ও অ্যাকুরেসি স্টাইলিং
  const getAccuracyTheme = (acc: number) => {
    if (acc >= 80) {
      return {
        text: 'text-emerald-600 dark:text-emerald-400',
        badge: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/50',
        bar: 'bg-gradient-to-r from-emerald-500 to-teal-400'
      };
    }
    if (acc >= 65) {
      return {
        text: 'text-amber-600 dark:text-amber-400',
        badge: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200/60 dark:border-amber-800/50',
        bar: 'bg-gradient-to-r from-amber-500 to-orange-400'
      };
    }
    return {
      text: 'text-rose-600 dark:text-rose-400',
      badge: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200/60 dark:border-rose-800/50',
      bar: 'bg-gradient-to-r from-rose-500 to-red-500'
    };
  };

  const weakSubjects = subjectProgressList.filter(s => {
    if (s.totalAttempted === 0) return false;
    const acc = Math.round((s.correctAnswers / s.totalAttempted) * 100);
    return acc < 70;
  });

  const hasAlert = weakSubjects.length > 0 || (totalAttempted > 0 && overallAccuracy < 70);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1120] font-sans text-slate-900 dark:text-slate-100 transition-colors pb-20">
      {/* Top Header */}
      <header className="relative bg-white/80 dark:bg-[#0B1120]/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                {t('পারফরম্যান্স অ্যানালাইসিস', 'Performance analysis')}
              </h1>
              <CourseTag />
            </div>
          </div>

          <Link href="/mistakes" className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-1.5 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold text-xs hover:bg-orange-100 dark:hover:bg-orange-500/20 transition-all border border-orange-200/60 dark:border-orange-800/60">
            {lang === 'en' ? <>Mistakes <ExternalLink size={13} /></> : <>ভুল প্রশ্নসমূহ <ExternalLink size={13} /></>}
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-5 sm:pt-7 space-y-5">
        {loading ? (
          <div className="py-24 text-center">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-sm font-semibold text-slate-500">{t('আপনার ডাটা বিশ্লেষণ করা হচ্ছে...', 'Analysing your data...')}</p>
          </div>
        ) : (
          <>
            {/* অ্যালার্ট ব্যানার */}
            {hasAlert && (
              <div
                onClick={() => setShowWarningModal(true)}
                className="group flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/25 transition-all cursor-pointer shadow-xs active:scale-[0.99]"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-rose-500 text-white shrink-0 shadow-sm shadow-rose-500/30">
                    <AlertTriangle size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs sm:text-sm font-black text-rose-600 dark:text-rose-400 truncate">
                        {lang === 'en' ? <>Warning: accuracy is low ({overallAccuracy}%)</> : <>প্রস্তুতি সতর্কতা: অ্যাকুরেসি আশঙ্কাজনক ({overallAccuracy}%)</>}
                      </h4>
                      <span className="hidden sm:inline-flex px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-700 dark:text-rose-300 text-[10px] font-bold">
                        {lang === 'en' ? <>{weakSubjects.length} weak subject(s)</> : <>{weakSubjects.length}টি দুর্বল বিষয়</>}
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-rose-700/80 dark:text-rose-300/80 truncate">
                      {t('নেগেটিভ মার্কিং এড়াতে বিস্তারিত বিশ্লেষণ ও জরুরি পরামর্শ দেখুন', 'See a detailed analysis and tips to avoid negative marking')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400 shrink-0 ml-2 group-hover:translate-x-0.5 transition-transform">
                  <span>{t('পরামর্শ দেখুন', 'See tips')}</span>
                  <ChevronRight size={15} />
                </div>
              </div>
            )}

            {/* মেট্রিক্স কার্ড */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#0f172a] border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-bold mb-2">
                  <HelpCircle size={15} className="text-blue-500" /> {t('মোট অনুশীলন', 'Total practised')}
                </div>
                <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  {lang === 'en' ? <>{totalAttempted}</> : <>{totalAttempted} <span className="text-xs sm:text-sm font-medium text-slate-400">টি</span></>}
                </div>
              </div>

              <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#0f172a] border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-bold mb-2">
                  <CheckCircle2 size={15} className="text-emerald-500" /> {t('সঠিক উত্তর', 'Correct')}
                </div>
                <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {lang === 'en' ? <>{totalCorrect}</> : <>{totalCorrect} <span className="text-xs sm:text-sm font-medium text-slate-400">টি</span></>}
                </div>
              </div>

              <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#0f172a] border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-bold mb-2">
                  <XCircle size={15} className="text-rose-500" /> {t('ভুল উত্তর', 'Wrong')}
                </div>
                <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400">
                  {lang === 'en' ? <>{totalWrong}</> : <>{totalWrong} <span className="text-xs sm:text-sm font-medium text-slate-400">টি</span></>}
                </div>
              </div>

              <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#0f172a] border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-bold mb-2">
                  <Award size={15} className="text-amber-500" /> {t('মোট পয়েন্ট', 'Total points')}
                </div>
                <div className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">
                  {totalScore}
                </div>
              </div>
            </div>

            {/* বিষয় ও অধ্যায়ভিত্তিক পারফরম্যান্স */}
            <div className="rounded-3xl bg-white dark:bg-[#0f172a] border border-slate-200/80 dark:border-slate-800 p-4 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                    <BookOpen size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold">{t('বিষয় ও অধ্যায়ভিত্তিক দক্ষতা', 'Skill by subject and chapter')}</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{t('অধ্যায়ভিত্তিক রিপোর্ট দেখতে বিষয়ের ওপর ট্যাপ করুন', 'Tap a subject to see its chapters')}</p>
                  </div>
                </div>
              </div>

              {subjectProgressList.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs sm:text-sm">
                  {t('এখনও কোনো বিষয়ের অনুশীলন শুরু করা হয়নি।', 'No subject practised yet.')}
                </div>
              ) : (
                <div className="space-y-3">
                  {subjectProgressList.map((sub) => {
                    const subAcc = sub.totalAttempted > 0 ? Math.round((sub.correctAnswers / sub.totalAttempted) * 100) : 0;
                    const isExpanded = expandedSubject === sub.subjectId;
                    const theme = getAccuracyTheme(subAcc);

                    const matchingChapters = chapterProgressList.filter(
                      c => c.subject.trim() === sub.name.trim()
                    );

                    return (
                      <div
                        key={sub.subjectId}
                        className="rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/90 overflow-hidden shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                      >
                        <div
                          onClick={() => toggleSubject(sub.subjectId)}
                          className="p-4 sm:p-4.5 cursor-pointer hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors select-none"
                        >
                          <div className="flex justify-between items-center mb-2.5">
                            <div className="flex items-center gap-2">
                              <span className="text-sm sm:text-[15px] font-bold text-slate-900 dark:text-white">
                                {sub.name}
                              </span>
                              <ChevronDown
                                size={15}
                                className={`text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-emerald-500' : ''}`}
                              />
                            </div>

                            {/* 🎯 প্রফেশনাল পার্সেন্টেজ ব্যাজ */}
                            <span className={`px-2 py-0.5 rounded-lg text-xs font-black border tracking-tight ${theme.badge}`}>
                              {subAcc}%
                            </span>
                          </div>

                          {/* 🚀 স্লিক ও প্রফেশনাল প্রগ্রেস বার */}
                          <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 shadow-xs ${theme.bar}`}
                              style={{ width: `${subAcc}%` }}
                            ></div>
                          </div>

                          <div className="flex justify-between items-center text-[11px] text-slate-500 dark:text-slate-400 pt-2.5 font-medium">
                            {lang === 'en' ? <><span>Questions: <strong className="text-slate-700 dark:text-slate-300">{sub.totalAttempted}</strong></span></> : <><span>মোট প্রশ্ন: <strong className="text-slate-700 dark:text-slate-300">{sub.totalAttempted}টি</strong></span></>}
                            <span>
                              {lang === 'en' ? <>Correct: <span className="text-emerald-600 font-bold">{sub.correctAnswers}</span> | Wrong: <span className="text-rose-500 font-bold">{Math.max(0, sub.totalAttempted - sub.correctAnswers)}</span></> : <>সঠিক: <span className="text-emerald-600 font-bold">{sub.correctAnswers}</span> | ভুল: <span className="text-rose-500 font-bold">{Math.max(0, sub.totalAttempted - sub.correctAnswers)}</span></>}
                            </span>
                          </div>
                        </div>

                        {/* ড্রপডাউন অধ্যায়সমূহ */}
                        {isExpanded && (
                          <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 space-y-2.5">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 pt-1">
                              <Layers size={13} className="text-emerald-500" />
                              <span>{t('অধ্যায়ভিত্তিক অগ্রগতি:', 'Progress by chapter:')}</span>
                            </div>

                            {matchingChapters.length === 0 ? (
                              <p className="text-[11px] text-slate-400 italic py-1 pl-1">
                                {t('এই বিষয়ের কোনো অধ্যায় এখনও শেষ করা হয়নি।', 'No chapter of this subject done yet.')}
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {matchingChapters.map((chap) => {
                                  const chapAcc = chap.totalAttempted > 0 ? Math.round((chap.correctAnswers / chap.totalAttempted) * 100) : 0;
                                  const chapTheme = getAccuracyTheme(chapAcc);

                                  return (
                                    <div
                                      key={chap.id}
                                      className="p-3 rounded-xl bg-white dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 shadow-xs"
                                    >
                                      <div className="flex justify-between items-center text-xs font-semibold mb-2">
                                        <span className="text-slate-800 dark:text-slate-200 truncate pr-2">
                                          {chap.chapter}
                                        </span>
                                        <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold border ${chapTheme.badge}`}>
                                          {chapAcc}%
                                        </span>
                                      </div>

                                      {/* চ্যাপ্টারের স্লিক প্রগ্রেস বার */}
                                      <div className="w-full h-1 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden mb-2">
                                        <div
                                          className={`h-full rounded-full ${chapTheme.bar}`}
                                          style={{ width: `${chapAcc}%` }}
                                        ></div>
                                      </div>

                                      <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                        {lang === 'en' ? <><span>Practised: {chap.totalAttempted}</span></> : <><span>অনুশীলন: {chap.totalAttempted}টি</span></>}
                                        {lang === 'en' ? <><span>Correct: {chap.correctAnswers} | Wrong: {Math.max(0, chap.totalAttempted - chap.correctAnswers)}</span></> : <><span>সঠিক: {chap.correctAnswers} | ভুল: {Math.max(0, chap.totalAttempted - chap.correctAnswers)}</span></>}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* সতর্কবার্তা পপআপ মডাল */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-rose-500/15 text-rose-500">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h3 className="text-base font-black text-rose-600 dark:text-rose-400">
                    {t('প্রস্তুতি আশঙ্কাজনক (অ্যাকুরেসি ৭০% এর নিচে)! ⚠️', 'Preparation at risk (accuracy below 70%)! ⚠️')}
                  </h3>
                  <span className="text-xs text-slate-400">{t('নেগেটিভ মার্কিং এড়ানোর গাইডলাইন', 'Guide to avoid negative marking')}</span>
                </div>
              </div>
              <button
                onClick={() => setShowWarningModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/30 text-xs sm:text-sm text-rose-800 dark:text-rose-300 leading-relaxed">
              {lang === 'en' ? <>In the medical admission test, every 4 wrong answers cost 1 mark. To stay competitive, keep your accuracy at <strong>70% to 85%</strong>.</> : <>মেডিকেল ভর্তি পরীক্ষায় প্রতি ৪টি ভুল উত্তরের জন্য ১ নম্বর কাটা যায়। মূল প্রতিযোগিতায় টিকে থাকতে গড়ে <strong>৭০% থেকে ৮৫% অ্যাকুরেসি</strong> নিশ্চিত করা অত্যন্ত জরুরি।</>}
            </div>

            {weakSubjects.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <Flame size={14} className="text-rose-500" />
                  <span>{t('যেসব বিষয়ে এখনই রিভিশন প্রয়োজন:', 'Subjects to revise right now:')}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {weakSubjects.map(ws => {
                    const acc = Math.round((ws.correctAnswers / ws.totalAttempted) * 100);
                    return (
                      <div
                        key={ws.subjectId}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 text-xs"
                      >
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate pr-2">
                          {ws.name}
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 font-black shrink-0">
                          {acc}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
              <button
                type="button"
                onClick={() => setShowWarningModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {t('বুঝেছি', 'Got it')}
              </button>
              <Link
                href="/mistakes"
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-xs font-bold shadow-sm transition-all"
              >
                {t('ভুল প্রশ্নগুলো রিভিশন দিন', 'Revise the mistakes')}
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}