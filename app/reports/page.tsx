'use client';

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ArrowLeft, CheckCircle, Trash2, Copy, Check } from 'lucide-react';
import Link from 'next/link';

export default function ReportedQuestionsPage() {
    const [reports, setReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    useEffect(() => {
        const q = query(collection(db, 'reported_questions'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list: any[] = [];
            snapshot.forEach(docSnap => {
                list.push({ id: docSnap.id, ...docSnap.data() });
            });
            setReports(list);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const markResolved = async (id: string) => {
        await updateDoc(doc(db, 'reported_questions', id), { status: 'resolved' });
    };

    const deleteReport = async (id: string) => {
        if (confirm('রিপোর্টটি মুছে ফেলতে চান?')) {
            await deleteDoc(doc(db, 'reported_questions', id));
        }
    };

    const copyToClipboard = (id: string) => {
        navigator.clipboard.writeText(id);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 pb-20 font-sans">
            <header className="max-w-4xl mx-auto flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                    <Link href="/qbank" className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors">
                        <ArrowLeft size={16} />
                    </Link>
                    <div>
                        <h1 className="text-lg font-black flex items-center gap-2">
                            রিপোর্ট করা প্রশ্নসমূহ 🚩
                        </h1>
                        <span className="text-xs text-slate-400">মোট রিপোর্ট: {reports.length} টি</span>
                    </div>
                </div>
            </header>

            <main className="max-w-4xl mx-auto space-y-4">
                {loading ? (
                    <div className="text-center py-20 text-slate-500 text-sm">লোড হচ্ছে...</div>
                ) : reports.length === 0 ? (
                    <div className="text-center py-20 text-slate-500 text-sm">এখনও কোনো প্রশ্নের রিপোর্ট নেই।</div>
                ) : (
                    reports.map((r) => {
                        const targetQuestionId = r.questionId || r.id;

                        return (
                            <div key={r.id} className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3 shadow-sm">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {/* ⭐️ প্রশ্ন ID ব্যাজ এবং কপি বাটন */}
                                        <button
                                            onClick={() => copyToClipboard(String(targetQuestionId))}
                                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-mono font-bold transition-all cursor-pointer"
                                            title="ID কপি করুন"
                                        >
                                            <span>ID: #{targetQuestionId}</span>
                                            {copiedId === String(targetQuestionId) ? (
                                                <Check size={13} className="text-emerald-400" />
                                            ) : (
                                                <Copy size={13} />
                                            )}
                                        </button>

                                        {/* বিষয় ও অধ্যায় */}
                                        <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                            {r.subject} • {r.chapter || 'সাধারণ অধ্যায়'}
                                        </span>
                                    </div>

                                    {/* ফিক্স ও ডিলিট বাটন */}
                                    <div className="flex items-center gap-2">
                                        {r.status === 'resolved' ? (
                                            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                                                <CheckCircle size={14} /> সমাধানকৃত
                                            </span>
                                        ) : (
                                            <button
                                                onClick={() => markResolved(r.id)}
                                                className="text-xs px-3 py-1 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-600/40 font-semibold hover:bg-emerald-600/30 transition-colors"
                                            >
                                                ফিক্স মার্ক করুন
                                            </button>
                                        )}
                                        <button
                                            onClick={() => deleteReport(r.id)}
                                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                            title="রিপোর্ট মুছুন"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                {/* প্রশ্নের টেক্সট */}
                                <p className="font-bold text-base text-slate-100 pt-1 leading-snug">
                                    {r.question}
                                </p>

                                {/* রিপোর্টের কারণ */}
                                <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-900/40 text-xs text-amber-200 leading-relaxed">
                                    <span className="font-bold text-amber-400">রিপোর্টের কারণ: </span>
                                    {r.reason}
                                </div>
                            </div>
                        );
                    })
                )}
            </main>
        </div>
    );
}