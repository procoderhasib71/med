import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// শুধু লগইনের টোকেন যাচাই (verifyIdToken), এর জন্য projectId ই যথেষ্ট, কোনো service account key লাগে না।
// সব ডাটা Turso তে, Firestore আর ব্যবহার হয় না।
const adminApp = getApps()[0] ?? initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });

export const adminAuth = getAuth(adminApp);
