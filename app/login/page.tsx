'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ConfirmationResult,
  EmailAuthProvider,
  GoogleAuthProvider,
  RecaptchaVerifier,
  getRedirectResult,
  linkWithCredential,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithPopup,
  signInWithRedirect,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import { ArrowRight, KeyRound, Loader2, Lock, Phone, User as UserIcon } from 'lucide-react';
import { auth, phoneEmail, toE164 } from '@/lib/firebase';
import { getMe, setMyName } from '@/lib/siteApi';
import { onAuthStateChanged, session } from '@/lib/session';
import BrandLoader from '@/components/BrandLoader';
import { LangSwitch, useLang } from '@/lib/i18n';

// স্টুডেন্ট লগইন (app.admcq.com): ফোন নম্বর + পাসওয়ার্ড, OTP ছাড়া।
// নতুন অ্যাকাউন্ট আর পাসওয়ার্ড ভুলে গেলে: ফোনে একবার OTP, তারপর নিজের পাসওয়ার্ড।
// আগে শুধু OTP দিয়ে ঢুকতেন এমন ছাত্র "রেজিস্টার" দিয়ে একবার পাসওয়ার্ড বানালেই হয়, পুরনো ডাটা থাকে।

type Mode = 'login' | 'register' | 'forgot';
type Step = 'phone' | 'code' | 'password';

const BN = (s: string) => s.replace(/[০-৯]/g, (x) => String('০১২৩৪৫৬৭৮৯'.indexOf(x)));

type T = (bn: string, en: string) => string;
function authError(err: unknown, t: T) {
  const c = String((err as { code?: string })?.code || '');
  const msg: Record<string, [string, string]> = {
    'auth/invalid-credential': ['ফোন নম্বর বা পাসওয়ার্ড ভুল। আগে কখনো পাসওয়ার্ড না বানিয়ে থাকলে "রেজিস্টার করুন" দিন।', 'Wrong phone number or password. Never set a password? Use "Register".'],
    'auth/wrong-password': ['ফোন নম্বর বা পাসওয়ার্ড ভুল।', 'Wrong phone number or password.'],
    'auth/user-not-found': ['এই নম্বরে অ্যাকাউন্ট নেই। "রেজিস্টার করুন" দিন।', 'No account for this number. Use "Register".'],
    'auth/invalid-phone-number': ['ফোন নম্বরটা ঠিক নেই।', 'That phone number is not valid.'],
    'auth/invalid-verification-code': ['কোডটা ভুল হয়েছে।', 'Wrong code.'],
    'auth/code-expired': ['কোডের মেয়াদ শেষ। নতুন কোড নিন।', 'The code expired. Get a new one.'],
    'auth/too-many-requests': ['অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।', 'Too many attempts. Try again a little later.'],
    'auth/quota-exceeded': ['আজকের SMS এর সীমা শেষ। পরে চেষ্টা করুন।', 'The SMS limit for today is reached. Try later.'],
    'auth/weak-password': ['পাসওয়ার্ড অন্তত ৬ অক্ষরের দিন।', 'Use at least 6 characters.'],
    'auth/requires-recent-login': ['আবার OTP দিয়ে যাচাই করুন।', 'Verify again with an OTP.'],
    'auth/popup-closed-by-user': ['Google এর জানালাটা বন্ধ হয়ে গেছে।', 'The Google window was closed.'],
    'auth/unauthorized-domain': ['এই ঠিকানা থেকে লগইন অনুমোদিত নয়।', 'Login is not allowed from this address.'],
    'auth/network-request-failed': ['ইন্টারনেট সংযোগে সমস্যা।', 'Network problem.'],
    'auth/operation-not-allowed': ['এই লগইন পদ্ধতি এখনো চালু হয়নি।', 'This login method is not enabled yet.'],
  };
  console.error('Auth error:', err);
  const m = msg[c];
  return `${m ? t(m[0], m[1]) : t('কাজটা করা যায়নি। আবার চেষ্টা করুন।', 'Something went wrong. Please try again.')}${c ? ` (${c})` : ''}`;
}

const input = 'w-full pl-11 pr-4 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm';
const button = 'w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-70 text-sm cursor-pointer';
const Field = ({ icon: Icon, label, ...props }: { icon: typeof Phone; label: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div>
    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 ml-1">{label}</label>
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400"><Icon size={18} /></div>
      <input {...props} className={input} required />
    </div>
  </div>
);
const Submit = ({ text, loading }: { text: string; loading: boolean }) => (
  <button type="submit" disabled={loading} className={button}>
    {loading ? <Loader2 size={18} className="animate-spin" /> : <>{text} <ArrowRight size={16} /></>}
  </button>
);

/** ?next=/course/med এর মতো; শুধু এই সাইটের পেজ */
function nextParam() {
  const raw = new URLSearchParams(window.location.search).get('next') || '';
  return raw.startsWith('/') && !raw.startsWith('//') ? raw : '';
}

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [needName, setNeedName] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { t } = useLang();
  const [checking, setChecking] = useState(true);   // লগইন আছে কিনা দেখা শেষ না হলে ফর্ম নয়, লোডার
  const confirmation = useRef<ConfirmationResult | null>(null);
  const recaptcha = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    // আগে থেকেই লগইন থাকলে ফর্ম না দেখিয়ে সোজা ক্লাসরুমে (শুধু প্রথমবারের অবস্থা দেখি; রেজিস্ট্রেশনের মাঝে OTP তে লগইন হলে নয়)
    let first = true;
    const stop = onAuthStateChanged(session, (user) => {
      if (first) {
        if (user) window.location.replace(nextParam() || '/');
        else setChecking(false);
      }
      first = false;
    });
    // Google এর popup আটকে গেলে redirect এ যাই, ফিরে এলে এখানে লগইন শেষ
    getRedirectResult(auth).then((r) => { if (r) finish(false); }).catch((err) => setError(authError(err, t)));
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setStep('phone');
    setError('');
    setCode('');
    setPassword('');
    setPassword2('');
  };

  // প্রথমবার এলে সার্ভার নিজেই প্রোফাইল বানায়; নতুন রেজিস্ট্রেশন হলে প্রোফাইলে (কোর্স নিতে), নইলে ক্লাসরুমে
  const finish = async (registered: boolean, displayName = '') => {
    await getMe();
    if (displayName) await setMyName(displayName);
    window.location.replace(nextParam() || (registered ? '/profile' : '/'));
  };

  const run = async (fn: () => Promise<void>) => {
    setError('');
    setLoading(true);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error && !(err as { code?: string }).code ? err.message : authError(err, t));
    } finally {
      setLoading(false);
    }
  };

  const login = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const number = toE164(phone);
      if (!number) throw new Error(t('ফোন নম্বরটা ঠিক নেই। ০১ দিয়ে ১১ অঙ্কের নম্বর দিন।', 'Invalid number. Enter 11 digits starting with 01.'));
      await signInWithEmailAndPassword(auth, phoneEmail(number), password);
      await finish(false);
    });
  };

  const sendCode = (e?: React.FormEvent) => {
    e?.preventDefault();
    run(async () => {
      const number = toE164(phone);
      if (!number) throw new Error(t('ফোন নম্বরটা ঠিক নেই। ০১ দিয়ে ১১ অঙ্কের নম্বর দিন।', 'Invalid number. Enter 11 digits starting with 01.'));
      // আগে থেকে রেজিস্টার্ড হলে নতুন কোড নয়, লগইন করতে বলি; "ভুলে গেছি" তে উল্টো
      const { registered } = await fetch(`/api/auth/phone?phone=${encodeURIComponent(number)}`).then((r) => r.json()).catch(() => ({ registered: null }));
      if (mode === 'register' && registered === true) throw new Error(t('এই নম্বরে আগেই রেজিস্ট্রেশন করা আছে। লগইন করুন, পাসওয়ার্ড মনে না থাকলে "পাসওয়ার্ড ভুলে গেছি" দিন।', 'This number is already registered. Log in, or use "Forgot password".'));
      if (mode === 'forgot' && registered === false) throw new Error(t('এই নম্বরে কোনো অ্যাকাউন্ট নেই। "রেজিস্টার করুন" দিন।', 'No account for this number. Use "Register".'));
      try {
        recaptcha.current ||= new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
        confirmation.current = await signInWithPhoneNumber(auth, number, recaptcha.current);
      } catch (err) {
        recaptcha.current?.clear();
        recaptcha.current = null;
        throw err;
      }
      setStep('code');
      setCode('');
      setCooldown(60);
    });
  };

  const verifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      if (!confirmation.current) return setStep('phone');
      const cred = await confirmation.current.confirm(BN(code).trim());
      setNeedName(!cred.user.displayName);
      setStep('password');
    });
  };

  // OTP এর পরে পাসওয়ার্ড: নতুন হলে ফোনের সাথে জুড়ে দিই, আগে থেকে থাকলে বদলাই
  const savePassword = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const user = auth.currentUser;
      if (!user?.phoneNumber) return setStep('phone');
      if (password.length < 6) throw new Error(t('পাসওয়ার্ড অন্তত ৬ অক্ষরের দিন।', 'Use at least 6 characters.'));
      if (password !== password2) throw new Error(t('দুই জায়গার পাসওয়ার্ড মেলেনি।', 'The two passwords do not match.'));
      if (needName && name.trim().length < 2) throw new Error(t('আপনার নাম লিখুন।', 'Please enter your name.'));
      const hasPassword = user.providerData.some((p) => p.providerId === 'password');
      if (hasPassword) await updatePassword(user, password);
      else await linkWithCredential(user, EmailAuthProvider.credential(phoneEmail(user.phoneNumber), password));
      if (needName) await updateProfile(user, { displayName: name.trim() });
      await finish(mode === 'register', needName ? name.trim() : '');
    });
  };

  const google = () => run(async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      const c = String((err as { code?: string })?.code || '');
      if (c === 'auth/popup-blocked' || c === 'auth/operation-not-supported-in-this-environment') return signInWithRedirect(auth, provider);
      throw err;
    }
    await finish(false);
  });

  if (checking) return <BrandLoader />;

  const title = mode === 'login' ? t('স্টুডেন্ট লগইন', 'Student login') : mode === 'register' ? t('রেজিস্ট্রেশন', 'Registration') : t('পাসওয়ার্ড ভুলে গেছেন?', 'Forgot password?');

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-800 dark:text-slate-100">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-2xl p-7 sm:p-9">
        <div className="flex justify-end -mt-2 -mr-2 mb-2"><LangSwitch /></div>
        <a href="https://admcq.com" className="flex items-center justify-center gap-2 mb-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-blue-500 flex items-center justify-center font-black text-black text-xl">A</div>
          <span className="font-extrabold text-2xl">Ad<span className="text-emerald-500">MCQ</span></span>
        </a>
        <h1 className="text-center text-xl font-black mb-1">{title}</h1>
        <p className="text-center text-xs text-slate-500 dark:text-slate-400 mb-6">{t('একটা অ্যাকাউন্টে মেডিকেল, ভার্সিটি ক, খ আর ইঞ্জিনিয়ারিং', 'One account for Medical, Varsity Ka, Kha and Engineering')}</p>

        {error && <div className="mb-5 p-3 rounded-2xl bg-rose-100 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-sm text-rose-600 dark:text-rose-400 text-center">{error}</div>}

        {mode === 'login' && (
          <form onSubmit={login} className="space-y-4">
            <Field icon={Phone} label={t('মোবাইল নম্বর', 'Mobile number')} type="tel" inputMode="numeric" autoComplete="tel" placeholder="01712345678" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Field icon={Lock} label={t('পাসওয়ার্ড', 'Password')} type="password" autoComplete="current-password" placeholder="••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Submit loading={loading} text={t('লগইন', 'Log in')} />
            <button type="button" onClick={() => switchMode('forgot')} className="block mx-auto text-xs text-slate-500 hover:text-emerald-600 cursor-pointer">{t('পাসওয়ার্ড ভুলে গেছি', 'Forgot password')}</button>
            <p className="text-center text-sm text-slate-600 dark:text-slate-300 pt-1">
              {t('অ্যাকাউন্ট নেই?', 'No account?')} <button type="button" onClick={() => switchMode('register')} className="font-bold text-emerald-600 cursor-pointer">{t('রেজিস্টার করুন', 'Register')}</button>
            </p>
          </form>
        )}

        {mode !== 'login' && step === 'phone' && (
          <form onSubmit={sendCode} className="space-y-4">
            <Field icon={Phone} label={t('মোবাইল নম্বর', 'Mobile number')} type="tel" inputMode="numeric" autoComplete="tel" placeholder="01712345678" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Submit loading={loading} text={t('যাচাইয়ের কোড পাঠান', 'Send verification code')} />
            <p className="text-[11px] text-center text-slate-500">{t('নম্বরে একবার ৬ অঙ্কের কোড SMS এ যাবে। পরে লগইনে আর কোড লাগবে না।', 'A 6-digit code is sent by SMS once. No code is needed to log in later.')}</p>
          </form>
        )}

        {mode !== 'login' && step === 'code' && (
          <form onSubmit={verifyCode} className="space-y-4">
            <Field icon={KeyRound} label={t('SMS এ আসা কোড', 'Code from SMS')} type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} />
            <Submit loading={loading} text={t('যাচাই করুন', 'Verify')} />
            <div className="flex justify-between text-xs px-1 text-slate-500">
              <button type="button" onClick={() => setStep('phone')} className="hover:text-emerald-600 cursor-pointer">{t('নম্বর বদলান', 'Change number')}</button>
              <button type="button" disabled={cooldown > 0 || loading} onClick={() => sendCode()} className="hover:text-emerald-600 disabled:opacity-50 cursor-pointer">
                {cooldown > 0 ? t(`আবার কোড (${cooldown}s)`, `Resend (${cooldown}s)`) : t('আবার কোড পাঠান', 'Resend code')}
              </button>
            </div>
          </form>
        )}

        {mode !== 'login' && step === 'password' && (
          <form onSubmit={savePassword} className="space-y-4">
            <p className="text-xs text-center text-emerald-600 font-bold">✅ {t('নম্বর যাচাই হয়েছে, এখন পাসওয়ার্ড দিন', 'Number verified, now set a password')}</p>
            {needName && <Field icon={UserIcon} label={t('আপনার নাম (লিডারবোর্ডে দেখাবে)', 'Your name (shown on the leaderboard)')} type="text" autoComplete="name" placeholder={t('যেমন: রাফি আহমেদ', 'e.g. Rafi Ahmed')} value={name} onChange={(e) => setName(e.target.value)} />}
            <Field icon={Lock} label={mode === 'register' ? t('পাসওয়ার্ড (অন্তত ৬ অক্ষর)', 'Password (6+ characters)') : t('নতুন পাসওয়ার্ড', 'New password')} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Field icon={Lock} label={t('আবার পাসওয়ার্ড', 'Repeat password')} type="password" autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} />
            <Submit loading={loading} text={mode === 'register' ? t('রেজিস্ট্রেশন শেষ করুন', 'Finish registration') : t('পাসওয়ার্ড সেভ করুন', 'Save password')} />
          </form>
        )}

        {mode !== 'login' && step !== 'password' && (
          <button type="button" onClick={() => switchMode('login')} className="mt-4 w-full text-xs text-slate-500 hover:text-emerald-600 cursor-pointer">← {t('আগে থেকে অ্যাকাউন্ট আছে? লগইন করুন', 'Already have an account? Log in')}</button>
        )}
        <div id="recaptcha-container" />

        {step !== 'password' && (
          <>
            <div className="my-5 flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
              <span className="text-xs text-slate-400 font-semibold">{t('অথবা', 'or')}</span>
              <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800" />
            </div>
            <button onClick={google} disabled={loading} className="w-full py-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 font-bold text-sm flex items-center justify-center gap-3 cursor-pointer disabled:opacity-70">
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {t('Google দিয়ে লগইন', 'Continue with Google')}
            </button>
          </>
        )}
        <a href="https://admcq.com" className="mt-5 block text-center text-xs text-slate-400 hover:text-emerald-600">← {t('মূল সাইটে ফিরুন', 'Back to main site')}</a>
      </div>
    </div>
  );
}
