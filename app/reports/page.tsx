'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle, Trash2, Copy, Check, Bot, Sparkles } from 'lucide-react';
import Link from 'next/link';
import AdminGate from '@/components/AdminGate';
import { authFetch } from '@/lib/authFetch';

type Report = {
    id: string;
    questionId?: string;
    question?: string;
    options?: string[];
    correct_option?: string;
    subject?: string;
    chapter?: string;
    reason?: string;
    status?: string;
    via?: string;
    aiVerdict?: string;
    aiOption?: string;
    fixedTo?: string;
    fixedFrom?: string;
    reportedByEmail?: string;
    reportedByName?: string;
};

const LETTERS = ['a', 'b', 'c', 'd'];

function ReportsInner() {
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        try {
            const res = await authFetch('/api/admin/reports');
            const data = await res.json();
            if (data.success) setReports(data.reports);
            else setError(data.error || 'লোড করা যায়নি');
        } catch {
            setError('লোড করা যায়নি');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const act = async (id: string, action: 'resolve' | 'delete' | 'fix', option?: string) => {
        if (action === 'delete' && !confirm('রিপোর্টটি মুছে ফেলতে চান?')) return;
        if (action === 'fix' && !confirm(`সঠিক উত্তর ${option?.toUpperCase()} করে সাইট আর বট দুই জায়গাতেই বদলাবে। নিশ্চিত?`)) return;
        setBusyId(id);
        setError('');
        try {
            const res = await authFetch('/api/admin/reports', { method: 'POST', body: JSON.stringify({ id, action, option }) });
            const data = await res.json();
            if (!data.success) setError(data.error || 'সমস্যা হয়েছে');
            await load();
        } finally {
            setBusyId(null);
        }
    };

    const copyToClipboard = (id: string) => {
        navigator.clipboard.writeText(id);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const pending = reports.filter((r) => r.status !== 'resolved').length;

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 pb-20 font-sans">
            <header className="max-w-4xl mx-auto flex items-center justify-between mb-6 pb-4 border-b border-slate-800 gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                    <Link href="/qbank" className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors">
                        <ArrowLeft size={16} />
                    </Link>
                    <div>
                        <h1 className="text-lg font-black flex items-center gap-2">রিপোর্ট করা প্রশ্নসমূহ 🚩</h1>
                        <span className="text-xs text-slate-400">মোট রিপোর্ট: {reports.length} টি · বাকি: {pending} টি</span>
                    </div>
                </div>
                <Link href="/admin/explanations" className="text-xs px-3 py-1.5 rounded-lg bg-violet-600/20 text-violet-300 border border-violet-600/40 font-semibold flex items-center gap-1.5">
                    <Sparkles size={14} /> AI ব্যাখ্যা অনুমোদন
                </Link>
            </header>

            <main className="max-w-4xl mx-auto space-y-4">
                {error && <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-900 text-rose-300 text-xs">{error}</div>}
                {loading ? (
                    <div className="text-center py-20 text-slate-500 text-sm">লোড হচ্ছে...</div>
                ) : reports.length === 0 ? (
                    <div className="text-center py-20 text-slate-500 text-sm">এখনও কোনো প্রশ্নের রিপোর্ট নেই।</div>
                ) : (
                    reports.map((r) => {
                        const targetQuestionId = r.questionId || r.id;
                        const correct = (r.correct_option || '').toLowerCase();
                        const resolved = r.status === 'resolved';
                        const busy = busyId === r.id;

                        return (
                            <div key={r.id} className={`p-5 rounded-2xl bg-slate-900/80 border space-y-3 shadow-sm ${resolved ? 'border-slate-800 opacity-70' : 'border-slate-700'}`}>
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <button
                                            onClick={() => copyToClipboard(String(targetQuestionId))}
                                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-mono font-bold transition-all cursor-pointer"
                                            title="ID কপি করুন"
                                        >
                                            <span>ID: #{targetQuestionId}</span>
                                            {copiedId === String(targetQuestionId) ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                                        </button>
                                        <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                            {r.subject} • {r.chapter || 'সাধারণ অধ্যায়'}
                                        </span>
                                        {r.via === 'bot' && (
                                            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-300 border border-sky-500/30 flex items-center gap-1">
                                                <Bot size={13} /> বট থেকে
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {resolved ? (
                                            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                                                <CheckCircle size={14} /> {r.fixedTo ? `উত্তর ${r.fixedFrom?.toUpperCase() || '?'} → ${r.fixedTo.toUpperCase()}` : 'সমাধানকৃত'}
                                            </span>
                                        ) : (
                                            <button
                                                disabled={busy}
                                                onClick={() => act(r.id, 'resolve')}
                                                className="text-xs px-3 py-1 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-600/40 font-semibold hover:bg-emerald-600/30 transition-colors disabled:opacity-50"
                                            >
                                                কিছু বদলানো লাগবে না
                                            </button>
                                        )}
                                        <button
                                            disabled={busy}
                                            onClick={() => act(r.id, 'delete')}
                                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                            title="রিপোর্ট মুছুন"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>

                                <p className="font-bold text-base text-slate-100 pt-1 leading-snug">{r.question}</p>

                                {Array.isArray(r.options) && r.options.length > 0 && (
                                    <div className="grid sm:grid-cols-2 gap-2">
                                        {r.options.map((opt, i) => {
                                            const letter = LETTERS[i];
                                            const isCorrect = letter === correct;
                                            return (
                                                <div key={i} className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border text-sm ${isCorrect ? 'border-emerald-600/60 bg-emerald-950/30' : 'border-slate-800 bg-slate-950/40'}`}>
                                                    <span><b className="mr-1.5">{letter.toUpperCase()}.</b>{opt}</span>
                                                    {isCorrect ? (
                                                        <span className="text-[10px] font-bold text-emerald-400 shrink-0">এখনকার উত্তর</span>
                                                    ) : !resolved && (
                                                        <button
                                                            disabled={busy}
                                                            onClick={() => act(r.id, 'fix', letter)}
                                                            className="text-[11px] shrink-0 px-2 py-0.5 rounded-md bg-slate-800 hover:bg-emerald-700 text-slate-200 font-semibold disabled:opacity-50"
                                                        >
                                                            এটা সঠিক
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-900/40 text-xs text-amber-200 leading-relaxed">
                                    <span className="font-bold text-amber-400">রিপোর্টের কারণ: </span>
                                    {r.reason}
                                    {(r.reportedByName || r.reportedByEmail) && (
                                        <span className="text-amber-500/70"> · {r.reportedByName || r.reportedByEmail}</span>
                                    )}
                                </div>

                                {r.aiVerdict && (
                                    <div className="p-3 rounded-xl bg-violet-950/20 border border-violet-900/40 text-xs text-violet-200 leading-relaxed">
                                        <span className="font-bold text-violet-300">🤖 AI এর যাচাই{r.aiOption ? ` (মনে করছে উত্তর ${r.aiOption.toUpperCase()})` : ''}: </span>
                                        {r.aiVerdict}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </main>
        </div>
    );
}

export default function ReportedQuestionsPage() {
    return (
        <AdminGate>
            <ReportsInner />
        </AdminGate>
    );
}
