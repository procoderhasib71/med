import { auth } from '@/lib/firebase';

/** Logged-in user er Firebase ID token diye fetch (admin API r jonno). */
export async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
    const token = await auth.currentUser?.getIdToken();
    const headers = new Headers(init.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    return fetch(url, { ...init, headers });
}
