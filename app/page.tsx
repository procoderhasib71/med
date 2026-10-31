'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, Bookmark, ChevronDown, ChevronRight, ClipboardList, FileText, Play, PlayCircle, RefreshCw } from 'lucide-react';
import { getMe, listModelTests } from '@/lib/siteApi';
import { onAuthStateChanged, session } from '@/lib/session';
import { COURSES } from '@/lib/courses';
import { useCourse } from '@/components/CourseProvider';
import CourseAvatar from '@/components/CourseAvatar';

// ক্লাসরুমের হোম: স্বাগতম আর নিজের হিসাব, দ্রুত কাজ, চালু কোর্সের বিষয় (DB থেকে), সাম্প্রতিক মডেল টেস্ট।
// মোবাইলে সব এক কলামে; কম্পিউটারে চওড়া, দুই কলামে।

type Stats = { name: string; attempted: number; correct: number; score: number; mistakes: number; bookmarks: number };
type Subject = { subject: string; count: number };
type Test = { id: string; title: string; subject: string; duration: number; questions: number; negative: number };

const bn = (v: number | string) => String(v).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]);
const card = 'rounded-2xl bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800';
// বিষয়ের কার্ডের রং পালাক্রমে
const TONES = [
    'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10', 'text-teal-600 dark:text-teal-400 bg-teal-500/10',
    'text-amber-600 dark:text-amber-400 bg-amber-500/10', 'text-orange-600 dark:text-orange-400 bg-orange-500/10',
    'text-blue-600 dark:text-blue-400 bg-blue-500/10', 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10',
    'text-violet-600 dark:text-violet-400 bg-violet-500/10', 'text-rose-600 dark:text-rose-400 bg-rose-500/10',
    'text-cyan-600 dark:text-cyan-400 bg-cyan-500/10', 'text-pink-600 dark:text-pink-400 bg-pink-500/10',
];

function SectionTitle({ icon: Icon, title, link }: { icon: typeof BookOpen; title: string; link?: { href: string; text: string } }) {
    return (
        <div className="flex items-center justify-between mb-3">
            <h2 className="flex items-center gap-2 text-base sm:text-lg font-black text-slate-900 dark:text-white">
                <span className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center"><Icon size={17} /></span>
                {title}
            </h2>
            {link && <Link href={link.href} className="flex items-center gap-0.5 text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 hover:underline">{link.text} <ChevronRight size={15} /></Link>}
        </div>
    );
}

export default function ClassroomHome() {
    const { info } = useCourse();
    const course = COURSES.find((c) => c.id === (info?.current || 'med'))!;
    const [stats, setStats] = useState<Stats | null>(null);
    const [subjects, setSubjects] = useState<Subject[] | null>(null);
    const [tests, setTests] = useState<Test[] | null>(null);
    const [testsOpen, setTestsOpen] = useState(false);

    useEffect(() => {
        const stop = onAuthStateChanged(session, async (user) => {
            if (!user) return setStats(null);
            const me = await getMe().catch(() => null);
            if (me) setStats({ name: me.name || me.displayName || '', attempted: me.totalAttempted || 0, correct: me.totalCorrect || 0,
                               score: Number((me.totalScore || 0).toFixed(2)), mistakes: me.mistakeCount || 0, bookmarks: me.bookmarks.length });
        });
        fetch('/api/subjects', { cache: 'no-store' }).then((r) => r.json()).then((d) => setSubjects(d.subjects || [])).catch(() => setSubjects([]));
        listModelTests(4).then((list) => setTests(list.map((t) => {
            const qs = Array.isArray(t.questions) ? t.questions.length : 0;
            return { id: String(t.id), title: t.title || 'মডেল টেস্ট', subject: t.subject || 'সমন্বিত', duration: Number(t.duration_minutes) || 25,
                     questions: Number(t.total_questions) || qs, negative: Number(t.negative_marking) || 0.25 };
        }))).catch(() => setTests([]));
        return stop;
    }, []);

    const accuracy = stats && stats.attempted ? Math.round((stats.correct * 100) / stats.attempted) : 0;
    const actions = [
        { href: '/qbank', icon: BookOpen, title: 'MCQ প্র্যাকটিস', hint: 'অধ্যায় আর সাল ধরে', tone: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10', badge: 0 },
        { href: '/model-test', icon: ClipboardList, title: 'মডেল টেস্ট', hint: 'সময় ধরে পরীক্ষা', tone: 'text-blue-600 dark:text-blue-400 bg-blue-500/10', badge: 0 },
        { href: '/mistakes', icon: RefreshCw, title: 'ভুল প্রশ্ন', hint: 'আবার ঝালিয়ে নিন', tone: 'text-orange-600 dark:text-orange-400 bg-orange-500/10', badge: stats?.mistakes || 0 },
        { href: '/bookmarks', icon: Bookmark, title: 'বুকমার্ক', hint: 'দাগ দেওয়া প্রশ্ন', tone: 'text-violet-600 dark:text-violet-400 bg-violet-500/10', badge: stats?.bookmarks || 0 },
    ];

    return (
        <div className="min-h-screen bg-[#F6F8FB] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100">
            <main className="mx-auto max-w-6xl px-4 sm:px-6 py-5 sm:py-8 space-y-6 sm:space-y-8">

                {/* স্বাগতম + নিজের হিসাব (ছোট, এক নজরে) */}
                <section className={`${card} p-4 sm:p-5 flex flex-col md:flex-row md:items-center gap-4`}>
                    <div className="flex items-center gap-3 min-w-0 md:flex-1">
                        <CourseAvatar className="w-11 h-11" />
                        <div className="min-w-0">
                            <h1 className="text-base sm:text-lg font-black truncate">স্বাগতম{stats?.name ? `, ${stats.name}` : ''}</h1>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{course.name} • আজকের প্রস্তুতি শুরু করুন</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 divide-x divide-slate-200 dark:divide-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900/60 py-2 md:w-[19rem]">
                        {[
                            { value: bn(stats?.attempted ?? 0), label: 'মোট উত্তর' },
                            { value: `${bn(accuracy)}%`, label: 'সঠিকের হার' },
                            { value: bn(stats?.score ?? 0), label: 'স্কোর' },
                        ].map((x) => (
                            <div key={x.label} className="text-center px-2">
                                <div className="text-base font-black">{x.value}</div>
                                <div className="text-[10.5px] text-slate-500 dark:text-slate-400">{x.label}</div>
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-2 md:flex gap-2 shrink-0">
                        <Link href="/qbank" className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors">
                            <Play size={13} fill="currentColor" /> প্র্যাকটিস
                        </Link>
                        <Link href="/model-test" className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-emerald-500 text-sm font-bold transition-colors">
                            মডেল টেস্ট <ArrowRight size={14} />
                        </Link>
                    </div>
                </section>

                {/* দ্রুত কাজ */}
                <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    {actions.map((a) => (
                        <Link key={a.href} href={a.href} className={`${card} group relative p-4 sm:p-5 flex flex-col gap-3 hover:border-emerald-500/50 hover:shadow-lg hover:-translate-y-0.5 transition-all`}>
                            {a.badge > 0 && <span className="absolute top-3 right-3 min-w-[22px] h-[22px] px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-black flex items-center justify-center">{bn(a.badge)}</span>}
                            <span className={`w-11 h-11 rounded-xl flex items-center justify-center ${a.tone}`}><a.icon size={21} /></span>
                            <span>
                                <span className="block font-black text-sm sm:text-base">{a.title}</span>
                                <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{a.hint}</span>
                            </span>
                        </Link>
                    ))}
                </section>

                <div className="grid lg:grid-cols-3 gap-6 sm:gap-8">
                    {/* বিষয়ভিত্তিক প্রস্তুতি (চালু কোর্সের, DB থেকে) */}
                    <section className="lg:col-span-2">
                        <SectionTitle icon={BookOpen} title="বিষয়ভিত্তিক প্রস্তুতি" link={{ href: '/qbank', text: 'সব প্রশ্ন' }} />
                        {subjects === null ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {Array.from({ length: 6 }).map((_, i) => <div key={i} className={`${card} h-[74px] animate-pulse`} />)}
                            </div>
                        ) : subjects.length === 0 ? (
                            <div className={`${card} p-8 text-center`}>
                                <div className="text-3xl">⏳</div>
                                <p className="mt-2 font-bold">{course.name} এর প্রশ্ন শীঘ্রই আসছে</p>
                                <p className="text-sm text-slate-500 mt-1">প্রশ্ন যোগ হলেই এখানে বিষয়গুলো দেখাবে।</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {subjects.map((s, i) => (
                                    <Link key={s.subject} href={`/qbank?subject=${encodeURIComponent(s.subject)}`}
                                        className={`${card} group flex items-center gap-3 p-3 sm:p-3.5 hover:border-emerald-500/50 hover:shadow-md transition-all`}>
                                        <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${TONES[i % TONES.length]}`}><BookOpen size={18} /></span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-[13px] sm:text-sm font-extrabold truncate">{s.subject === 'English' ? 'ইংরেজি' : s.subject}</span>
                                            <span className="block text-[11px] text-slate-500 dark:text-slate-400">{bn(s.count)} প্রশ্ন</span>
                                        </span>
                                        <ChevronRight size={15} className="text-slate-300 dark:text-slate-600 group-hover:text-emerald-500 shrink-0 hidden sm:block" />
                                    </Link>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* সাম্প্রতিক মডেল টেস্ট + শীঘ্রই আসছে */}
                    <aside className="space-y-6">
                        {/* মডেল টেস্ট: বোতামের মতো, চাপলে তালিকা খোলে/বন্ধ হয় */}
                        <section className={`${card} overflow-hidden`}>
                            <button onClick={() => setTestsOpen((o) => !o)} aria-expanded={testsOpen}
                                className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer">
                                <span className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0"><ClipboardList size={19} /></span>
                                <span className="min-w-0 flex-1">
                                    <span className="block font-black">মডেল টেস্ট</span>
                                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                                        {tests === null ? 'লোড হচ্ছে...' : tests.length ? `${bn(tests.length)}টা সাম্প্রতিক টেস্ট` : 'এখনো কোনো টেস্ট নেই'}
                                    </span>
                                </span>
                                <ChevronDown size={18} className={`text-slate-400 shrink-0 transition-transform duration-200 ${testsOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {testsOpen && (
                            <div className="space-y-3 px-4 pb-4 border-t border-slate-100 dark:border-slate-800 pt-3 animate-[popin_.15s_ease-out]">
                                {tests === null ? (
                                    Array.from({ length: 3 }).map((_, i) => <div key={i} className="rounded-xl bg-slate-100 dark:bg-slate-800 h-[76px] animate-pulse" />)
                                ) : tests.length === 0 ? (
                                    <div className="p-4 text-center text-sm text-slate-500">এখনো কোনো মডেল টেস্ট নেই।</div>
                                ) : tests.map((t) => (
                                    <div key={t.id} className="rounded-xl bg-slate-50 dark:bg-slate-900/60 p-3.5 flex items-center gap-3">
                                        <div className="min-w-0 flex-1">
                                            <span className="text-[10.5px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">{t.subject}</span>
                                            <h3 className="mt-1.5 text-sm font-extrabold truncate">{t.title}</h3>
                                            <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5">{bn(t.questions)} প্রশ্ন • {bn(t.duration)} মিনিট • <span className="text-rose-500 font-bold">-{bn(t.negative)}</span></p>
                                        </div>
                                        <Link href={`/model-test/exam?testId=${encodeURIComponent(t.id)}&title=${encodeURIComponent(t.title)}&duration=${t.duration}`}
                                            className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">
                                            <Play size={12} fill="currentColor" /> শুরু
                                        </Link>
                                    </div>
                                ))}
                                <Link href="/model-test" className="flex items-center justify-center gap-1 pt-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline">
                                    সব মডেল টেস্ট দেখুন <ChevronRight size={14} />
                                </Link>
                            </div>
                            )}
                        </section>

                        <section className={`${card} p-5`}>
                            <h3 className="font-black text-sm mb-3">শীঘ্রই আসছে</h3>
                            <div className="space-y-3">
                                {[
                                    { icon: FileText, title: 'লেকচার শিট ও PDF নোট', tone: 'text-rose-600 dark:text-rose-400 bg-rose-500/10' },
                                    { icon: PlayCircle, title: 'ভিডিও ক্লাস', tone: 'text-amber-600 dark:text-amber-400 bg-amber-500/10' },
                                ].map((x) => (
                                    <div key={x.title} className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                                        <span className={`w-9 h-9 rounded-xl flex items-center justify-center ${x.tone}`}><x.icon size={17} /></span>
                                        {x.title}
                                    </div>
                                ))}
                            </div>
                        </section>
                    </aside>
                </div>
            </main>
        </div>
    );
}
