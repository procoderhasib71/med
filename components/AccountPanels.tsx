'use client';

import { useState } from 'react';
import { ArrowUpRight, Check, Copy, Loader2, Lock, Plus, Send } from 'lucide-react';
import { ACCENT, COURSES } from '@/lib/courses';
import { type Account, bn, pct } from '@/lib/useAccount';
import CourseIcon from '@/components/CourseIcon';

// প্রোফাইল পেজের অংশগুলো: কোর্স, নাম, পাসওয়ার্ড, মাছরাঙা বট

export const card = 'rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0c1322]';
const input = 'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/60 text-sm focus:outline-none focus:border-emerald-500';
const btn = 'px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold disabled:opacity-60 cursor-pointer transition-colors';
const label = 'text-[11px] font-semibold uppercase tracking-wider text-slate-500';

export function MsgBox({ acc }: { acc: Account }) {
    if (!acc.msg) return null;
    return (
        <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${acc.msg.ok ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-rose-500/10 text-rose-600 dark:text-rose-300'}`}>
            {acc.msg.text}
        </div>
    );
}

/** নেওয়া কোর্সগুলো চালু, বাকিগুলো তালা দেওয়া; compact হলে popup এর মতো ছোট করে */
export function CoursesPanel({ acc, compact = false }: { acc: Account; compact?: boolean }) {
    const mine = acc.platforms.filter((p) => p.enrolled);
    const others = acc.platforms.filter((p) => !p.enrolled);
    return (
        <div className="space-y-6">
            <div>
                {!compact && <h2 className="text-lg font-black mb-3">আমার কোর্স</h2>}
                {mine.length === 0 ? (
                    <div className={`${card} p-6 text-center text-sm text-slate-500`}>এখনো কোনো কোর্স নেননি। নিচে থেকে একটা কোর্স নিন।</div>
                ) : (
                    <div className={`grid gap-4 ${compact ? '' : 'sm:grid-cols-2'}`}>
                        {mine.map((p) => {
                            const c = COURSES.find((x) => x.id === p.id)!;
                            return (
                                <div key={p.id} className={`${card} p-5 flex flex-col`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${ACCENT[c.accent].icon}`}>
                                            <CourseIcon id={p.id} className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h3 className="font-bold truncate">{p.name}</h3>
                                            <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">● চালু</p>
                                        </div>
                                    </div>
                                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                                        <div><div className={label}>স্কোর</div><div className="font-black mt-0.5">{bn(Number(p.score.toFixed(2)))}</div></div>
                                        <div><div className={label}>উত্তর</div><div className="font-black mt-0.5">{bn(p.attempted)}</div></div>
                                        <div><div className={label}>সঠিক</div><div className="font-black mt-0.5">{bn(pct(p))}%</div></div>
                                    </div>
                                    <div className="mt-3 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct(p)}%` }} />
                                    </div>
                                    <button onClick={() => acc.open(p.id)} disabled={Boolean(acc.busy)}
                                        className="mt-4 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold transition-colors cursor-pointer disabled:opacity-60">
                                        {acc.busy === `open-${p.id}` ? <Loader2 size={16} className="animate-spin" /> : <>ক্লাসরুমে যান <ArrowUpRight size={16} /></>}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {others.length > 0 && (
                <div>
                    <h2 className={`${compact ? 'text-sm' : 'text-lg'} font-black mb-3`}>আরও কোর্স</h2>
                    <div className={`grid gap-3 ${compact ? '' : 'sm:grid-cols-2'}`}>
                        {others.map((p) => (
                            <div key={p.id} className={`${card} p-4 flex items-center gap-3`}>
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-slate-100 dark:bg-slate-800 text-slate-400">
                                    <Lock size={18} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h3 className="font-bold text-sm truncate">{p.name}</h3>
                                    <p className="text-xs text-slate-500">নেওয়া হয়নি</p>
                                </div>
                                <button onClick={() => acc.enroll(p.id)} disabled={Boolean(acc.busy)}
                                    className="flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-emerald-500 text-xs font-bold cursor-pointer disabled:opacity-60 transition-colors">
                                    {acc.busy === `enroll-${p.id}` ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} কোর্স নিন
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export function NamePanel({ acc }: { acc: Account }) {
    const [name, setName] = useState(acc.profile?.name || '');
    return (
        <div className="space-y-3">
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="আপনার নাম" />
            <button onClick={() => acc.saveName(name)} disabled={Boolean(acc.busy)} className={btn}>{acc.busy === 'name' ? 'সেভ হচ্ছে...' : 'সেভ করুন'}</button>
        </div>
    );
}

export function PasswordPanel({ acc }: { acc: Account }) {
    const [pw, setPw] = useState({ current: '', next: '', again: '' });
    if (!acc.profile?.phone) return <p className="text-sm text-slate-500">আপনি Google দিয়ে লগইন করেছেন, তাই আলাদা পাসওয়ার্ড লাগে না।</p>;
    const submit = async () => {
        if (await acc.changePassword(pw.current, pw.next, pw.again)) setPw({ current: '', next: '', again: '' });
    };
    return (
        <div className="space-y-3">
            <input className={input} type="password" autoComplete="current-password" placeholder="এখনকার পাসওয়ার্ড" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
            <input className={input} type="password" autoComplete="new-password" placeholder="নতুন পাসওয়ার্ড (অন্তত ৬ অক্ষর)" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
            <input className={input} type="password" autoComplete="new-password" placeholder="আবার নতুন পাসওয়ার্ড" value={pw.again} onChange={(e) => setPw({ ...pw, again: e.target.value })} />
            <button onClick={submit} disabled={Boolean(acc.busy)} className={btn}>{acc.busy === 'pw' ? 'বদলানো হচ্ছে...' : 'পাসওয়ার্ড বদলান'}</button>
            <p className="text-xs text-slate-500">এখনকার পাসওয়ার্ড মনে না থাকলে লগআউট করে &quot;পাসওয়ার্ড ভুলে গেছি&quot; দিন।</p>
        </div>
    );
}

export function BotPanel({ acc }: { acc: Account }) {
    const [code, setCode] = useState('');
    const [copied, setCopied] = useState(false);
    const linked = acc.profile?.botLinked;
    return (
        <div className="space-y-3">
            {linked && !code && <p className="text-sm text-slate-500">বটের সাথে যুক্ত আছে। বটে /mode দিয়ে কোর্স বদলানো যায়।</p>}
            {code ? (
                <div className="space-y-2 text-sm">
                    <p className="text-slate-500">১৫ মিনিটের মধ্যে বটে লিখুন:</p>
                    <button onClick={() => { navigator.clipboard.writeText(`/site ${code}`); setCopied(true); }}
                        className="w-full flex justify-between items-center px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 font-mono font-bold cursor-pointer">
                        /site {code} {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                    </button>
                    <a href="https://t.me/Machranga_ai_bot" target="_blank" rel="noopener noreferrer" className="block text-center py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold">বট খুলুন</a>
                </div>
            ) : (
                <button onClick={async () => setCode(await acc.linkCode())} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold cursor-pointer">
                    <Send size={15} /> {linked ? 'আবার যুক্ত করুন' : 'বটের সাথে যুক্ত করুন'}
                </button>
            )}
        </div>
    );
}
