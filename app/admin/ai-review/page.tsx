'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Loader2, Pencil, ShieldCheck, Sparkles, X } from 'lucide-react';
import AdminGate from '@/components/AdminGate';
import RenderTextOrMath from '@/app/components/RenderTextOrMath';
import { authFetch } from '@/lib/authFetch';
import { LangSwitch, useLang } from '@/lib/i18n';

// AI অডিটে (explain স্ক্রিপ্ট) যেসব প্রশ্নে ভুল ধরা পড়েছে, সেগুলো এখানে দেখে ঠিক করা হয়।
// প্রতিটা বদল hermes_mcq_fixes এ ব্যাকআপ থাকে; রিভিউ হলে প্রশ্নটা তালিকা থেকে সরে যায়।

type Item = {
    id: string;
    subject: string;
    chapter: string;
    topic: string;
    question: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    correct_option: string;
    explanation: string | null;
    error: string;
    new_correct_option: string | null;
    new_explanation: string | null;
    ai_type: AiType;
    ai_src: AiSrc;
};
type AiType = 'answer' | 'explanation' | 'typo' | 'multiple' | 'none' | 'unclear';
type AiSrc = 'error' | 'pre';
type Count = { subject: string; type: AiType; src: AiSrc; n: number };
type Form = { question: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_option: string; explanation: string };

const LETTERS = ['a', 'b', 'c', 'd'] as const;
const PAGE = 20;

// ডাটাবেস থেকে: AI এর উত্তর (new_correct_option) আর error এর শুরু (lib/questionAdmin.ts এর AI_TYPE)
const TYPES: { key: AiType; label: readonly [string, string]; color: string }[] = [
    { key: 'answer', label: ['উত্তর ভুল', 'Wrong answer'], color: 'text-rose-300 bg-rose-500/10 border-rose-500/30' },
    { key: 'explanation', label: ['শুধু ব্যাখ্যা দুর্বল', 'Weak explanation'], color: 'text-amber-300 bg-amber-500/10 border-amber-500/30' },
    { key: 'typo', label: ['উত্তর ঠিক, প্রশ্নে/অপশনে সমস্যা', 'Answer OK, question/option issue'], color: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30' },
    { key: 'multiple', label: ['একাধিক সঠিক উত্তর', 'Multiple correct'], color: 'text-orange-300 bg-orange-500/10 border-orange-500/30' },
    { key: 'none', label: ['অপশনে উত্তর নেই', 'Answer not in options'], color: 'text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-500/30' },
    { key: 'unclear', label: ['প্রশ্ন অস্পষ্ট', 'Unclear question'], color: 'text-slate-300 bg-slate-500/10 border-slate-500/30' },
];
const typeInfo = (k: AiType) => TYPES.find((x) => x.key === k) || TYPES[0];
const SRCS: { key: AiSrc; label: readonly [string, string] }[] = [
    { key: 'error', label: ['প্রশ্নে ভুল (Error:)', 'Question error (Error:)'] },
    { key: 'pre', label: ['আগের ব্যাখ্যায় ভুল (pre-explain)', 'Old explanation error (pre-explain)'] },
];

function ReviewCard({ item, onDone }: { item: Item; onDone: (item: Item) => void }) {
    const { t } = useLang();
    const [form, setForm] = useState<Form | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const dbOpt = String(item.correct_option || '').trim().toLowerCase();
    const aiOpts = String(item.new_correct_option || '').toLowerCase().split(',').map((x) => x.trim());
    const canApply = item.ai_type === 'explanation' || item.ai_type === 'answer';
    const info = typeInfo(item.ai_type);

    const send = async (action: 'apply' | 'keep' | 'save', edits?: Partial<Form>) => {
        setBusy(true);
        setError('');
        try {
            const res = await authFetch('/api/admin/ai-review', { method: 'POST', body: JSON.stringify({ questionId: item.id, action, edits }) });
            const data = await res.json().catch(() => ({}));
            if (!data.success) return setError(data.error || t('সমস্যা হয়েছে', 'Something went wrong'));
            onDone(item);
        } finally {
            setBusy(false);
        }
    };

    const startEdit = () => setForm({
        question: item.question || '',
        option_a: item.option_a || '',
        option_b: item.option_b || '',
        option_c: item.option_c || '',
        option_d: item.option_d || '',
        correct_option: LETTERS.includes(aiOpts[0] as any) ? aiOpts[0] : dbOpt,
        explanation: item.new_explanation || item.explanation || '',
    });

    const input = 'w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-violet-500';
    const btn = 'text-xs px-3 py-1.5 rounded-lg border font-semibold flex items-center gap-1 disabled:opacity-50 cursor-pointer';

    return (
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="font-mono font-bold px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/30">#{item.id}</span>
                <span className="font-bold px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">{item.subject} • {item.chapter}</span>
                <span className={`font-bold px-2.5 py-1 rounded-lg border ${info.color}`}>{t(info.label[0], info.label[1])}</span>
            </div>

            <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-900/40 text-xs text-amber-200 leading-relaxed">
                <b>{t('AI যা বলছে', 'AI says')}:</b> {item.error}
            </div>

            {form ? (
                <div className="space-y-2">
                    <label className="block text-xs text-slate-400">{t('প্রশ্ন', 'Question')}</label>
                    <textarea rows={3} className={input} value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} />
                    <div className="grid sm:grid-cols-2 gap-2">
                        {LETTERS.map((l) => (
                            <label key={l} className="flex items-center gap-2">
                                <input type="radio" name={`ans-${item.id}`} checked={form.correct_option === l} onChange={() => setForm({ ...form, correct_option: l })} className="accent-emerald-500" />
                                <b className="text-sm w-4">{l.toUpperCase()}.</b>
                                <input className={input} value={form[`option_${l}`]} onChange={(e) => setForm({ ...form, [`option_${l}`]: e.target.value })} />
                            </label>
                        ))}
                    </div>
                    <p className="text-[11px] text-slate-500">{t('গোল ঘরে টিক দিয়ে সঠিক উত্তর বাছুন', 'Tick the circle to pick the correct answer')}</p>
                    <label className="block text-xs text-slate-400">{t('ব্যাখ্যা', 'Explanation')}</label>
                    <textarea rows={5} className={input} value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} />
                    <div className="flex gap-2 flex-wrap pt-1">
                        <button disabled={busy} onClick={() => send('save', form)} className={`${btn} bg-emerald-600/20 text-emerald-300 border-emerald-600/40`}>
                            {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} {t('সেভ করুন', 'Save')}
                        </button>
                        <button disabled={busy} onClick={() => setForm(null)} className={`${btn} bg-slate-800 text-slate-200 border-slate-700`}>
                            <X size={14} /> {t('বাদ দিন', 'Cancel')}
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    <div className="font-bold text-base leading-snug"><RenderTextOrMath text={item.question} /></div>
                    <div className="grid sm:grid-cols-2 gap-2 text-sm">
                        {LETTERS.map((l) => {
                            const isDb = l === dbOpt;
                            const isAi = aiOpts.includes(l);
                            const tone = isAi ? 'border-emerald-600/60 bg-emerald-950/30' : isDb ? 'border-rose-600/50 bg-rose-950/20' : 'border-slate-800 bg-slate-950/40';
                            return (
                                <div key={l} className={`p-2.5 rounded-xl border ${tone}`}>
                                    <div className="flex items-start gap-1.5">
                                        <b>{l.toUpperCase()}.</b>
                                        <div className="flex-1 min-w-0"><RenderTextOrMath text={item[`option_${l}`]} /></div>
                                    </div>
                                    {(isDb || isAi) && (
                                        <div className="flex gap-1 mt-1.5 text-[10px] font-bold">
                                            {isDb && <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300">{t('ডাটাবেসের উত্তর', 'DB answer')}</span>}
                                            {isAi && <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">{t('AI এর উত্তর', 'AI answer')}</span>}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    {!dbOpt && <p className="text-xs text-rose-300">{t('ডাটাবেসে কোনো উত্তর দেওয়া নেই', 'No answer set in the database')}</p>}
                    {item.ai_type === 'none' && <p className="text-xs text-fuchsia-300">{t('AI এর মতে সঠিক উত্তর কোনো অপশনে নেই, নিচের ব্যাখ্যায় আসল উত্তর আছে', 'AI says no option is correct; the real answer is in the explanation below')}</p>}
                    {item.ai_type === 'typo' && <p className="text-xs text-cyan-300">{t('উত্তর ঠিক আছে, কিন্তু প্রশ্ন বা অপশনে সমস্যা। "নিজে ঠিক করুন" দিয়ে ঠিক করুন, শুধু ব্যাখ্যা বসালে সমস্যাটা থেকে যাবে।', 'The answer is right but the question or an option has an issue. Use "Edit manually"; adding only the explanation leaves the issue in place.')}</p>}

                    <div className="grid md:grid-cols-2 gap-2">
                        <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800 text-sm">
                            <div className="text-[11px] font-bold text-slate-400 mb-1">{t('এখনকার ব্যাখ্যা', 'Current explanation')}</div>
                            {item.explanation ? <RenderTextOrMath text={item.explanation} /> : <span className="text-slate-500 text-xs">{t('নেই', 'None')}</span>}
                        </div>
                        <div className="p-3 rounded-xl bg-violet-950/20 border border-violet-900/40 text-sm">
                            <div className="text-[11px] font-bold text-violet-300 mb-1 flex items-center gap-1"><Sparkles size={12} /> {t('AI এর ব্যাখ্যা', 'AI explanation')}</div>
                            {item.new_explanation ? <RenderTextOrMath text={item.new_explanation} /> : <span className="text-slate-500 text-xs">{t('নেই', 'None')}</span>}
                        </div>
                    </div>

                    {error && <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-900 text-rose-300 text-xs">{error}</div>}
                    <div className="flex gap-2 flex-wrap">
                        {canApply && (
                            <button disabled={busy} onClick={() => send('apply')} className={`${btn} bg-emerald-600/20 text-emerald-300 border-emerald-600/40`}>
                                {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                {item.ai_type === 'answer' ? t('AI এর উত্তর ও ব্যাখ্যা বসান', 'Use AI answer & explanation') : t('AI এর ব্যাখ্যা বসান', 'Use AI explanation')}
                            </button>
                        )}
                        <button disabled={busy} onClick={startEdit} className={`${btn} bg-slate-800 text-slate-200 border-slate-700`}>
                            <Pencil size={14} /> {t('নিজে ঠিক করুন', 'Edit manually')}
                        </button>
                        <button disabled={busy} onClick={() => send('keep')} className={`${btn} bg-sky-600/15 text-sky-300 border-sky-700/40`}>
                            <ShieldCheck size={14} /> {t('ঠিক আছে, যেমন আছে রাখুন', 'Fine, keep as is')}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

function AiReviewInner() {
    const { t } = useLang();
    const [subject, setSubject] = useState('');
    const [type, setType] = useState<AiType | ''>('');
    const [src, setSrc] = useState<AiSrc | ''>('');
    const [items, setItems] = useState<Item[]>([]);
    const [counts, setCounts] = useState<Count[]>([]);
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = useCallback(async (from: number) => {
        setLoading(true);
        setError('');
        try {
            const q = new URLSearchParams({ subject, type, src, offset: String(from), limit: String(PAGE) });
            const res = await authFetch(`/api/admin/ai-review?${q}`);
            const data = await res.json().catch(() => ({}));
            if (!data.success) return setError(data.error || t('লোড করা যায়নি', 'Could not load'));
            setItems((prev) => (from === 0 ? data.items : [...prev, ...data.items]));
            setCounts(data.counts);
            setOffset(from + data.items.length);
            setHasMore(data.items.length === PAGE);
        } finally {
            setLoading(false);
        }
    }, [subject, type, src]);

    useEffect(() => { load(0); }, [load]);

    // রিভিউ হলে কার্ড সরাই আর গোনা কমাই; পরের পেজের offset ও এক কমে
    const done = (it: Item) => {
        setItems((prev) => prev.filter((x) => x.id !== it.id));
        setCounts((prev) => prev.map((c) => (c.subject === it.subject && c.type === it.ai_type && c.src === it.ai_src ? { ...c, n: c.n - 1 } : c)).filter((c) => c.n > 0));
        setOffset((o) => Math.max(0, o - 1));
    };

    const subjects = useMemo(() => {
        const m = new Map<string, number>();
        counts.forEach((c) => m.set(c.subject, (m.get(c.subject) || 0) + c.n));
        return [...m.entries()].sort((a, b) => b[1] - a[1]);
    }, [counts]);
    // প্রতিটা চিপের সংখ্যা বাকি দুই বাছাই মেনে গোনা
    const count = (f: { type?: AiType | ''; src?: AiSrc | '' }) => counts
        .filter((c) => (!subject || c.subject === subject) && (!f.type || c.type === f.type) && (!f.src || c.src === f.src))
        .reduce((s, c) => s + c.n, 0);
    const all = counts.reduce((s, c) => s + c.n, 0);

    const chip = (active: boolean) => `text-xs px-3 py-1.5 rounded-lg border font-semibold cursor-pointer ${active ? 'bg-violet-600/25 text-violet-200 border-violet-500/60' : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-600'}`;

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 pb-20 font-sans">
            <header className="max-w-5xl mx-auto flex items-center gap-3 mb-5 pb-4 border-b border-slate-800">
                <Link href="/admin" className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 transition-colors">
                    <ArrowLeft size={16} />
                </Link>
                <div className="flex-1">
                    <h1 className="text-lg font-black">{t('AI এর ধরা ভুল যাচাই', 'Review AI-flagged errors')}</h1>
                    <span className="text-xs text-slate-400">{t(`বাকি: ${all} টি · প্রতিটা বদলের ব্যাকআপ থাকে`, `Remaining: ${all} · every change is backed up`)}</span>
                </div>
                <LangSwitch />
            </header>

            <main className="max-w-5xl mx-auto space-y-4">
                <div className="space-y-2">
                    <select value={subject} onChange={(e) => setSubject(e.target.value)}
                        className="w-full sm:w-auto p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-100">
                        <option value="">{t(`সব বিষয় (${all})`, `All subjects (${all})`)}</option>
                        {subjects.map(([s, n]) => <option key={s} value={s}>{s} ({n})</option>)}
                    </select>
                    <div className="flex gap-2 flex-wrap items-center">
                        <span className="text-[11px] text-slate-500 w-14">{t('কোথায়', 'Where')}</span>
                        <button onClick={() => setSrc('')} className={chip(src === '')}>{t('সব', 'All')} ({count({ type })})</button>
                        {SRCS.map((x) => (
                            <button key={x.key} onClick={() => setSrc(x.key)} className={chip(src === x.key)}>
                                {t(x.label[0], x.label[1])} ({count({ type, src: x.key })})
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-2 flex-wrap items-center">
                        <span className="text-[11px] text-slate-500 w-14">{t('ধরন', 'Type')}</span>
                        <button onClick={() => setType('')} className={chip(type === '')}>{t('সব ধরন', 'All types')} ({count({ src })})</button>
                        {TYPES.filter((x) => type === x.key || count({ type: x.key, src }) > 0).map((x) => (
                            <button key={x.key} onClick={() => setType(x.key)} className={chip(type === x.key)}>
                                {t(x.label[0], x.label[1])} ({count({ type: x.key, src })})
                            </button>
                        ))}
                    </div>
                </div>

                {error && <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-900 text-rose-300 text-xs">{error}</div>}

                {items.map((it) => <ReviewCard key={it.id} item={it} onDone={done} />)}

                {loading ? (
                    <div className="text-center py-12 text-slate-500 text-sm">{t('লোড হচ্ছে...', 'Loading...')}</div>
                ) : items.length === 0 ? (
                    <div className="text-center py-20 text-slate-500 text-sm">{t('এই ভাগে যাচাইয়ের কিছু নেই।', 'Nothing to review here.')}</div>
                ) : hasMore && (
                    <button onClick={() => load(offset)} className="w-full py-3 rounded-xl bg-slate-900 border border-slate-800 text-sm font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer">
                        {t('আরও দেখুন', 'Load more')}
                    </button>
                )}
            </main>
        </div>
    );
}

export default function AiReviewPage() {
    return (
        <AdminGate>
            <AiReviewInner />
        </AdminGate>
    );
}
