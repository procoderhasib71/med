'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { BookOpenCheck, Loader2 } from 'lucide-react';
import { authFetch } from '@/lib/authFetch';
import { ACCOUNT_URL, PLATFORMS, type Platform } from '@/lib/platform';
import { onAuthStateChanged, session } from '@/lib/session';

// ক্লাসরুম (app.admcq.com): ছাত্র যে কোর্সগুলো নিয়েছে শুধু সেগুলো চলে।
// বাছাই করা কোর্স নেওয়া না থাকলে প্রথম নেওয়া কোর্সে যায়; একটাও না থাকলে "কোর্স নিন" দেখায়।
// কোর্সের নিজের ঠিকানায় (med.admcq.com ইত্যাদি) কিছুই বদলায় না।

export type CourseInfo = { classroom: boolean; current: Platform; chosen: Platform | null; loggedIn: boolean; enrolled: Platform[] };

const CourseContext = createContext<{ info: CourseInfo | null; switchTo: (p: Platform) => Promise<void> }>({
    info: null,
    switchTo: async () => undefined,
});
export const useCourse = () => useContext(CourseContext);

async function choose(p: Platform) {
    const r = await authFetch('/api/course', { method: 'POST', body: JSON.stringify({ platform: p }) });
    return r.ok;
}

export default function CourseProvider({ children }: { children: React.ReactNode }) {
    const [info, setInfo] = useState<CourseInfo | null>(null);
    const [state, setState] = useState<'ready' | 'switching' | 'none'>('ready');

    useEffect(() => onAuthStateChanged(session, async () => {
        const d = await (await authFetch('/api/course', { cache: 'no-store' })).json().catch(() => null);
        if (!d?.success) return;
        setInfo(d);
        if (!d.classroom || !d.loggedIn) return;
        if (d.enrolled.length === 0) return setState('none');
        if (!d.chosen || !d.enrolled.includes(d.chosen)) {
            // কুকি নেই বা নেওয়া কোর্স নয়: প্রথম নেওয়া কোর্স চালু করে আবার লোড
            setState('switching');
            if (await choose(d.enrolled[0])) window.location.reload();
            else setState('ready');
        }
    }), []);

    const switchTo = async (p: Platform) => {
        if (p === info?.current) return;
        setState('switching');
        if (await choose(p)) window.location.assign('/');
        else setState('ready');
    };

    if (state === 'switching') {
        return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] dark:bg-[#0B1120]"><Loader2 className="animate-spin text-emerald-500" /></div>;
    }
    if (state === 'none') return <NoCourse />;
    return <CourseContext.Provider value={{ info, switchTo }}>{children}</CourseContext.Provider>;
}

function NoCourse() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-800 dark:text-slate-100">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center"><BookOpenCheck size={28} /></div>
            <h1 className="text-xl font-black">এখনো কোনো কোর্স নেননি</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                ক্লাসরুমে ঢুকতে আগে একটা কোর্স নিন: {Object.values(PLATFORMS).map((p) => p.name).join(', ')}।
            </p>
            <a href={`${ACCOUNT_URL}/#units`} className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold">কোর্সগুলো দেখুন</a>
        </div>
    );
}
