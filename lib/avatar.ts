'use client';

import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

// অবতার: ইমোজি + রঙ। Shongi Focus, Money আর AdMCQ এ একই; থাকে Firestore এ (users/{uid}/profile/avatar),
// যেখানে শুধু নিজে পড়ে/লেখে (security rules)। AdMCQ এ Firestore SDK আনি না: লগইনের টোকেন দিয়ে সরাসরি REST এ যাই, তাই rules ঠিক একই খাটে।
export const AVATARS = ['👨‍🎓', '👩‍🎓', '🧑‍⚕️', '👨‍⚕️', '👩‍⚕️', '🧑‍💻', '👨‍💻', '👩‍💻', '👨‍🏫', '👩‍🏫', '🧑‍🔬', '🧕', '🧔', '👦', '👧', '🦸', '🦊', '🐼', '🐯', '🦁', '🐨', '🐸', '🦉', '🐬', '🦄', '🚀', '⭐', '🔥'];
export const COLORS: Record<string, [string, string]> = {
    indigo: ['#6366f1', '#8b5cf6'], rose: ['#f43f5e', '#fb923c'], emerald: ['#10b981', '#14b8a6'], sky: ['#0ea5e9', '#6366f1'],
    amber: ['#f59e0b', '#ef4444'], pink: ['#ec4899', '#a855f7'], teal: ['#14b8a6', '#0ea5e9'], slate: ['#475569', '#1e293b'],
};
export type Look = { avatar?: string; avColor?: string };

const url = (uid: string) =>
    `https://firestore.googleapis.com/v1/projects/${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${uid}/profile/avatar`;

export async function loadMyAvatar(): Promise<Look> {
    const u = auth.currentUser;
    if (!u) return {};
    try {
        const r = await fetch(url(u.uid), { headers: { Authorization: `Bearer ${await u.getIdToken()}` }, cache: 'no-store' });
        if (!r.ok) return {};
        const f = (await r.json()).fields || {};
        return { avatar: f.avatar?.stringValue || '', avColor: f.avColor?.stringValue || 'indigo' };
    } catch { return {}; }
}

export async function saveMyAvatar(look: Look): Promise<void> {
    const u = auth.currentUser;
    if (!u) return;
    const r = await fetch(`${url(u.uid)}?updateMask.fieldPaths=avatar&updateMask.fieldPaths=avColor`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${await u.getIdToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { avatar: { stringValue: look.avatar || '' }, avColor: { stringValue: look.avColor || 'indigo' } } }),
    });
    if (!r.ok) throw new Error('avatar save failed');
    cache = { avatar: look.avatar || '', avColor: look.avColor || 'indigo' };
    window.dispatchEvent(new Event('avatar-changed'));
}

let cache: Look | null = null;

/** চালু অবতার (সব CourseAvatar এ দেখাতে): একবার এনে মনে রাখে, সেভ হলে সবখানে বদলে যায় */
export function useMyAvatar(): Look {
    const [look, setLook] = useState<Look>(cache || {});
    useEffect(() => {
        let live = true;
        const sync = () => { if (live && cache) setLook(cache); };
        const off = onAuthStateChanged(auth, (u) => {
            if (!u) { cache = null; if (live) setLook({}); return; }
            if (cache) return sync();
            void loadMyAvatar().then((l) => { cache = l; sync(); });
        });
        window.addEventListener('avatar-changed', sync);
        return () => { live = false; off(); window.removeEventListener('avatar-changed', sync); };
    }, []);
    return look;
}
