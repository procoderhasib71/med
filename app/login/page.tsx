'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ConfirmationResult,
  GoogleAuthProvider,
  RecaptchaVerifier,
  getRedirectResult,
  signInWithPhoneNumber,
  signInWithPopup,
  signInWithRedirect,
  updateProfile,
} from 'firebase/auth';
import { getMe, setMyName } from '@/lib/siteApi';
import { ACCOUNT_URL, CENTRAL_LOGIN, onAdmcqDomain } from '@/lib/platform';
import { auth } from '@/lib/firebase';
import { Loader2, Phone, KeyRound, User, Stethoscope, ArrowRight, Sun, Moon, Home } from 'lucide-react';
import { useTheme } from 'next-themes';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [step, setStep] = useState<'phone' | 'code' | 'name'>('phone');
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    // admcq.com এর subdomain এ লগইন হয় admcq.com এ (একবার লগইনে চার সাইট), লগইন শেষে এখানে ফিরে আসে
    if (CENTRAL_LOGIN && onAdmcqDomain(window.location.host)) {
      window.location.replace(`${ACCOUNT_URL}/login?next=${encodeURIComponent(window.location.origin + nextPath())}`);
      return;
    }
    setMounted(true);
    // Google এর popup আটকে গেলে redirect এ যাই, ফিরে এলে এখানে লগইন শেষ হয়
    getRedirectResult(auth).then((r) => { if (r) finishLogin(); }).catch((err) => setError(authError(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const setAuthCookie = () => {
    const isLive = typeof window !== 'undefined' && window.location.hostname.includes('adqlive.com');
    const domainStr = isLive ? 'domain=.adqlive.com;' : '';
    document.cookie = `auth-token=true; path=/; max-age=2592000; SameSite=Lax; ${domainStr}`;
  };

  // ব্যবহারকারীকে বোঝার মতো কারণ, শেষে Firebase এর কোড (সমস্যা খুঁজতে কাজে লাগে)
  const authError = (err: any) => {
    const c = String(err?.code || '');
    const msg: Record<string, string> = {
      'auth/invalid-phone-number': 'ফোন নম্বরটা ঠিক নেই। ০১ দিয়ে ১১ অঙ্কের নম্বর দিন।',
      'auth/invalid-verification-code': 'কোডটা ভুল হয়েছে। আবার দেখে লিখুন।',
      'auth/code-expired': 'কোডের মেয়াদ শেষ। নতুন কোড নিন।',
      'auth/too-many-requests': 'অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।',
      'auth/quota-exceeded': 'আজকের SMS এর সীমা শেষ। পরে চেষ্টা করুন বা Google দিয়ে লগইন করুন।',
      'auth/operation-not-allowed': 'এই লগইন পদ্ধতি এখনো চালু হয়নি।',
      'auth/popup-closed-by-user': 'Google এর জানালাটা বন্ধ হয়ে গেছে। আবার চেষ্টা করুন।',
      'auth/unauthorized-domain': 'এই ঠিকানা থেকে লগইন অনুমোদিত নয়।',
      'auth/network-request-failed': 'ইন্টারনেট সংযোগে সমস্যা। আবার চেষ্টা করুন।',
      'auth/captcha-check-failed': 'যাচাই ব্যর্থ হয়েছে। পেজ রিফ্রেশ করে আবার চেষ্টা করুন।',
    };
    console.error('Login error:', err);
    return `${msg[c] || 'লগইন করা যায়নি। আবার চেষ্টা করুন।'}${c ? ` (${c})` : ''}`;
  };

  // লগইনের পরে কোথায় যাবে (?next=/course/med এর মতো); শুধু এই সাইটের পেজ
  const nextPath = () => {
    const raw = new URLSearchParams(window.location.search).get('next') || '/';
    return raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
  };

  const finishLogin = async () => {
    // প্রথমবার এলে সার্ভার নিজেই Turso তে প্রোফাইল বানায়; নাম না থাকলে জিজ্ঞেস করি
    const me = await getMe().catch(() => null);
    setAuthCookie();
    if (me && !me.name.trim()) {
      setStep('name');
      return;
    }
    router.push(nextPath());
  };

  // '01712345678', '+8801712345678', বাংলা অঙ্ক সব চলে
  const toE164 = (raw: string) => {
    const d = raw.replace(/[০-৯]/g, (x) => String('০১২৩৪৫৬৭৮৯'.indexOf(x))).replace(/\D/g, '');
    const local = d.startsWith('880') ? d.slice(2) : d;
    return /^01[3-9]\d{8}$/.test(local) ? `+88${local}` : '';
  };

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError('');
    const number = toE164(phone);
    if (!number) return setError('ফোন নম্বরটা ঠিক নেই। ০১ দিয়ে ১১ অঙ্কের নম্বর দিন, যেমন 01712345678');
    setLoading(true);
    try {
      recaptchaRef.current ||= new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
      confirmationRef.current = await signInWithPhoneNumber(auth, number, recaptchaRef.current);
      setStep('code');
      setCode('');
      setCooldown(60);
    } catch (err: any) {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
      setError(authError(err));
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!confirmationRef.current) return setStep('phone');
    setLoading(true);
    try {
      await confirmationRef.current.confirm(code.replace(/[০-৯]/g, (x) => String('০১২৩৪৫৬৭৮৯'.indexOf(x))).trim());
      await finishLogin();
    } catch (err: any) {
      setError(authError(err));
    } finally {
      setLoading(false);
    }
  };

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (n.length < 2) return setError('আপনার নাম লিখুন');
    setLoading(true);
    try {
      if (auth.currentUser) await updateProfile(auth.currentUser, { displayName: n });
      await setMyName(n);
      router.push(nextPath());
    } catch (err: any) {
      setError(authError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      await finishLogin();
    } catch (err: any) {
      const c = String(err?.code || '');
      // popup আটকে গেলে বা ব্রাউজার popup চালাতে না পারলে পুরো পাতা Google এ যায়, ফিরে এসে লগইন শেষ
      if (c === 'auth/popup-blocked' || c === 'auth/operation-not-supported-in-this-environment' || c === 'auth/web-storage-unsupported') {
        await signInWithRedirect(auth, provider).catch((e2) => setError(authError(e2)));
        return;
      }
      setError(authError(err));
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 bg-slate-50 dark:bg-[#0B1120] transition-colors duration-300 overflow-hidden font-sans">
      <div className="absolute top-6 w-full px-6 flex justify-between items-center z-50 max-w-7xl mx-auto left-0 right-0">
        <Link 
          href="/" 
          className="p-2.5 rounded-full bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-all shadow-xs"
        >
          <Home size={18} />
        </Link>
        {mounted && (
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-full bg-white/70 dark:bg-slate-800/70 backdrop-blur-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 transition-all shadow-xs focus:outline-none"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        )}
      </div>

      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/20 dark:bg-emerald-600/15 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-teal-500/20 dark:bg-teal-600/15 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl rounded-[2.5rem] border border-slate-200/80 dark:border-slate-800 shadow-2xl p-8 sm:p-10 transition-colors duration-300">
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-lg shadow-emerald-500/20 mb-4 transform hover:scale-105 transition-transform">
            <Stethoscope size={32} className="text-white" />
          </div>
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
              ADQ<span className="text-emerald-600 dark:text-emerald-400">Live</span>
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mt-2">
            স্বাগতম, ভবিষ্যৎ ডাক্তার! 🩺
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            আপনার মেডিকেল পোর্টালে লগইন করুন
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 rounded-2xl bg-rose-100 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-sm text-rose-600 dark:text-rose-400 font-medium text-center">
            {error}
          </div>
        )}

        {step === 'phone' && (
        <form onSubmit={sendCode} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">
              ফোন নম্বর
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                <Phone size={18} />
              </div>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="01712345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm transition-all"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold transition-all shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 disabled:opacity-70 text-sm active:scale-[0.98] cursor-pointer"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <>কোড পাঠান <ArrowRight size={16} /></>}
          </button>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">নম্বরে ৬ অঙ্কের একটা কোড SMS এ যাবে</p>
        </form>
        )}

        {step === 'code' && (
        <form onSubmit={verifyCode} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">
              SMS এ আসা কোড
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                <KeyRound size={18} />
              </div>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm transition-all"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold transition-all shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 disabled:opacity-70 text-sm active:scale-[0.98] cursor-pointer"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <>লগইন করুন <ArrowRight size={16} /></>}
          </button>
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
            <button type="button" onClick={() => { setStep('phone'); setError(''); }} className="hover:text-emerald-600 cursor-pointer">
              নম্বর বদলান
            </button>
            <button type="button" disabled={cooldown > 0 || loading} onClick={() => sendCode()} className="hover:text-emerald-600 disabled:opacity-50 cursor-pointer">
              {cooldown > 0 ? `আবার কোড (${cooldown}s)` : 'আবার কোড পাঠান'}
            </button>
          </div>
        </form>
        )}

        {step === 'name' && (
        <form onSubmit={saveName} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">
              আপনার নাম (লিডারবোর্ডে দেখাবে)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                <User size={18} />
              </div>
              <input
                type="text"
                autoComplete="name"
                placeholder="যেমন: রাফি আহমেদ"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm transition-all"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold transition-all shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 disabled:opacity-70 text-sm active:scale-[0.98] cursor-pointer"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <>শুরু করুন <ArrowRight size={16} /></>}
          </button>
        </form>
        )}
        <div id="recaptcha-container" />

        {step !== 'name' && <>
        <div className="my-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
          <span className="text-xs text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">অথবা</span>
          <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
        </div>

        <button
          onClick={handleGoogle}
          className="w-full py-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 text-slate-700 dark:text-slate-200 font-bold text-sm transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-center justify-center gap-3 shadow-xs dark:shadow-inner group active:scale-[0.98] cursor-pointer"
        >
          <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Google দিয়ে লগইন করুন
        </button>
        </>}
      </div>
    </div>
  );
}