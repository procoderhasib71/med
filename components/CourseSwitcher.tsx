'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { ACCENT, COURSES } from '@/lib/courses';
import { useCourse } from '@/components/CourseProvider';
import CourseIcon from '@/components/CourseIcon';

// হেডারে চালু কোর্স (রঙিন আইকন + নাম); ক্লাসরুমে ক্লিক করলে নেওয়া কোর্সগুলোর তালিকা থেকে বদলানো যায়
export default function CourseSwitcher() {
    const { info, switchTo } = useCourse();
    const [open, setOpen] = useState(false);
    const box = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
        const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', esc);
        return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
    }, [open]);

    if (!info) return <div className="h-9 w-36 rounded-xl bg-slate-100 dark:bg-slate-800/70 animate-pulse" />;
    const course = COURSES.find((c) => c.id === info.current)!;
    const canSwitch = info.classroom && info.loggedIn;

    const pill = (
        <>
            <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${ACCENT[course.accent].icon}`}>
                <CourseIcon id={course.id} className="w-3.5 h-3.5" />
            </span>
            <span className="text-[13px] font-bold text-slate-800 dark:text-slate-100 truncate">{course.name}</span>
        </>
    );
    if (!canSwitch) return <div className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-xl border border-slate-200 dark:border-slate-800 max-w-[12rem]">{pill}</div>;

    return (
        <div ref={box} className="relative min-w-0">
            <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="কোর্স বদলান"
                className={`flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl border transition-colors cursor-pointer max-w-[13rem] ${open ? 'border-emerald-500 bg-emerald-500/5' : 'border-slate-200 dark:border-slate-800 hover:border-emerald-500/60 bg-white dark:bg-slate-900/60'}`}>
                {pill}
                <ChevronDown size={15} className={`text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="absolute left-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-2 z-50 animate-[popin_.15s_ease-out]">
                    <div className="px-2.5 pt-1 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">আমার কোর্স</div>
                    {info.enrolled.map((id) => {
                        const c = COURSES.find((x) => x.id === id)!;
                        const active = id === info.current;
                        return (
                            <button key={id} onClick={() => { setOpen(false); switchTo(id); }}
                                className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left cursor-pointer transition-colors ${active ? 'bg-emerald-500/10' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                                <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${ACCENT[c.accent].icon}`}><CourseIcon id={c.id} className="w-[18px] h-[18px]" /></span>
                                <span className="min-w-0 flex-1">
                                    <span className="block text-sm font-bold text-slate-900 dark:text-white truncate">{c.name}</span>
                                    <span className="block text-[11px] text-slate-500 truncate">{c.title}</span>
                                </span>
                                {active && <Check size={17} className="text-emerald-500 shrink-0" />}
                            </button>
                        );
                    })}
                    <Link href="/profile" onClick={() => setOpen(false)}
                        className="mt-1.5 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-emerald-600 dark:text-emerald-400 border border-dashed border-emerald-500/40 hover:bg-emerald-500/10">
                        <Plus size={14} /> নতুন কোর্স নিন
                    </Link>
                </div>
            )}
        </div>
    );
}
