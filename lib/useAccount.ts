'use client';

import { useCallback, useEffect, useState } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, updateProfile } from 'firebase/auth';
import { authFetch } from '@/lib/authFetch';
import { COURSES, type CourseId } from '@/lib/courses';
import { auth, phoneEmail } from '@/lib/firebase';
import { onAuthStateChanged, session, signOut } from '@/lib/session';

// প্রোফাইল পেজের সব কাজ: লোড, কোর্স নেওয়া, কোর্সে ঢোকা, নাম, পাসওয়ার্ড, বট, লগআউট

export type Platform = { id: CourseId; name: string; enrolled: boolean; enrolledAt: string; attempted: number; correct: number; score: number };
export type Profile = { uid: string; name: string; email: string; phone: string; since: string; botLinked: boolean };
export type Msg = { ok: boolean; text: string } | null;

const post = (url: string, body: unknown, method = 'POST') =>
    authFetch(url, { method, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => ({}));

export function useAccount() {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [platforms, setPlatforms] = useState<Platform[]>([]);
    const [status, setStatus] = useState<'loading' | 'in' | 'error'>('loading');
    const [msg, setMsg] = useState<Msg>(null);
    const [busy, setBusy] = useState('');

    const load = useCallback(async () => {
        const r = await authFetch('/api/profile', { cache: 'no-store' }).catch(() => null);
        if (r?.status === 401) {
            window.location.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
            return null;
        }
        const d = r ? await r.json().catch(() => ({})) : {};
        if (!d.success) {
            setMsg({ ok: false, text: d.error || `সার্ভার ${r?.status ?? 'পাওয়া যায়নি'}` });
            setStatus('error');
            return null;
        }
        setProfile(d.profile);
        setPlatforms(d.platforms);
        setStatus('in');
        return d as { profile: Profile; platforms: Platform[] };
    }, []);

    // Firebase এর লগইন ফিরে আসার পরে লোড (নইলে টোকেন ছাড়া 401)
    useEffect(() => onAuthStateChanged(session, () => { load(); }), [load]);

    const enroll = async (id: CourseId) => {
        setBusy(`enroll-${id}`);
        const d = await post('/api/enroll', { platform: id });
        if (d.success) {
            await load();
            setMsg({ ok: true, text: `${COURSES.find((c) => c.id === id)?.name} কোর্সটি নেওয়া হয়েছে, ক্লাসরুমে এটাই চালু` });
        } else setMsg({ ok: false, text: d.error || 'কোর্স নেওয়া যায়নি' });
        setBusy('');
        return Boolean(d.success);
    };

    /** নেওয়া কোর্স চালু করে ক্লাসরুমের হোমে */
    const open = async (id: CourseId) => {
        setBusy(`open-${id}`);
        const d = await post('/api/course', { platform: id });
        if (d.success) window.location.assign('/');
        else { setMsg({ ok: false, text: d.error || 'কোর্স চালু করা যায়নি' }); setBusy(''); }
    };

    const saveName = async (name: string) => {
        setBusy('name');
        const d = await post('/api/me', { name }, 'PATCH');
        if (d.success) {
            if (auth.currentUser) await updateProfile(auth.currentUser, { displayName: name.trim() }).catch(() => null);
            setProfile((p) => (p ? { ...p, name: name.trim() } : p));
        }
        setMsg(d.success ? { ok: true, text: 'নাম সেভ হয়েছে' } : { ok: false, text: d.error || 'সেভ হয়নি' });
        setBusy('');
    };

    const changePassword = async (current: string, next: string, again: string) => {
        const user = auth.currentUser;
        if (!user || !profile?.phone) { setMsg({ ok: false, text: 'পাসওয়ার্ড বদলাতে লগআউট করে আবার লগইন করুন।' }); return false; }
        if (next.length < 6) { setMsg({ ok: false, text: 'নতুন পাসওয়ার্ড অন্তত ৬ অক্ষরের দিন।' }); return false; }
        if (next !== again) { setMsg({ ok: false, text: 'দুই জায়গার নতুন পাসওয়ার্ড মেলেনি।' }); return false; }
        setBusy('pw');
        try {
            await reauthenticateWithCredential(user, EmailAuthProvider.credential(phoneEmail(profile.phone), current));
            await updatePassword(user, next);
            setMsg({ ok: true, text: 'পাসওয়ার্ড বদলানো হয়েছে, সব কোর্সে নতুনটা চলবে' });
            return true;
        } catch (err) {
            const c = String((err as { code?: string })?.code || '');
            setMsg({ ok: false, text: c === 'auth/invalid-credential' || c === 'auth/wrong-password' ? 'এখনকার পাসওয়ার্ড ভুল।' : `বদলানো যায়নি (${c})` });
            return false;
        } finally {
            setBusy('');
        }
    };

    const linkCode = async () => {
        const d = await post('/api/me/link-code', {});
        if (!d.success) setMsg({ ok: false, text: d.error || 'কোড বানানো যায়নি' });
        return d.success ? String(d.code) : '';
    };

    const logout = async () => {
        await signOut(session);
        window.location.replace('/login');
    };

    return { profile, platforms, status, msg, setMsg, busy, enroll, open, saveName, changePassword, linkCode, logout };
}

export type Account = ReturnType<typeof useAccount>;

export const bn = (v: number | string) => String(v).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]);
export const pct = (p: { attempted: number; correct: number }) => (p.attempted ? Math.round((p.correct * 100) / p.attempted) : 0);
export const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'A';
export const showDate = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' });
};
