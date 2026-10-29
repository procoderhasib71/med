'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from '@/lib/session';
import Link from 'next/link';
import { session as auth } from '@/lib/session';
import { authFetch } from '@/lib/authFetch';

// Admin পেজ মোড়ানোর জন্য। আসল সুরক্ষা সার্ভারে (প্রতিটা admin API নিজে যাচাই করে), এটা শুধু পেজ লুকায়।
export default function AdminGate({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<'loading' | 'ok' | 'denied' | 'login'>('loading');

    useEffect(() => {
        return onAuthStateChanged(auth, async (user) => {
            if (!user) return setState('login');
            try {
                const res = await authFetch('/api/admin/me');
                setState(res.ok ? 'ok' : 'denied');
            } catch {
                setState('denied');
            }
        });
    }, []);

    if (state === 'ok') return <>{children}</>;
    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-950 text-slate-300 text-sm p-6">
            {state === 'loading' && <span>যাচাই হচ্ছে...</span>}
            {state === 'login' && <Link href="/login" className="text-emerald-400 underline">admin হিসেবে লগইন করুন</Link>}
            {state === 'denied' && (
                <>
                    <span>🔒 এই পেজ শুধু admin এর জন্য।</span>
                    <Link href="/" className="text-emerald-400 underline">হোমে ফিরে যান</Link>
                </>
            )}
        </div>
    );
}
