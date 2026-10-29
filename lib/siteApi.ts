import { authFetch } from '@/lib/authFetch';

// ব্রাউজার থেকে ছাত্রের ডাটা (আগে সরাসরি Firestore, এখন সার্ভারের API দিয়ে Turso)।
// ফেরত আসা আকার Firestore এর আগের doc এর মতোই, তাই পেজগুলোর হিসাব আগের মতো চলে।

export type MyProfile = {
    uid: string;
    email: string;
    name: string;
    displayName: string;
    role: string;
    totalAttempted: number;
    totalCorrect: number;
    totalScore: number;
    totalStudySeconds: number;
    currentStreak: number;
    bookmarks: string[];
    mistakeCount: number;
    completed_exams: string[];
};
export type MistakeItems = Record<string, { id: string; userAnswer: string; timestamp: number }>;

async function getJSON<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await authFetch(url, init);
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);
    return data as T;
}

export const getMe = async () => (await getJSON<{ user: MyProfile }>('/api/me')).user;

export const getProgress = () =>
    getJSON<{ subjects: Record<string, { subject: string; totalAttempted: number; correctAnswers: number }>;
              chapters: Record<string, { subject: string; chapter: string; totalAttempted: number; correctAnswers: number }> }>('/api/me/progress');

export const getMistakes = async () => (await getJSON<{ items: MistakeItems }>('/api/me/mistakes')).items;

export const removeMistakes = (ids: string[]) =>
    getJSON('/api/me/mistakes', { method: 'DELETE', body: JSON.stringify({ ids }) });

export const getSolved = async (subject: string) =>
    (await getJSON<{ ids: string[] }>(`/api/me/solved?subject=${encodeURIComponent(subject)}`)).ids;

export const setBookmark = (id: string, on: boolean) =>
    getJSON('/api/me/bookmarks', { method: 'POST', body: JSON.stringify({ id, on }) });

/** qbank এর উত্তরের ব্যাচ। keepalive: পেজ বন্ধ হওয়ার মুহূর্তেও পাঠানো যায়। */
export const syncAnswers = (queue: unknown) =>
    getJSON('/api/me/sync', { method: 'POST', body: JSON.stringify(queue), keepalive: true });

export const getExamResults = async () =>
    (await getJSON<{ results: Record<string, { score: number; totalMarks: number; correct: number; wrong: number; submittedAt: number }> }>('/api/me/exams')).results;

export const getExamResult = async (testId: string) =>
    (await getJSON<{ result: { answers?: Record<string, string> } | null }>(`/api/me/exams?testId=${encodeURIComponent(testId)}`)).result;

export const submitExam = (testId: string, answers: Record<string, string>, retake: boolean) =>
    getJSON('/api/me/exams', { method: 'POST', body: JSON.stringify({ testId, answers, retake }) });

export const reportQuestion = (questionId: string, reason: string) =>
    getJSON('/api/me/report', { method: 'POST', body: JSON.stringify({ questionId, reason }) });

export const getLeaderboard = () =>
    getJSON<{ rows: { id: string; name: string; score: number }[]; me: { id: string; name: string; score: number; rank: number } | null }>('/api/leaderboard');

// মডেল টেস্ট সবার জন্য খোলা (লগইন লাগে না)
export async function listModelTests(limit = 50): Promise<Record<string, any>[]> {
    const data = await (await fetch(`/api/model-tests?limit=${limit}`)).json();
    return data.success ? data.tests : [];
}

export async function getModelTest(id: string): Promise<Record<string, any> | null> {
    const res = await fetch(`/api/model-tests/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.success ? data.test : null;
}

export const saveModelTest = (id: string, test: Record<string, unknown>) =>
    getJSON('/api/admin/model-tests', { method: 'POST', body: JSON.stringify({ id, test }) });
