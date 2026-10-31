'use client';

import { useEffect, useState } from 'react';
import CourseAvatar from '@/components/CourseAvatar';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { BookOpenCheck, ChevronRight, KeyRound, LayoutDashboard, LogOut, Send, UserRound, X } from 'lucide-react';
import { bn, pct, useAccount } from '@/lib/useAccount';
import { BotPanel, CoursesPanel, MsgBox, NamePanel, PasswordPanel } from '@/components/AccountPanels';

// হেডারের প্রোফাইল বোতাম: ক্লিকে ডান দিক থেকে মেনু, মেনুর আইকনে ক্লিকে popup; লগইন না থাকলে লগইন বোতাম

const ITEMS = [
    { id: 'courses', icon: BookOpenCheck, title: 'আমার কোর্স', hint: 'কোর্স বদলান বা নতুন কোর্স নিন', color: 'text-emerald-500 bg-emerald-500/10' },
    { id: 'name', icon: UserRound, title: 'নাম বদলান', hint: 'লিডারবোর্ডে যে নাম দেখাবে', color: 'text-blue-500 bg-blue-500/10' },
    { id: 'password', icon: KeyRound, title: 'পাসওয়ার্ড', hint: 'সব কোর্সে একই পাসওয়ার্ড', color: 'text-amber-500 bg-amber-500/10' },
    { id: 'bot', icon: Send, title: 'মাছরাঙা বট', hint: 'Telegram এ প্র্যাকটিস', color: 'text-sky-500 bg-sky-500/10' },
] as const;
type Item = (typeof ITEMS)[number]['id'];

export default function ProfileMenu() {
    const acc = useAccount({ redirectIfLoggedOut: false });
    const [open, setOpen] = useState(false);
    const [popup, setPopup] = useState<Item | null>(null);

    // Esc চাপলে আগে popup, তারপর মেনু বন্ধ; খোলা থাকলে পেছনের পেজ স্ক্রল হয় না
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (popup) setPopup(null);
            else setOpen(false);
        };
        const overflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKey);
        return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
    }, [open, popup]);

    if (acc.status === 'loading') return <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800/70 animate-pulse" />;
    if (acc.status !== 'in' || !acc.profile) {
        return (
            <Link href="/login" className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors">
                লগইন
            </Link>
        );
    }

    const p = acc.profile;
    const mine = acc.platforms.filter((x) => x.enrolled);
    const total = mine.reduce((s, x) => ({ attempted: s.attempted + x.attempted, correct: s.correct + x.correct }), { attempted: 0, correct: 0 });
    const current = ITEMS.find((i) => i.id === popup);
    const openPopup = (id: Item) => { acc.setMsg(null); setPopup(id); };

    return (
        <>
            <button onClick={() => setOpen(true)} aria-label="প্রোফাইল মেনু"
                className="rounded-xl ring-2 ring-white/70 dark:ring-slate-700 shadow-md hover:scale-105 transition-transform cursor-pointer">
                <CourseAvatar className="w-9 h-9" />
            </button>

            {/* ডান দিক থেকে আসা মেনু; হেডারের backdrop-blur এর বাইরে body তে রাখা, নইলে fixed ঠিকমতো কাজ করে না */}
            {createPortal(<div className={`fixed inset-0 z-[60] ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
                <div onClick={() => setOpen(false)} className={`absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`} />
                <aside role="dialog" aria-label="প্রোফাইল মেনু"
                    className={`absolute right-0 top-0 h-full w-[19rem] max-w-[85vw] bg-white dark:bg-[#0b111d] border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col transition-transform duration-300 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}>
                    <div className="p-5 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-start justify-between">
                            <CourseAvatar className="w-12 h-12" rounded="rounded-2xl" />
                            <button onClick={() => setOpen(false)} aria-label="বন্ধ করুন" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"><X size={18} /></button>
                        </div>
                        <h2 className="mt-3 font-black text-lg truncate text-slate-900 dark:text-white">{p.name || 'আপনার প্রোফাইল'}</h2>
                        <p className="text-sm text-slate-500 truncate">{p.phone ? bn(p.phone.replace('+88', '')) : p.email}</p>
                        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                            {[[bn(mine.length), 'কোর্স'], [bn(total.attempted), 'উত্তর'], [`${bn(pct(total))}%`, 'সঠিক']].map(([v, t]) => (
                                <div key={t} className="rounded-xl bg-slate-50 dark:bg-slate-900 py-2">
                                    <div className="font-black text-slate-900 dark:text-white">{v}</div>
                                    <div className="text-[11px] text-slate-500">{t}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                        {ITEMS.map((it) => (
                            <button key={it.id} onClick={() => openPopup(it.id)}
                                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/70 text-left cursor-pointer transition-colors group">
                                <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${it.color}`}><it.icon size={19} /></span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-bold text-slate-900 dark:text-white">{it.title}</span>
                                    <span className="block text-xs text-slate-500 truncate">{it.hint}</span>
                                </span>
                                <ChevronRight size={16} className="text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                            </button>
                        ))}
                        <Link href="/profile" onClick={() => setOpen(false)}
                            className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors">
                            <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-violet-500 bg-violet-500/10"><LayoutDashboard size={19} /></span>
                            <span className="text-sm font-bold text-slate-900 dark:text-white flex-1">পুরো প্রোফাইল</span>
                            <ChevronRight size={16} className="text-slate-400" />
                        </Link>
                    </nav>

                    <div className="p-3 border-t border-slate-100 dark:border-slate-800">
                        <button onClick={acc.logout} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-rose-500 hover:bg-rose-500/10 cursor-pointer transition-colors">
                            <LogOut size={16} /> লগআউট
                        </button>
                    </div>
                </aside>

                {/* মেনুর আইকনে ক্লিক করলে popup */}
                {current && (
                    <div className="absolute inset-0 z-10 flex items-end sm:items-center justify-center p-0 sm:p-4">
                        <div onClick={() => setPopup(null)} className="absolute inset-0 bg-black/40" />
                        <div role="dialog" aria-label={current.title}
                            className="relative w-full sm:max-w-md max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#0c1322] border border-slate-200 dark:border-slate-800 shadow-2xl animate-[popin_.2s_ease-out]">
                            <div className="sticky top-0 z-10 flex items-center gap-3 px-5 py-4 bg-white/95 dark:bg-[#0c1322]/95 backdrop-blur border-b border-slate-100 dark:border-slate-800">
                                <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${current.color}`}><current.icon size={18} /></span>
                                <h3 className="font-black flex-1 text-slate-900 dark:text-white">{current.title}</h3>
                                <button onClick={() => setPopup(null)} aria-label="বন্ধ করুন" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"><X size={18} /></button>
                            </div>
                            <div className="p-5 space-y-4 text-slate-800 dark:text-slate-100">
                                <MsgBox acc={acc} />
                                {popup === 'courses' && <CoursesPanel acc={acc} compact />}
                                {popup === 'name' && <NamePanel acc={acc} />}
                                {popup === 'password' && <PasswordPanel acc={acc} />}
                                {popup === 'bot' && <BotPanel acc={acc} />}
                            </div>
                        </div>
                    </div>
                )}
            </div>, document.body)}
        </>
    );
}
