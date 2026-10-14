import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  getDoc as originalGetDoc,
  getDocs as originalGetDocs,
  DocumentReference,
  Query,
  DocumentSnapshot,
  QuerySnapshot,
  DocumentData
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);

// 🔍 Browser Console Live Read Tracker
export const monitoredGetDoc = async <T = DocumentData>(ref: DocumentReference<T>): Promise<DocumentSnapshot<T>> => {
  const start = Date.now();
  const snap = await originalGetDoc(ref);
  const time = Date.now() - start;

  console.log(
    `🔥 [FIRESTORE READ: ${snap.exists() ? 1 : 0} Doc] ${new Date().toLocaleTimeString()} | Path: ${ref.path} | Time: ${time}ms`
  );
  return snap;
};

export const monitoredGetDocs = async <T = DocumentData>(q: Query<T>): Promise<QuerySnapshot<T>> => {
  const start = Date.now();
  const snap = await originalGetDocs(q);
  const time = Date.now() - start;

  console.log(
    `🔥 [FIRESTORE READ: ${snap.size} Docs] ${new Date().toLocaleTimeString()} | Read Count: ${snap.size} | Time: ${time}ms`
  );
  return snap;
};