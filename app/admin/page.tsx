'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, FilePlus2, Flag, KeyRound, Loader2, LogOut, Settings, ShieldCheck, Sparkles, X } from 'lucide-react';
import AdminGate from '@/components/AdminGate';
import { LangSwitch, useLang } from '@/lib/i18n';

// admin প্যানেলের হোম: সব admin কাজের লিংক; হেডারের সেটিংস বোতামে admin পাসওয়ার্ড বদলানো; লগআউট

const TOOLS = [
    { href: '/admin/create-exam', icon: FilePlus2, title: ['মডেল টেস্ট বানান', 'Create model test'] as const, hint: ['প্রশ্ন বাছাই করে নতুন পরীক্ষা', 'Pick questions for a new exam'] as const, color: 'text-emerald-400 bg-emerald-500/10' },
    { href: '/admin/explanations', icon: Sparkles, title: ['AI ব্যাখ্যা যাচাই', 'Review AI explanations'] as const, hint: ['approve করলে তবেই DB তে যায়', 'Saved to the DB only after approval'] as const, color: 'text-violet-400 bg-violet-500/10' },
    { href: '/reports', icon: Flag, title: ['ছাত্রদের রিপোর্ট', 'Student reports'] as const, hint: ['ভুল উত্তরের অভিযোগ দেখে ঠিক করুন', 'Review and fix wrong-answer reports'] as const, color: 'text-rose-400 bg-rose-500/10' },
];

function ChangePassword() {
    const { t } = useLang();
    const [pw, setPw] = useState({ current: '', next: '', again: '' });
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [busy, setBusy] = useState(false);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMsg(null);
        if (pw.next !== pw.again) return setMsg({ ok: false, text: t('দুই জায়গার নতুন পাসওয়ার্ড মেলেনি', 'The two new passwords do not match') });
        setBusy(true);
        const d = await fetch('/api/admin/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'change', current: pw.current, password: pw.next }) }).then((r) => r.json()).catch(() => ({}));
        setBusy(false);
        if (d.success) setPw({ current: '', next: '', again: '' });
        setMsg(d.success ? { ok: true, text: t('পাসওয়ার্ড বদলানো হয়েছে। অন্য সব জায়গার admin লগইন বাতিল হয়েছে।', 'Password changed. Admin sessions everywhere else were signed out.') } : { ok: false, text: d.error || t('বদলানো যায়নি', 'Could not change it') });
    };

    const input = 'w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-950/60 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500';
    return (
        <form onSubmit={submit} className="space-y-3">
            {msg && <p className={`text-sm font-semibold ${msg.ok ? 'text-emerald-400' : 'text-rose-400'}`}>{msg.text}</p>}
            <input className={input} type="password" autoComplete="current-password" placeholder={t('এখনকার পাসওয়ার্ড', 'Current password')} value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required />
            <input className={input} type="password" autoComplete="new-password" placeholder={t('নতুন পাসওয়ার্ড (অন্তত ৮ অক্ষর)', 'New password (min 8 characters)')} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required />
            <input className={input} type="password" autoComplete="new-password" placeholder={t('আবার নতুন পাসওয়ার্ড', 'Repeat new password')} value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} required />
            <button type="submit" disabled={busy} className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold disabled:opacity-60 cursor-pointer flex items-center gap-2">
                {busy && <Loader2 size={16} className="animate-spin" />} {t('বদলান', 'Change')}
            </button>
            <p className="text-[11px] text-slate-500">{t('পাসওয়ার্ড ভুলে গেলে কম্পিউটারে চালান: node scripts/set-admin-password.mjs', 'Forgot it? Run on your computer: node scripts/set-admin-password.mjs')}</p>
        </form>
    );
}

/** সেটিংস popup: এখন শুধু admin পাসওয়ার্ড; Esc বা বাইরে ক্লিকে বন্ধ */
function SettingsModal({ onClose }: { onClose: () => void }) {
    const { t } = useLang();
    useEffect(() => {
        const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', esc);
        return () => window.removeEventListener('keydown', esc);
    }, [onClose]);
    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
            <div onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
            <div role="dialog" aria-label={t('সেটিংস', 'Settings')} className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl animate-[popin_.2s_ease-out]">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800">
                    <span className="w-9 h-9 rounded-xl flex items-center justify-center text-amber-400 bg-amber-500/10"><KeyRound size={18} /></span>
                    <h2 className="font-black flex-1">{t('admin পাসওয়ার্ড বদলান', 'Change admin password')}</h2>
                    <button onClick={onClose} aria-label={t('বন্ধ করুন', 'Close')} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 cursor-pointer"><X size={18} /></button>
                </div>
                <div className="p-5"><ChangePassword /></div>
            </div>
        </div>
    );
}

export default function AdminHome() {
    const { t } = useLang();
    const [settings, setSettings] = useState(false);
    const logout = async () => {
        await fetch('/api/admin/auth', { method: 'DELETE' }).catch(() => null);
        window.location.reload();
    };

    return (
        <AdminGate>
            <div className="min-h-screen bg-[#0B1120] text-slate-100 p-4 sm:p-8">
                <div className="max-w-3xl mx-auto space-y-6">
                    <header className="flex items-center justify-between pb-4 border-b border-slate-800">
                        <div className="flex items-center gap-3">
                            <span className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center"><ShieldCheck size={20} /></span>
                            <div>
                                <h1 className="font-black text-lg">{t('Admin প্যানেল', 'Admin panel')}</h1>
                                <p className="text-xs text-slate-400">{t('AdMCQ ক্লাসরুম', 'AdMCQ Classroom')}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <LangSwitch className="mr-1" />
                            <button onClick={() => setSettings(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer">
                                <Settings size={16} /> {t('সেটিংস', 'Settings')}
                            </button>
                            <button onClick={logout} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold text-slate-300 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer">
                                <LogOut size={16} /> {t('লগআউট', 'Log out')}
                            </button>
                        </div>
                    </header>

                    <section className="grid sm:grid-cols-3 gap-3">
                        {TOOLS.map((tool) => (
                            <Link key={tool.href} href={tool.href} className="group rounded-2xl border border-slate-800 bg-slate-900 p-5 hover:border-emerald-500/60 transition-colors flex flex-col gap-3">
                                <span className={`w-11 h-11 rounded-xl flex items-center justify-center ${tool.color}`}><tool.icon size={21} /></span>
                                <span>
                                    <span className="block font-bold">{t(tool.title[0], tool.title[1])}</span>
                                    <span className="block text-xs text-slate-400 mt-0.5">{t(tool.hint[0], tool.hint[1])}</span>
                                </span>
                                <ChevronRight size={16} className="text-slate-500 group-hover:translate-x-1 transition-transform mt-auto" />
                            </Link>
                        ))}
                    </section>

                    <p className="text-xs text-slate-500">
                        {t('যে কোর্স চালু আছে (হেডারে বাছাই করা), মডেল টেস্ট আর প্রশ্নের তালিকা সেই কোর্সের।', 'Model tests and question lists are for the course selected in the header.')}
                    </p>

                </div>
                {settings && <SettingsModal onClose={() => setSettings(false)} />}
            </div>
        </AdminGate>
    );
}
