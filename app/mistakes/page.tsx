'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  collection, 
  getDocs, 
  deleteDoc, 
  doc, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import { 
  ArrowLeft, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  BookOpen, 
  HelpCircle, 
  AlertCircle,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';

interface MistakeItem {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  userAnswer?: string;
  explanation?: string;
  subject?: string;
  timestamp?: any;
}

export default function MistakesPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [mistakes, setMistakes] = useState<MistakeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | string>('all');

  useEffect(() => {
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
    setLoading(true);
    try {
      const q = query(
        collection(db, 'users', uid, 'mistakes'),
        orderBy('timestamp', 'desc')
      );
      const snapshot = await getDocs(q);
      const items: MistakeItem[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<MistakeItem, 'id'>)
      }));
      setMistakes(items);
    } catch (err) {
      console.error("ভুল প্রশ্ন লোড করতে সমস্যা:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMistake = async (id: string) => {
    if (!currentUser) return;
    try {
      await deleteDoc(doc(db, 'users', currentUser.uid, 'mistakes', id));
      setMistakes((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      console.error("ডিলিট করতে সমস্যা হয়েছে:", err);
    }
  };

  const subjects = ['all', ...Array.from(new Set(mistakes.map(m => m.subject).filter(Boolean)))];
  const filteredMistakes = activeTab === 'all' 
    ? mistakes 
    : mistakes.filter(m => m.subject === activeTab);

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
                মোট ভুল: {mistakes.length} টি
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
                onClick={() => setActiveTab(sub)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all capitalize ${
                  activeTab === sub
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-500'
                }`}
              >
                {sub === 'all' ? 'সব বিষয়' : sub}
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
              আপনি পরীক্ষায় বা প্র্যাকটিসে যেসব প্রশ্নের ভুল উত্তর দেবেন, সেগুলো এখানে স্বয়ংক্রিয়ভাবে জমা হবে যাতে আবার রিভিশন দিতে পারেন।
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
            {filteredMistakes.map((item, index) => (
              <div 
                key={item.id} 
                className="bg-white dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-5 shadow-xs transition-all hover:border-slate-300 dark:hover:border-slate-700"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold">
                      {index + 1}
                    </span>
                    {item.subject && (
                      <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
                        {item.subject}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveMistake(item.id)}
                    title="ঠিক করেছি / রিমুভ করুন"
                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* প্রশ্ন */}
                <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4 leading-relaxed">
                  {item.question}
                </h2>

                {/* অপশন তালিকা */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                  {item.options?.map((opt, optIdx) => {
                    const isCorrect = opt === item.correctAnswer;
                    const isUserPick = opt === item.userAnswer;
                    
                    let style = "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 text-slate-700 dark:text-slate-300";
                    if (isCorrect) {
                      style = "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-semibold";
                    } else if (isUserPick) {
                      style = "border-rose-400 bg-rose-50/80 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 font-semibold";
                    }

                    return (
                      <div 
                        key={optIdx}
                        className={`flex items-center justify-between p-3 rounded-xl border text-sm transition-all ${style}`}
                      >
                        <span>{opt}</span>
                        {isCorrect && <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />}
                        {isUserPick && !isCorrect && <XCircle size={16} className="text-rose-500 shrink-0" />}
                      </div>
                    );
                  })}
                </div>

                {/* ব্যাখ্যা (Explanation) */}
                {item.explanation && (
                  <div className="mt-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 block mb-1">
                      💡 ব্যাখ্যা:
                    </span>
                    {item.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}