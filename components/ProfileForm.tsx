'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { authFetch } from '@/lib/authFetch';
import { useLang } from '@/lib/i18n';

// এক প্রোফাইল (AdMCQ, Pomodoro, Money): নাম, ছেলে/মেয়ে, পড়ার ধরন, স্কুল/কলেজ, HSC ব্যাচ (ঐচ্ছিক)।
// অন্য অ্যাপে পূরণ করা থাকলে এখানে সেটাই বসানো থাকে। /api/account এ সেভ হয়।

const LEVELS: [string, string, string][] = [
    ['ssc', 'SSC', 'SSC'], ['hsc', 'HSC', 'HSC'], ['admission', 'ভর্তি প্রস্তুতি', 'Admission prep'],
    ['mbbs', 'MBBS', 'MBBS'], ['university', 'বিশ্ববিদ্যালয়', 'University'], ['other', 'অন্যান্য', 'Other'],
];
const input = 'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 text-sm focus:outline-none focus:border-emerald-500';
const label = 'block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5';
const chip = (on: boolean) => `px-3.5 py-2 rounded-xl text-sm font-semibold border cursor-pointer transition-colors ${on
    ? 'bg-emerald-500 border-emerald-500 text-black' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-500'}`;

export type AccountForm = { name: string; gender: string; studyLevel: string; institution: string; hscBatch: string };

export default function ProfileForm({ onSaved, submitText }: { onSaved?: (a: AccountForm) => void; submitText?: string }) {
    const { t } = useLang();
    const [f, setF] = useState<AccountForm>({ name: '', gender: '', studyLevel: '', institution: '', hscBatch: '' });
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

    useEffect(() => {
        authFetch('/api/account', { cache: 'no-store' }).then((r) => r.json()).then((d) => {
            if (d?.success) setF({ name: d.account.name, gender: d.account.gender, studyLevel: d.account.studyLevel,
                                   institution: d.account.institution, hscBatch: d.account.hscBatch });
        }).catch(() => undefined).finally(() => setLoading(false));
    }, []);

    const save = async (e: React.FormEvent) => {
        e.preventDefault();
        setMsg(null);
        if (!f.gender) return setMsg({ ok: false, text: t('ছেলে না মেয়ে বাছাই করুন', 'Please choose male or female') });
        if (!f.studyLevel) return setMsg({ ok: false, text: t('পড়ার ধরন বাছাই করুন', 'Please choose what you study') });
        setBusy(true);
        const d = await authFetch('/api/account', { method: 'PATCH', body: JSON.stringify(f) }).then((r) => r.json()).catch(() => null);
        setBusy(false);
        if (!d?.success) return setMsg({ ok: false, text: d?.error || t('সেভ করা যায়নি', 'Could not save') });
        setMsg({ ok: true, text: t('প্রোফাইল সেভ হয়েছে', 'Profile saved') });
        onSaved?.(f);
    };

    if (loading) return <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-emerald-500" /></div>;

    return (
        <form onSubmit={save} className="space-y-4">
            <div>
                <label className={label}>{t('নাম', 'Name')}</label>
                <input className={input} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={t('যেমন: রাফি আহমেদ', 'e.g. Rafi Ahmed')} required minLength={2} />
            </div>
            <div>
                <span className={label}>{t('আপনি', 'You are')}</span>
                <div className="flex gap-2">
                    {([['male', 'ছেলে', 'Male'], ['female', 'মেয়ে', 'Female']] as const).map(([id, bn, en]) => (
                        <button type="button" key={id} onClick={() => setF({ ...f, gender: id })} className={chip(f.gender === id)}>{t(bn, en)}</button>
                    ))}
                </div>
            </div>
            <div>
                <span className={label}>{t('এখন কী পড়ছেন', 'What you study')}</span>
                <div className="flex flex-wrap gap-2">
                    {LEVELS.map(([id, bn, en]) => (
                        <button type="button" key={id} onClick={() => setF({ ...f, studyLevel: id })} className={chip(f.studyLevel === id)}>{t(bn, en)}</button>
                    ))}
                </div>
            </div>
            <div>
                <label className={label}>{t('স্কুল/কলেজ/বিশ্ববিদ্যালয়', 'School/College/University')}</label>
                <input className={input} value={f.institution} onChange={(e) => setF({ ...f, institution: e.target.value })} placeholder={t('যেমন: ঢাকা কলেজ', 'e.g. Dhaka College')} required minLength={2} />
            </div>
            <div>
                <label className={label}>{t('HSC ব্যাচ (ঐচ্ছিক)', 'HSC batch (optional)')}</label>
                <input className={input} inputMode="numeric" maxLength={4} value={f.hscBatch} onChange={(e) => setF({ ...f, hscBatch: e.target.value.replace(/\D/g, '') })} placeholder="2026" />
            </div>
            {msg && <p className={`text-sm font-semibold ${msg.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{msg.text}</p>}
            <button type="submit" disabled={busy} className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2">
                {busy && <Loader2 size={16} className="animate-spin" />} {submitText || t('সেভ করুন', 'Save')}
            </button>
        </form>
    );
}
