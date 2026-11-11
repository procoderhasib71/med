import { getFirestore } from 'firebase-admin/firestore';
import { getApps } from 'firebase-admin/app';
import { adminAuth } from '@/lib/firebaseAdmin';
import { turso } from '@/lib/turso';

// অ্যাকাউন্ট পুরো মোছা (Google Play এর নিয়ম): AdMCQ, Pomodoro আর Money একই অ্যাকাউন্ট, তাই সব জায়গা থেকে মুছি।
//
// Turso (AdMCQ + বট):  site_* টেবিলে এই uid এর সব; বটের সাথে জোড়া (hermes_site_links) আর
//                     অ্যাপ থেকে রাখা বটের রিমাইন্ডার/টাইমার। Telegram বটের নিজের অ্যাকাউন্ট (hermes_users) আলাদা
//                     সেবা, সেটা থাকে; শুধু এই অ্যাকাউন্টের সাথে জোড়াটা ভাঙে।
// Firestore (Money + Pomodoro): users/{uid} আর তার ভেতরের সব, লিডারবোর্ডের ঘর, গ্রুপ চ্যাটে নিজের মেসেজ।
// Firebase Auth:      শেষে লগইনটাই মুছে দিই।
//
// প্রতিটা ধাপ আবার চালালেও ক্ষতি নেই (যা নেই তা মোছার চেষ্টা করলে কিছু হয় না), তাই মাঝপথে ভাঙলে আবার চেষ্টা করা যায়।

const db = () => getFirestore(getApps()[0]);

/** Turso: এই uid এর সব সারি; রিপোর্ট করা প্রশ্নগুলো থাকে কিন্তু কে করেছে সেটা মুছে যায় */
async function deleteTurso(uid: string) {
    // কোনো টেবিল এখনো তৈরি না হলে (যেমন নতুন ফিচারের টেবিল) সেটা বাদ দিই; নইলে পুরো batch ব্যর্থ হয়
    const tables = await turso.execute("SELECT name FROM sqlite_master WHERE type = 'table'");
    const exists = new Set(tables.rows.map((r) => String(r.name)));

    const masterIds = exists.has('hermes_site_links')
        ? (await turso.execute({ sql: 'SELECT DISTINCT master_id FROM hermes_site_links WHERE site_uid = ?', args: [uid] })).rows.map((r) => String(r.master_id))
        : [];

    const perUid = ['site_solved', 'site_mistakes', 'site_bookmarks', 'site_progress', 'site_progress_v2', 'site_exam_results',
        'site_link_codes', 'site_enrollments', 'site_scores'];
    const stmts: { sql: string; args: (string | number | null)[] }[] = [
        ...perUid.map((t) => ({ sql: `DELETE FROM ${t} WHERE uid = ?`, args: [uid] })),
        { sql: 'DELETE FROM site_users WHERE uid = ?', args: [uid] },
        { sql: 'UPDATE site_reports SET reported_by = NULL, email = NULL, name = NULL WHERE reported_by = ?', args: [uid] },
        { sql: "DELETE FROM site_firestore_backup WHERE path = ? OR path LIKE ?", args: [`users/${uid}`, `users/${uid}/%`] },
        { sql: 'DELETE FROM pomodoro_timers WHERE site_uid = ?', args: [uid] },
        { sql: 'DELETE FROM pomodoro_bot_sessions WHERE site_uid = ?', args: [uid] },
        // Pomodoro অ্যাপ থেকে বটে রাখা রিমাইন্ডার আর টাইমারের বার্তা (বটে নিজে লেখা রিমাইন্ডার থাকে)
        ...masterIds.map((mid) => ({ sql: "DELETE FROM hermes_reminders WHERE master_id = ? AND style IN ('pomotask', 'pomodoro', 'pomobot')", args: [mid] })),
        { sql: 'DELETE FROM hermes_site_links WHERE site_uid = ?', args: [uid] },
    ];
    const tableOf = (sql: string) => /^(?:DELETE FROM|UPDATE)\s+(\w+)/i.exec(sql)?.[1] || '';
    await turso.batch(stmts.filter((s) => exists.has(tableOf(s.sql))), 'write');
}

/** Firestore: Money আর Pomodoro এর সব হিসাব, লিডারবোর্ড, গ্রুপ চ্যাটে নিজের মেসেজ */
async function deleteFirestore(uid: string) {
    const fs = db();
    await fs.recursiveDelete(fs.doc(`users/${uid}`));

    // লিডারবোর্ড: leaderboards/{সপ্তাহ বা all}/users/{uid}
    const boards = await fs.collection('leaderboards').listDocuments();
    await Promise.all(boards.map((b) => b.collection('users').doc(uid).delete()));

    // গ্রুপ চ্যাট: groups/{group}/messages এ নিজের পাঠানো মেসেজ
    const groups = await fs.collection('groups').listDocuments();
    for (const g of groups) {
        const mine = await g.collection('messages').where('uid', '==', uid).get();
        for (let i = 0; i < mine.docs.length; i += 400) {
            const batch = fs.batch();
            mine.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
            await batch.commit();
        }
    }
}

export type DeleteResult = { authDeleted: boolean };

/** সব মোছে; Firebase Auth এর লগইন মুছতে না পারলে authDeleted = false (তখন অ্যাপ নিজেই user.delete() করে) */
export async function deleteAccount(uid: string): Promise<DeleteResult> {
    await deleteTurso(uid);
    await deleteFirestore(uid);
    try {
        await adminAuth.deleteUser(uid);
        return { authDeleted: true };
    } catch (e) {
        const code = (e as { code?: string })?.code || '';
        if (code === 'auth/user-not-found') return { authDeleted: true };
        console.error('deleteUser failed', code, e);
        return { authDeleted: false };
    }
}
