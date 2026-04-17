import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged, User, signInAnonymously } from 'firebase/auth';
import { getDatabase, ref, onValue, set, push, off, DatabaseReference } from 'firebase/database';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
};

// Initialize Firebase (singleton)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();

export { app, auth, db, googleProvider };

// ─── Auth helpers ──────────────────────────────────────────────────────────────

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const continueAsGuest = () => signInAnonymously(auth);
export const signOut = () => firebaseSignOut(auth);

export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

// ─── Database helpers ──────────────────────────────────────────────────────────

export function listenToPath<T>(path: string, callback: (data: T | null) => void): () => void {
  const dbRef = ref(db, path);
  onValue(dbRef, (snapshot) => {
    callback(snapshot.exists() ? (snapshot.val() as T) : null);
  });
  return () => off(dbRef);
}

export function writePath(path: string, data: unknown) {
  return set(ref(db, path), data);
}

export function pushToPath(path: string, data: unknown) {
  return push(ref(db, path), data);
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function initAnalytics() {
  if (typeof window !== 'undefined' && (await isSupported())) {
    getAnalytics(app);
  }
}
