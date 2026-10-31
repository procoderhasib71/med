'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { ACCOUNT_URL, PLATFORMS } from '@/lib/platform';
import { useCourse } from '@/components/CourseProvider';

// হেডারে কোন কোর্স চালু; ক্লাসরুমে ক্লিক করলে নেওয়া কোর্সগুলোর মধ্যে বদলানো যায়
export default function CourseSwitcher() {
    const { info, switchTo } = useCourse();
    const [open, setOpen] = useState(false);
    const box = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open]);

    if (!info) return null;
    const label = PLATFORMS[info.current].short;
    if (!info.classroom || !info.loggedIn) {
        return <span className="text-[8px] font-extrabold tracking-widest text-[#64748B] uppercase">{label}</span>;
    }

    return (
        <div ref={box} className="relative">
            <button onClick={() => setOpen((o) => !o)}
                className="flex items-center gap-0.5 text-[9px] font-extrabold tracking-widest text-[#059669] uppercase cursor-pointer">
                {label} <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="absolute left-0 top-full mt-2 w-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-1.5 z-50">
                    <div className="px-2.5 pt-1.5 pb-1 text-[10px] font-bold text-slate-400">আমার কোর্স</div>
                    {info.enrolled.map((p) => (
                        <button key={p} onClick={() => { setOpen(false); switchTo(p); }}
                            className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-sm font-semibold text-left text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                            {PLATFORMS[p].name}
                            {p === info.current && <Check size={15} className="text-emerald-500" />}
                        </button>
                    ))}
                    <a href={`${ACCOUNT_URL}/profile`}
                        className="mt-1 flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold text-emerald-600 hover:bg-emerald-500/10 border-t border-slate-100 dark:border-slate-800">
                        <Plus size={14} /> আরও কোর্স নিন
                    </a>
                </div>
            )}
        </div>
    );
}
