'use client';

import { sortSubjects } from '@/lib/subjectOrder';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/i18n';
import Link from 'next/link';
import { ArrowRight, Atom, BookOpen, Bookmark, ChevronRight, ClipboardList, FileText, FlaskConical, Globe2, HeartHandshake, Landmark, Languages, Leaf, PawPrint, Play, PlayCircle, RefreshCw, Sigma, Sparkles } from 'lucide-react';
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

const card = 'rounded-2xl bg-white dark:bg-[#111A2E] border border-slate-200/80 dark:border-slate-800';
// বিষয়ের নাম দেখে নিজের আইকন আর রং, যাতে এক নজরে চেনা যায়
const LOOKS: [RegExp, typeof BookOpen, string][] = [
    [/উদ্ভিদ/, Leaf, 'from-emerald-400 to-green-600'],
    [/প্রাণি/, PawPrint, 'from-teal-400 to-cyan-600'],
    [/রসায়ন|রসায়ন/, FlaskConical, 'from-amber-400 to-orange-600'],
    [/পদার্থ/, Atom, 'from-blue-400 to-indigo-600'],
    [/গণিত/, Sigma, 'from-violet-400 to-purple-600'],
    [/English|বাংলা ১ম|বাংলা ২য়|বাংলা ২য়/i, Languages, 'from-fuchsia-400 to-pink-600'],
    [/আন্তর্জাতিক/, Globe2, 'from-sky-400 to-blue-600'],
    [/সাধারণ জ্ঞান|বাংলাদেশ/, Landmark, 'from-rose-400 to-red-600'],
    [/মানবিক/, HeartHandshake, 'from-pink-400 to-rose-600'],
];
const lookOf = (name: string) => LOOKS.find(([re]) => re.test(name)) || [null, BookOpen, 'from-slate-400 to-slate-600'] as const;
const LAST_KEY = 'admcq_last_subject_';

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
    const { t, n } = useLang();
    const bn = n;
    const course = COURSES.find((c) => c.id === (info?.current || 'med'))!;
    const [stats, setStats] = useState<Stats | null>(null);
    const [subjects, setSubjects] = useState<Subject[] | null>(null);
    const [tests, setTests] = useState<Test[] | null>(null);

    useEffect(() => {
        const stop = onAuthStateChanged(session, async (user) => {
            if (!user) return setStats(null);
            const me = await getMe().catch(() => null);
            if (me) setStats({ name: me.name || me.displayName || '', attempted: me.totalAttempted || 0, correct: me.totalCorrect || 0,
                               score: Number((me.totalScore || 0).toFixed(2)), mistakes: me.mistakeCount || 0, bookmarks: me.bookmarks.length });
        });
        fetch('/api/subjects', { cache: 'no-store' }).then((r) => r.json()).then((d) => setSubjects(d.subjects || [])).catch(() => setSubjects([]));
        listModelTests(4).then((list) => setTests(list.map((mt) => {
            const qs = Array.isArray(mt.questions) ? mt.questions.length : 0;
            return { id: String(mt.id), title: mt.title || 'মডেল টেস্ট', subject: mt.subject || 'সমন্বিত', duration: Number(mt.duration_minutes) || 25,
                     questions: Number(mt.total_questions) || qs, negative: Number(mt.negative_marking) || 0.25 };
        }))).catch(() => setTests([]));
        return stop;
    }, []);

    // শেষ যে বিষয় খুলেছিলেন (এই ডিভাইসে, কোর্স ধরে), আর দিনের সময় অনুযায়ী সম্ভাষণ
    const [last, setLast] = useState<string | null>(null);
    const [hour, setHour] = useState<number | null>(null);
    useEffect(() => {
        setHour(new Date().getHours());
        try { setLast(localStorage.getItem(LAST_KEY + course.id)); } catch { setLast(null); }
    }, [course.id]);
    const remember = (subject: string) => { try { localStorage.setItem(LAST_KEY + course.id, subject); } catch { /* private mode */ } };
    const greeting = hour === null ? t('স্বাগতম', 'Welcome')
        : hour < 5 ? t('রাত জেগে পড়ছেন', 'Studying late')
        : hour < 12 ? t('শুভ সকাল', 'Good morning')
        : hour < 17 ? t('শুভ দুপুর', 'Good afternoon')
        : hour < 20 ? t('শুভ সন্ধ্যা', 'Good evening') : t('শুভ রাত্রি', 'Good evening');
    const total = (subjects || []).reduce((sum, s) => sum + s.count, 0);
    const resume = subjects?.some((s) => s.subject === last) ? last : null;
    const label = (name: string) => (name === 'English' ? t('ইংরেজি', 'English') : name);

    const accuracy = stats && stats.attempted ? Math.round((stats.correct * 100) / stats.attempted) : 0;
    const actions = [
        { href: '/qbank', icon: BookOpen, title: t('MCQ প্র্যাকটিস', 'MCQ practice'), hint: t('অধ্যায় আর সাল ধরে', 'By chapter and year'), tone: 'from-emerald-400 to-emerald-600 shadow-emerald-500/30', badge: 0 },
        { href: '/model-test', icon: ClipboardList, title: t('মডেল টেস্ট', 'Model tests'), hint: t('সময় ধরে পরীক্ষা', 'Timed exams'), tone: 'from-blue-400 to-indigo-600 shadow-blue-500/30', badge: 0 },
        { href: '/mistakes', icon: RefreshCw, title: t('ভুল প্রশ্ন', 'Mistakes'), hint: t('আবার ঝালিয়ে নিন', 'Revise them again'), tone: 'from-amber-400 to-orange-600 shadow-orange-500/30', badge: stats?.mistakes || 0 },
        { href: '/bookmarks', icon: Bookmark, title: t('বুকমার্ক', 'Bookmarks'), hint: t('দাগ দেওয়া প্রশ্ন', 'Saved questions'), tone: 'from-violet-400 to-fuchsia-600 shadow-violet-500/30', badge: stats?.bookmarks || 0 },
    ];

    return (
        <div className="min-h-screen bg-[#F6F8FB] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100">
            <main className="mx-auto max-w-6xl px-4 sm:px-6 py-5 sm:py-8 space-y-6 sm:space-y-8">

                {/* স্বাগতম, চালিয়ে যাওয়ার বোতাম আর নিজের হিসাব */}
                <section className="rise relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-blue-700 text-white p-5 sm:p-7 shadow-xl shadow-emerald-900/15">
                    <span aria-hidden className="absolute -top-16 -right-10 w-56 h-56 rounded-full bg-white/10" />
                    <span aria-hidden className="absolute -bottom-24 right-24 w-48 h-48 rounded-full bg-white/[0.07]" />
                    <div className="relative flex flex-col md:flex-row md:items-center gap-5">
                        <div className="min-w-0 md:flex-1">
                            <div className="flex items-center gap-3">
                                <span className="rounded-full ring-4 ring-white/25 shrink-0"><CourseAvatar className="w-12 h-12 sm:w-14 sm:h-14" /></span>
                                <div className="min-w-0">
                                    <h1 className="text-lg sm:text-2xl font-extrabold leading-snug">{greeting}{stats?.name ? `, ${stats.name}` : ''}</h1>
                                    <p className="text-xs sm:text-sm text-white/80">{t(course.name, course.title)}{total ? ` • ${bn(total)} ${t('প্রশ্ন', 'questions')}` : ''}</p>
                                </div>
                            </div>
                            <Link href={resume ? `/qbank?subject=${encodeURIComponent(resume)}` : '/qbank'}
                                className="press mt-4 inline-flex max-w-full items-center gap-2 rounded-2xl bg-white text-emerald-700 px-4 py-2.5 text-sm font-extrabold shadow-lg">
                                <Sparkles size={16} className="shrink-0" />
                                <span className="truncate">{resume ? t(`চালিয়ে যান: ${label(resume)}`, `Continue: ${label(resume)}`) : t('প্র্যাকটিস শুরু করুন', 'Start practising')}</span>
                                <ArrowRight size={16} className="shrink-0" />
                            </Link>
                        </div>
                        <div className="grid grid-cols-3 gap-2 md:w-[21rem]">
                            {[
                                { value: bn(stats?.attempted ?? 0), label: t('মোট উত্তর', 'Answered') },
                                { value: `${bn(accuracy)}%`, label: t('সঠিকের হার', 'Accuracy') },
                                { value: bn(stats?.score ?? 0), label: t('স্কোর', 'Score') },
                            ].map((x) => (
                                <div key={x.label} className="min-w-0 rounded-2xl bg-white/15 border border-white/15 backdrop-blur text-center px-1 py-2.5">
                                    <div className="text-lg sm:text-xl font-extrabold truncate">{x.value}</div>
                                    <div className="text-[10.5px] text-white/80">{x.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* দ্রুত কাজ */}
                <section className="rise [animation-delay:60ms] grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                    {actions.map((a) => (
                        <Link key={a.href} href={a.href} className={`${card} group relative p-4 flex flex-col gap-3 shadow-sm hover:border-emerald-500/50 hover:shadow-lg hover:-translate-y-0.5 transition-all active:scale-[0.97]`}>
                            {a.badge > 0 && <span className="absolute top-3 right-3 min-w-[22px] h-[22px] px-1.5 rounded-full bg-rose-500 text-white text-[11px] font-black flex items-center justify-center">{bn(a.badge)}</span>}
                            <span className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white bg-gradient-to-br shadow-lg transition-transform group-hover:scale-110 ${a.tone}`}><a.icon size={21} /></span>
                            <span>
                                <span className="block font-black text-sm sm:text-base">{a.title}</span>
                                <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{a.hint}</span>
                            </span>
                        </Link>
                    ))}
                </section>

                <div className="rise [animation-delay:120ms] space-y-6 sm:space-y-8">
                    {/* বিষয়ভিত্তিক প্রস্তুতি (চালু কোর্সের, DB থেকে) */}
                    <section>
                        <SectionTitle icon={BookOpen} title={t('বিষয়ভিত্তিক প্রস্তুতি', 'Practice by subject')} link={{ href: '/qbank', text: t('সব প্রশ্ন', 'All questions') }} />
                        {subjects === null ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                {Array.from({ length: 6 }).map((_, i) => <div key={i} className={`${card} h-[74px] animate-pulse`} />)}
                            </div>
                        ) : subjects.length === 0 ? (
                            <div className={`${card} p-8 text-center`}>
                                <div className="text-3xl">⏳</div>
                                <p className="mt-2 font-bold">{t(`${course.name} এর প্রশ্ন শীঘ্রই আসছে`, `${course.title} questions are coming soon`)}</p>
                                <p className="text-sm text-slate-500 mt-1">{t('প্রশ্ন যোগ হলেই এখানে বিষয়গুলো দেখাবে।', 'Subjects will appear here once questions are added.')}</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                {sortSubjects(subjects, course.id, (s) => s.subject).map((s) => {
                                    const [, Icon, tone] = lookOf(s.subject);
                                    return (
                                        <Link key={s.subject} href={`/qbank?subject=${encodeURIComponent(s.subject)}`} onClick={() => remember(s.subject)}
                                            className={`${card} group flex flex-col min-[360px]:flex-row min-[360px]:items-center gap-2.5 min-[360px]:gap-3 p-3 sm:p-3.5 shadow-sm hover:border-emerald-500/50 hover:shadow-lg hover:-translate-y-0.5 transition-all active:scale-[0.97]`}>
                                            <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white bg-gradient-to-br shadow-md transition-transform group-hover:scale-110 ${tone}`}><Icon size={19} /></span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-[13px] sm:text-sm font-extrabold leading-tight">{label(s.subject)}</span>
                                                <span className="block text-[11px] text-slate-500 dark:text-slate-400">{bn(s.count)} {t('প্রশ্ন', 'questions')}</span>
                                            </span>
                                            <ChevronRight size={15} className="text-slate-300 dark:text-slate-600 group-hover:text-emerald-500 shrink-0 hidden sm:block" />
                                        </Link>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    {/* সাম্প্রতিক মডেল টেস্ট + শীঘ্রই আসছে */}
                    {/* সাম্প্রতিক মডেল টেস্ট: সব স্ক্রিনে সরাসরি কার্ড, কম্পিউটারে এক সারিতে */}
                    <section>
                        <SectionTitle icon={ClipboardList} title={t('সাম্প্রতিক মডেল টেস্ট', 'Recent model tests')} link={{ href: '/model-test', text: t('সব টেস্ট', 'All tests') }} />
                        {tests === null ? (
                            <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory no-scrollbar -mx-4 px-4 pb-1 sm:mx-0 sm:px-0 sm:pb-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:overflow-visible">
                                {Array.from({ length: 4 }).map((_, i) => <div key={i} className={`${card} h-[132px] shrink-0 w-[78%] sm:w-auto animate-pulse`} />)}
                            </div>
                        ) : tests.length === 0 ? (
                            <div className={`${card} p-6 text-center text-sm text-slate-500`}>{t('এখনো কোনো মডেল টেস্ট নেই।', 'No model tests yet.')}</div>
                        ) : (
                            <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory no-scrollbar -mx-4 px-4 pb-1 sm:mx-0 sm:px-0 sm:pb-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:overflow-visible">
                                {tests.map((test) => (
                                    <Link key={test.id} href={`/model-test/exam?testId=${encodeURIComponent(test.id)}&title=${encodeURIComponent(test.title)}&duration=${test.duration}`}
                                        className={`${card} group shrink-0 w-[78%] sm:w-auto snap-start flex flex-col p-4 shadow-sm hover:border-blue-500/50 hover:shadow-lg hover:-translate-y-0.5 transition-all active:scale-[0.97]`}>
                                        <span className="self-start max-w-full truncate text-[10.5px] font-extrabold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-400">{test.subject}</span>
                                        <h3 className="mt-2 text-sm font-extrabold truncate">{test.title}</h3>
                                        <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5">{bn(test.questions)} {t('প্রশ্ন', 'Qs')} • {bn(test.duration)} {t('মিনিট', 'min')} • <span className="text-rose-500 font-bold">-{bn(test.negative)}</span></p>
                                        <span className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                                            {t('পরীক্ষা দিন', 'Start test')}
                                            <span className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center transition-transform group-hover:translate-x-0.5"><Play size={11} fill="currentColor" /></span>
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* শীঘ্রই আসছে: ছোট একটা লাইন */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-bold">{t('শীঘ্রই আসছে:', 'Coming soon:')}</span>
                        {[
                            { icon: FileText, title: t('লেকচার শিট ও PDF নোট', 'Lecture sheets & PDF notes') },
                            { icon: PlayCircle, title: t('ভিডিও ক্লাস', 'Video classes') },
                        ].map((x) => (
                            <span key={x.title} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-dashed border-slate-300 dark:border-slate-700">
                                <x.icon size={13} /> {x.title}
                            </span>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}
