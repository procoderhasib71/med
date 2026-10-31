'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Lock, ShieldCheck } from 'lucide-react';
import { authFetch } from '@/lib/authFetch';
import BrandLoader from '@/components/BrandLoader';

// Admin পেজ মোড়ানোর জন্য। আসল সুরক্ষা সার্ভারে (প্রতিটা admin API নিজে যাচাই করে), এটা শুধু পেজ লুকায়।
// admin হলে পেজ; না হলে admin পাসওয়ার্ডের ফর্ম (ছাত্রের লগইন লাগে না)। প্রথমবার পাসওয়ার্ড সেট করা না থাকলে
// admin ইমেইলে লগইন করা অবস্থায় এখানেই সেট করা যায়, নইলে scripts/set-admin-password.mjs দিয়ে।
export default function AdminGate({ children }: { children: React.ReactNode }) {
    const [state, setState] = useState<'loading' | 'ok' | 'login' | 'setup'>('loading');
    const [password, setPassword] = useState('');
    const [password2, setPassword2] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const check = useCallback(async () => {
        const me = await authFetch('/api/admin/me').catch(() => null);
        if (me?.ok) return setState('ok');
        const d = await fetch('/api/admin/auth', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({}));
        setState(d.configured === false ? 'setup' : 'login');
    }, []);

    useEffect(() => { Promise.resolve().then(check); }, [check]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (state === 'setup' && password !== password2) return setError('দুই জায়গার পাসওয়ার্ড মেলেনি');
        setBusy(true);
        const r = await authFetch('/api/admin/auth', { method: 'POST', body: JSON.stringify({ action: state === 'setup' ? 'setup' : 'login', password }) });
        const d = await r.json().catch(() => ({}));
        setBusy(false);
        if (!d.success) return setError(d.error || 'হয়নি, আবার চেষ্টা করুন');
        setPassword('');
        setPassword2('');
        setState('ok');
    };

    if (state === 'ok') return <>{children}</>;
    if (state === 'loading') return <BrandLoader text="admin যাচাই হচ্ছে..." />;

    const input = 'w-full pl-11 pr-4 py-3.5 rounded-2xl border border-slate-700 bg-slate-950/60 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm';
    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-[#0B1120] text-slate-100">
            <form onSubmit={submit} className="w-full max-w-sm bg-slate-900 rounded-[2rem] border border-slate-800 shadow-2xl p-7 space-y-4">
                <div className="flex flex-col items-center gap-2 mb-2">
                    <span className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center"><ShieldCheck size={24} /></span>
                    <h1 className="text-lg font-black">{state === 'setup' ? 'admin পাসওয়ার্ড সেট করুন' : 'Admin প্যানেল'}</h1>
                    <p className="text-xs text-slate-400 text-center">
                        {state === 'setup' ? 'প্রথমবার: অন্তত ৮ অক্ষরের একটা পাসওয়ার্ড দিন' : 'admin পাসওয়ার্ড দিয়ে ঢুকুন'}
                    </p>
                </div>
                {error && <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-sm text-rose-300 text-center">{error}</div>}
                <div className="relative">
                    <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input className={input} type="password" autoComplete={state === 'setup' ? 'new-password' : 'current-password'} placeholder="পাসওয়ার্ড" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
                </div>
                {state === 'setup' && (
                    <div className="relative">
                        <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input className={input} type="password" autoComplete="new-password" placeholder="আবার পাসওয়ার্ড" value={password2} onChange={(e) => setPassword2(e.target.value)} required />
                    </div>
                )}
                <button type="submit" disabled={busy} className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer">
                    {busy ? <Loader2 size={18} className="animate-spin" /> : state === 'setup' ? 'সেট করে ঢুকুন' : 'ঢুকুন'}
                </button>
                {state === 'setup' && (
                    <p className="text-[11px] text-slate-500 text-center">প্রথমবার সেট করতে admin ইমেইলে লগইন থাকতে হয়। না থাকলে কম্পিউটারে চালান: node scripts/set-admin-password.mjs</p>
                )}
            </form>
        </div>
    );
}
