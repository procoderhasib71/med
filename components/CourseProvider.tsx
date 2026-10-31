'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { authFetch } from '@/lib/authFetch';
import type { Platform } from '@/lib/platform';
import { onAuthStateChanged, session } from '@/lib/session';

// ক্লাসরুম (app.admcq.com): লগইন ছাড়া ঢোকা যায় না, আর শুধু নেওয়া কোর্সগুলো চলে।
// লগইন না থাকলে লগইন পেজে; একটাও কোর্স না থাকলে প্রোফাইলে (কোর্স নিতে);
// বাছাই করা কোর্স নেওয়া না থাকলে প্রথম নেওয়া কোর্সে। কোর্সের নিজের ঠিকানায় (med.admcq.com ইত্যাদি) কিছুই বদলায় না।

export type CourseInfo = { classroom: boolean; current: Platform; chosen: Platform | null; loggedIn: boolean; enrolled: Platform[] };

const CourseContext = createContext<{ info: CourseInfo | null; switchTo: (p: Platform) => Promise<void> }>({
    info: null,
    switchTo: async () => undefined,
});
export const useCourse = () => useContext(CourseContext);

// এই পেজগুলো নিজেরাই লগইন/কোর্স সামলায়
const FREE = ['/login', '/profile', '/course/', '/admin', '/reports'];

async function choose(p: Platform) {
    const r = await authFetch('/api/course', { method: 'POST', body: JSON.stringify({ platform: p }) });
    return r.ok;
}

export default function CourseProvider({ children }: { children: React.ReactNode }) {
    const path = usePathname();
    const free = FREE.some((f) => path === f || path.startsWith(f.endsWith('/') ? f : `${f}/`));
    const [info, setInfo] = useState<CourseInfo | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => onAuthStateChanged(session, async () => {
        const d = await (await authFetch('/api/course', { cache: 'no-store' })).json().catch(() => null);
        if (!d?.success) return;
        setInfo(d);
        if (!d.classroom || free) return;
        const here = window.location.pathname + window.location.search;
        if (!d.loggedIn) return window.location.replace(`/login?next=${encodeURIComponent(here)}`);
        if (d.enrolled.length === 0) return window.location.replace('/profile');
        if (!d.chosen || !d.enrolled.includes(d.chosen)) {
            // কুকি নেই বা নেওয়া কোর্স নয়: প্রথম নেওয়া কোর্স চালু করে আবার লোড
            setBusy(true);
            if (await choose(d.enrolled[0])) window.location.reload();
            else setBusy(false);
        }
    }), [free]);

    const switchTo = async (p: Platform) => {
        if (p === info?.current) return;
        setBusy(true);
        if (await choose(p)) window.location.assign('/');
        else setBusy(false);
    };

    if (busy) {
        return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] dark:bg-[#0B1120]"><Loader2 className="animate-spin text-emerald-500" /></div>;
    }
    return <CourseContext.Provider value={{ info, switchTo }}>{children}</CourseContext.Provider>;
}
