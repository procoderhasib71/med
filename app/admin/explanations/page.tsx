'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, X, Pencil } from 'lucide-react';
import AdminGate from '@/components/AdminGate';
import RenderTextOrMath from '@/app/components/RenderTextOrMath';
import { authFetch } from '@/lib/authFetch';
import { useLang } from '@/lib/i18n';

type Draft = {
    question_id: string;
    text: string;
    subject: string;
    chapter: string;
    question: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    correct_option: string;
};

const LETTERS = ['a', 'b', 'c', 'd'] as const;

// AI এর বানানো ব্যাখ্যা এখানে অনুমোদন না পেলে মূল প্রশ্নে যোগ হয় না
function ExplanationsInner() {
    const { t } = useLang();
    const [items, setItems] = useState<Draft[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState('');

    const load = useCallback(async () => {
        try {
            const res = await authFetch('/api/admin/explanations');
            const data = await res.json();
            if (data.success) {
                setItems(data.items);
                setTotal(data.total);
            } else setError(data.error || t('লোড করা যায়নি', 'Could not load'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const review = async (id: string, action: 'approve' | 'reject') => {
        setBusy(id);
        setError('');
        try {
            const text = editing[id];
            const res = await authFetch('/api/admin/explanations', {
                method: 'POST',
                body: JSON.stringify({ questionId: id, action, text }),
            });
            const data = await res.json();
            if (!data.success) return setError(data.error || t('সমস্যা হয়েছে', 'Something went wrong'));
            setItems((prev) => prev.filter((x) => x.question_id !== id));
            setTotal((t) => Math.max(0, t - 1));
            setEditing((prev) => { const n = { ...prev }; delete n[id]; return n; });
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 pb-20 font-sans">
            <header className="max-w-4xl mx-auto flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
                <Link href="/reports" className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors">
                    <ArrowLeft size={16} />
                </Link>
                <div>
                    <h1 className="text-lg font-black">{t('AI ব্যাখ্যা অনুমোদন', 'Approve AI explanations')} ✨</h1>
                    <span className="text-xs text-slate-400">{t(`অপেক্ষায়: ${total} টি · অনুমোদন দিলে সাইট আর বট দুই জায়গাতেই যোগ হবে`, `Pending: ${total} · approved ones go to both the site and the bot`)}</span>
                </div>
            </header>

            <main className="max-w-4xl mx-auto space-y-4">
                {error && <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-900 text-rose-300 text-xs">{error}</div>}
                {loading ? (
                    <div className="text-center py-20 text-slate-500 text-sm">{t('লোড হচ্ছে...', 'Loading...')}</div>
                ) : items.length === 0 ? (
                    <div className="text-center py-20 text-slate-500 text-sm">{t('অনুমোদনের অপেক্ষায় কোনো ব্যাখ্যা নেই।', 'No explanations waiting for approval.')}</div>
                ) : (
                    items.map((d) => {
                        const isEditing = d.question_id in editing;
                        return (
                            <div key={d.question_id} className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                                <div className="flex items-center gap-2 flex-wrap text-xs">
                                    <span className="font-mono font-bold px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/30">#{d.question_id}</span>
                                    <span className="font-bold px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">{d.subject} • {d.chapter}</span>
                                </div>
                                <div className="font-bold text-base leading-snug"><RenderTextOrMath text={d.question} /></div>
                                <div className="grid sm:grid-cols-2 gap-2 text-sm">
                                    {LETTERS.map((l) => (
                                        <div key={l} className={`p-2.5 rounded-xl border ${l === d.correct_option ? 'border-emerald-600/60 bg-emerald-950/30' : 'border-slate-800 bg-slate-950/40'}`}>
                                            <b className="mr-1.5">{l.toUpperCase()}.</b><RenderTextOrMath text={d[`option_${l}`]} />
                                        </div>
                                    ))}
                                </div>
                                {isEditing ? (
                                    <textarea
                                        value={editing[d.question_id]}
                                        onChange={(e) => setEditing((p) => ({ ...p, [d.question_id]: e.target.value }))}
                                        rows={5}
                                        className="w-full p-3 rounded-xl bg-slate-950 border border-violet-700 text-sm text-slate-100"
                                    />
                                ) : (
                                    <div className="p-3 rounded-xl bg-violet-950/20 border border-violet-900/40 text-sm text-violet-100 leading-relaxed">
                                        <RenderTextOrMath text={d.text} />
                                    </div>
                                )}
                                <div className="flex gap-2 flex-wrap">
                                    <button disabled={busy === d.question_id} onClick={() => review(d.question_id, 'approve')}
                                        className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-600/40 font-semibold flex items-center gap-1 disabled:opacity-50">
                                        <Check size={14} /> {isEditing ? t('বদলে অনুমোদন', 'Save & approve') : t('অনুমোদন', 'Approve')}
                                    </button>
                                    {!isEditing && (
                                        <button onClick={() => setEditing((p) => ({ ...p, [d.question_id]: d.text }))}
                                            className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 border border-slate-700 font-semibold flex items-center gap-1">
                                            <Pencil size={14} /> {t('বদলাও', 'Edit')}
                                        </button>
                                    )}
                                    <button disabled={busy === d.question_id} onClick={() => review(d.question_id, 'reject')}
                                        className="text-xs px-3 py-1.5 rounded-lg bg-rose-600/15 text-rose-300 border border-rose-700/40 font-semibold flex items-center gap-1 disabled:opacity-50">
                                        <X size={14} /> {t('বাতিল', 'Reject')}
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </main>
        </div>
    );
}

export default function ExplanationsPage() {
    return (
        <AdminGate>
            <ExplanationsInner />
        </AdminGate>
    );
}
