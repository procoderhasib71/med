'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Target,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Award,
  BookOpen,
  Sparkles,
  ExternalLink,
  ChevronDown,
  Layers,
  AlertTriangle
} from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
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
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [totalAttempted, setTotalAttempted] = useState(0);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [totalScore, setTotalScore] = useState(0);

  const [subjectProgressList, setSubjectProgressList] = useState<SubjectStat[]>([]);
  const [chapterProgressList, setChapterProgressList] = useState<ChapterStat[]>([]);
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);

  const subjectNamesMap: Record<string, string> = {
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

  useEffect(() => {
    let unsubscribeUserDoc: (() => void) | null = null;
    let unsubscribeSubCol: (() => void) | null = null;
    let unsubscribeChapCol: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);

        // ১. সামগ্রিক স্কোর ও অ্যাকুরেসি
        const userRef = doc(db, 'users', user.uid);
        unsubscribeUserDoc = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setTotalAttempted(data.totalAttempted || 0);
            setTotalCorrect(data.totalCorrect || 0);
            setTotalScore(data.totalScore || 0);
          }
        });

        // ২. বিষয়ভিত্তিক প্রোগ্রেস
        const subColRef = collection(db, `users/${user.uid}/subject_progress`);
        unsubscribeSubCol = onSnapshot(subColRef, (snapshot) => {
          const list: SubjectStat[] = [];
          snapshot.docs.forEach((docSnap) => {
            const data = docSnap.data();
            const subId = docSnap.id;
            list.push({
              subjectId: subId,
              name: subjectNamesMap[subId] || subId,
              totalAttempted: data.totalAttempted || 0,
              correctAnswers: data.correctAnswers || 0,
            });
          });
          setSubjectProgressList(list);
          setLoading(false);
        });

        // ৩. অধ্যায়ভিত্তিক প্রোগ্রেস
        const chapColRef = collection(db, `users/${user.uid}/chapter_progress`);
        unsubscribeChapCol = onSnapshot(chapColRef, (snapshot) => {
          const list: ChapterStat[] = [];
          snapshot.docs.forEach((docSnap) => {
            const data = docSnap.data();
            list.push({
              id: docSnap.id,
              subject: data.subject || '',
              chapter: data.chapter || 'সাধারণ অধ্যায়',
              totalAttempted: data.totalAttempted || 0,
              correctAnswers: data.correctAnswers || 0,
            });
          });
          setChapterProgressList(list);
        });

      } else {
        router.push('/login');
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUserDoc) unsubscribeUserDoc();
      if (unsubscribeSubCol) unsubscribeSubCol();
      if (unsubscribeChapCol) unsubscribeChapCol();
    };
  }, [router]);

  const overallAccuracy = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;
  const totalWrong = Math.max(0, totalAttempted - totalCorrect);

  const toggleSubject = (subId: string) => {
    setExpandedSubject(prev => prev === subId ? null : subId);
  };

  // ⭐️ ৭০% এর নিচে নামলেই লাল (Danger), ৮৫% বা তার উপরে গ্রিন
  const getAccuracyColor = (acc: number) => {
    if (acc >= 85) return { text: 'text-emerald-500 dark:text-emerald-400', bar: 'bg-emerald-500' };
    if (acc >= 70) return { text: 'text-amber-500 dark:text-amber-400', bar: 'bg-amber-500' };
    return { text: 'text-rose-500 dark:text-rose-400', bar: 'bg-rose-500' };
  };

  // ৭০% এর নিচে যেসব সাবজেক্ট আছে সেগুলোকে খুঁজে বের করা
  const weakSubjects = subjectProgressList.filter(s => {
    if (s.totalAttempted === 0) return false;
    const acc = Math.round((s.correctAnswers / s.totalAttempted) * 100);
    return acc < 70;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1120] font-sans text-slate-900 dark:text-slate-100 transition-colors pb-20">
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-[#0B1120]/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-lg font-black tracking-tight flex items-center gap-2">
                পারফরম্যান্স অ্যানালাইসিস 📊
              </h1>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                আপনার মেডিকেল প্রস্তুতির গভীর মূল্যায়ন
              </span>
            </div>
          </div>

          <Link href="/mistakes" className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold text-xs hover:bg-orange-100 dark:hover:bg-orange-500/20 transition-all border border-orange-200/60 dark:border-orange-800/60">
            ভুল প্রশ্নসমূহ <ExternalLink size={13} />
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-6">
        {loading ? (
          <div className="py-24 text-center">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-sm font-semibold text-slate-500">আপনার ডাটা বিশ্লেষণ করা হচ্ছে...</p>
          </div>
        ) : (
          <>
            {/* Quick Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-bold mb-2">
                  <HelpCircle size={16} className="text-blue-500" /> মোট অনুশীলন
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {totalAttempted} <span className="text-sm font-medium text-slate-400">টি</span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-bold mb-2">
                  <CheckCircle2 size={16} className="text-emerald-500" /> সঠিক উত্তর
                </div>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {totalCorrect} <span className="text-sm font-medium text-slate-400">টি</span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-bold mb-2">
                  <XCircle size={16} className="text-rose-500" /> ভুল উত্তর
                </div>
                <div className="text-2xl font-black text-rose-600 dark:text-rose-400">
                  {totalWrong} <span className="text-sm font-medium text-slate-400">টি</span>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-bold mb-2">
                  <Award size={16} className="text-amber-500" /> মোট অর্জিত পয়েন্ট
                </div>
                <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
                  {totalScore}
                </div>
              </div>
            </div>

            {/* 🚨 ৭০% এর নিচে নামলেই ওয়ার্নিং অ্যালার্ট কার্ড */}
            {(weakSubjects.length > 0 || (totalAttempted > 0 && overallAccuracy < 70)) && (
              <div className="p-5 sm:p-6 rounded-3xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-4">
                <div className="p-2.5 rounded-2xl bg-rose-500/20 text-rose-500 shrink-0 mt-0.5">
                  <AlertTriangle size={24} />
                </div>
                <div className="space-y-1.5 text-xs sm:text-sm">
                  <h4 className="font-bold text-rose-600 dark:text-rose-400 text-base">
                    সতর্কতা: প্রস্তুতি আশঙ্কাজনক (অ্যাকুরেসি ৭০% এর নিচে)! ⚠️
                  </h4>
                  <p className="text-rose-700 dark:text-rose-300 leading-relaxed">
                    মেডিকেল ভর্তি পরীক্ষায় প্রতি ৪টি ভুল উত্তরের জন্য ১ নম্বর কাটা যায়। নেগেটিভ মার্কিং এড়াতে কমপক্ষে ৭০-৮৫% অ্যাকুরেসি বজায় রাখা আবশ্যক।
                  </p>
                  {weakSubjects.length > 0 && (
                    <div className="pt-2 flex flex-wrap gap-2">
                      <span className="font-semibold text-rose-800 dark:text-rose-200 self-center">জরুরি রিভিশন প্রয়োজন:</span>
                      {weakSubjects.map(ws => {
                        const acc = Math.round((ws.correctAnswers / ws.totalAttempted) * 100);
                        return (
                          <span key={ws.subjectId} className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-600 dark:text-rose-300 font-bold border border-rose-500/30 text-xs">
                            {ws.name} ({acc}%)
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* বিষয় ও অধ্যায়ভিত্তিক সেকশন */}
            <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">বিষয় ও অধ্যায়ভিত্তিক দক্ষতা</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">যে কোনো বিষয়ের ওপর ক্লিক করে অধ্যায়ভিত্তিক রিপোর্ট দেখুন</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {subjectProgressList.map((sub) => {
                  const subAcc = sub.totalAttempted > 0 ? Math.round((sub.correctAnswers / sub.totalAttempted) * 100) : 0;
                  const isExpanded = expandedSubject === sub.subjectId;
                  const colors = getAccuracyColor(subAcc);

                  const matchingChapters = chapterProgressList.filter(
                    c => c.subject === sub.subjectId || c.subject === sub.name
                  );

                  return (
                    <div 
                      key={sub.subjectId} 
                      className={`rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border overflow-hidden transition-all duration-200 ${
                        subAcc < 70 ? 'border-rose-500/40 dark:border-rose-500/30' : 'border-slate-200/70 dark:border-slate-800'
                      }`}
                    >
                      <div 
                        onClick={() => toggleSubject(sub.subjectId)}
                        className="p-4 sm:p-5 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/70 transition-colors select-none"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-base font-bold text-slate-900 dark:text-white">
                              {sub.name}
                            </span>
                            <ChevronDown 
                              size={18} 
                              className={`text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-emerald-500' : ''}`} 
                            />
                          </div>
                          <span className={`text-base font-black ${colors.text}`}>
                            {subAcc}%
                          </span>
                        </div>

                        <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-700/60 overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${colors.bar}`} 
                            style={{ width: `${subAcc}%` }}
                          ></div>
                        </div>

                        <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 pt-2">
                          <span>মোট উত্তর: {sub.totalAttempted} টি</span>
                          <span>সঠিক: {sub.correctAnswers} | ভুল: {sub.totalAttempted - sub.correctAnswers}</span>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="px-4 pb-4 pt-2 border-t border-slate-200/60 dark:border-slate-750 bg-white/40 dark:bg-slate-900/40 space-y-3">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 pt-1">
                            <Layers size={14} className="text-emerald-500" />
                            <span>অধ্যায়ভিত্তিক পারফরম্যান্স:</span>
                          </div>

                          {matchingChapters.length === 0 ? (
                            <p className="text-xs text-slate-400 italic py-2 pl-2">
                              এই বিষয়ের কোনো অধ্যায় সিলেক্ট করে এখনও পরীক্ষা দেওয়া হয়নি।
                            </p>
                          ) : (
                            <div className="space-y-2.5 pl-1">
                              {matchingChapters.map((chap) => {
                                const chapAcc = chap.totalAttempted > 0 ? Math.round((chap.correctAnswers / chap.totalAttempted) * 100) : 0;
                                const chapColors = getAccuracyColor(chapAcc);

                                return (
                                  <div 
                                    key={chap.id}
                                    className="p-3 rounded-xl bg-slate-100/60 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50"
                                  >
                                    <div className="flex justify-between items-center text-xs sm:text-sm font-semibold mb-1.5">
                                      <span className="text-slate-800 dark:text-slate-200 truncate pr-2">
                                        {chap.chapter}
                                      </span>
                                      <span className={`font-black shrink-0 ${chapColors.text}`}>
                                        {chapAcc}%
                                      </span>
                                    </div>

                                    <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden mb-1.5">
                                      <div 
                                        className={`h-full rounded-full ${chapColors.bar}`} 
                                        style={{ width: `${chapAcc}%` }}
                                      ></div>
                                    </div>

                                    <div className="flex justify-between items-center text-[11px] text-slate-500 dark:text-slate-400">
                                      <span>অনুশীলন: {chap.totalAttempted} টি</span>
                                      <span>সঠিক: {chap.correctAnswers} | ভুল: {chap.totalAttempted - chap.correctAnswers}</span>
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
            </div>
          </>
        )}
      </main>
    </div>
  );
}