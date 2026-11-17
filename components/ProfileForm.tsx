'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { authFetch } from '@/lib/authFetch';
import { useLang } from '@/lib/i18n';
import { AVATARS, COLORS, fileToPhoto, loadMyAvatar, saveMyAvatar, type Look } from '@/lib/avatar';

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
    const [look, setLook] = useState<Look>({});
    const [showAll, setShowAll] = useState(false);   // শুরুতে অল্প কয়েকটা অবতার, "আরও" চাপলে সব
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

    useEffect(() => { void loadMyAvatar().then(setLook); }, []);
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
        await saveMyAvatar(look).catch(() => undefined);
        setMsg({ ok: true, text: t('প্রোফাইল সেভ হয়েছে', 'Profile saved') });
        onSaved?.(f);
    };

    if (loading) return <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-emerald-500" /></div>;

    return (
        <form onSubmit={save} className="space-y-4">
            <div>
                <span className={label}>{t('অবতার', 'Avatar')}</span>
                <div className="flex items-center gap-2 mb-2.5">
                    {look.photo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={look.photo} alt="" className="w-12 h-12 rounded-full object-cover" />
                    )}
                    <label className="cursor-pointer px-3 h-9 inline-flex items-center rounded-xl text-[12px] font-bold bg-emerald-500 text-black">
                        📷 {look.photo ? t('অন্য ছবি দাও', 'Change photo') : t('নিজের ছবি দাও', 'Upload photo')}
                        <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                            const file = e.target.files?.[0]; e.target.value = '';
                            if (!file) return;
                            try { setLook({ ...look, photo: await fileToPhoto(file) }); } catch { /* ভুল ফাইল: কিছু বদলায় না */ }
                        }} />
                    </label>
                    {look.photo && <button type="button" onClick={() => setLook({ ...look, photo: '' })} className="px-3 h-9 rounded-xl text-[12px] font-bold border border-slate-200 dark:border-slate-700 text-slate-500 cursor-pointer">{t('ছবি সরাও', 'Remove photo')}</button>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => setLook({ ...look, avatar: '', photo: '' })} className={`px-2.5 h-9 rounded-xl text-[11px] font-bold border cursor-pointer ${!look.avatar && !look.photo ? 'bg-emerald-500 border-emerald-500 text-black' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}>{t('কোর্সের ছবি', 'Course figure')}</button>
                    {(showAll ? AVATARS : [...AVATARS.slice(0, 8), ...(look.avatar && AVATARS.indexOf(look.avatar) >= 8 ? [look.avatar] : [])]).map((e) => (
                        <button type="button" key={e} onClick={() => setLook({ avatar: e, avColor: look.avColor || 'indigo', photo: '' })} className={`w-9 h-9 rounded-xl text-lg border cursor-pointer ${!look.photo && look.avatar === e ? 'border-emerald-500 bg-emerald-500/10 scale-105' : 'border-slate-200 dark:border-slate-700'}`}>{e}</button>
                    ))}
                    <button type="button" onClick={() => setShowAll(!showAll)} className="px-2.5 h-9 rounded-xl text-[11px] font-bold border border-slate-200 dark:border-slate-700 text-slate-500 cursor-pointer">{showAll ? t('কম', 'Less') : t('আরও', 'More')}</button>
                </div>
                {look.avatar && !look.photo && (
                    <div className="flex flex-wrap gap-2 mt-2.5">
                        {Object.entries(COLORS).map(([k, [from, to]]) => (
                            <button type="button" key={k} onClick={() => setLook({ ...look, avColor: k })} aria-label={k} className={`w-6 h-6 rounded-full cursor-pointer ${(look.avColor || 'indigo') === k ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-white/60 ring-offset-white dark:ring-offset-[#0b111d] scale-110' : ''}`} style={{ background: `linear-gradient(135deg, ${from}, ${to})` }} />
                        ))}
                    </div>
                )}
                <p className="text-[11px] text-slate-500 mt-1.5">{t('একই ছবি বা অবতার Shongi Focus, Money, AdMCQ আর পোর্টালে।', 'Same photo or avatar in Shongi Focus, Money, AdMCQ and the portal.')}</p>
            </div>
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
