'use client';

import { use, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { authFetch } from '@/lib/authFetch';
import { isPlatform } from '@/lib/platform';
import { onAuthStateChanged, session } from '@/lib/session';

// শর্টকাট: /course/med?to=/qbank → মেডিকেল কোর্স চালু করে সেই পেজে।
// লগইন না থাকলে লগইনে, কোর্স নেওয়া না থাকলে প্রোফাইলে "কোর্স নিন"।
export default function CourseShortcut({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [error, setError] = useState('');

    useEffect(() => onAuthStateChanged(session, async (user) => {
        const raw = new URLSearchParams(window.location.search).get('to') || '/';
        const to = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';   // শুধু এই সাইটের পেজ
        if (!isPlatform(id)) return window.location.replace('/');
        if (!user) return window.location.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        const r = await authFetch('/api/course', { method: 'POST', body: JSON.stringify({ platform: id }) });
        if (r.ok) return window.location.replace(to);
        if (r.status === 403) return window.location.replace(`/profile?enroll=${id}`);
        setError('কোর্স চালু করা যায়নি, আবার চেষ্টা করুন।');
    }), [id]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] dark:bg-[#0B1120] text-sm text-slate-500">
            {error || <Loader2 className="animate-spin text-emerald-500" />}
        </div>
    );
}
