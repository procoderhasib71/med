import { onAuthStateChanged as fbOnAuthStateChanged, signOut as fbSignOut } from 'firebase/auth';
import { auth as firebaseAuth } from '@/lib/firebase';

// লগইন দুই রকম: (১) admcq.com এ লগইন করলে .admcq.com এর session cookie, চার subdomain এ একসাথে;
// (২) এই সাইটেই Firebase লগইন (localhost বা *.hosted.app এ পরীক্ষার জন্য)।
// পেজগুলো firebase/auth এর বদলে এখান থেকে onAuthStateChanged আর `auth` নেয়, তাই দুটোই একভাবে চলে।

export type SessionUser = { uid: string; email: string | null; displayName: string | null; name?: string };

export const session: { currentUser: SessionUser | null } = { currentUser: null };

let cookieCheck: Promise<SessionUser | null> | null = null;
function cookieUser(): Promise<SessionUser | null> {
    cookieCheck ||= fetch('/api/session', { cache: 'no-store' })
        .then((r) => r.json())
        .then((d) => (d.success && d.user ? { uid: d.user.uid, email: d.user.email || null, displayName: d.user.name || null, name: d.user.name } : null))
        .catch(() => null);
    return cookieCheck;
}

export function onAuthStateChanged(_auth: unknown, cb: (user: SessionUser | null) => void): () => void {
    let alive = true;
    const unsub = fbOnAuthStateChanged(firebaseAuth, async (fbUser) => {
        const user: SessionUser | null = fbUser
            ? { uid: fbUser.uid, email: fbUser.email, displayName: fbUser.displayName }
            : await cookieUser();
        if (!alive) return;
        session.currentUser = user;
        cb(user);
    });
    return () => { alive = false; unsub(); };
}

export async function signOut(_auth?: unknown) {
    session.currentUser = null;
    cookieCheck = null;
    await Promise.allSettled([fbSignOut(firebaseAuth), fetch('/api/session', { method: 'DELETE' })]);
}
