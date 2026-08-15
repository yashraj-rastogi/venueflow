import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
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

// Initialize Firebase App Check client-side if reCAPTCHA key is provided
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) {
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (appCheckErr) {
    console.warn('[Firebase] App Check init failed:', appCheckErr);
  }
}

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();

export { app, auth, db, googleProvider };

// ─── Demo User Object Factory ──────────────────────────────────────────────────

export const DEMO_ADMIN_USER: User = {
  uid: 'admin-demo-user-101',
  email: 'admin@venueflow.io',
  displayName: 'Admin (Yashraj Rastogi)',
  emailVerified: true,
  isAnonymous: false,
  phoneNumber: null,
  photoURL: null,
  providerId: 'google.com',
  tenantId: null,
  metadata: {
    creationTime: new Date().toISOString(),
    lastSignInTime: new Date().toISOString(),
  },
  providerData: [],
  refreshToken: '',
  delete: async () => {},
  getIdToken: async () => 'demo-token-xyz',
  getIdTokenResult: async () => ({
    token: 'demo-token-xyz',
    authTime: new Date().toISOString(),
    issuedAtTime: new Date().toISOString(),
    expirationTime: new Date(Date.now() + 3600000).toISOString(),
    signInProvider: 'google.com',
    signInSecondFactor: null,
    claims: { admin: true },
  }),
  reload: async () => {},
  toJSON: () => ({}),
};

// Listeners for custom demo auth state updates
const demoAuthListeners = new Set<(user: User | null) => void>();

function notifyDemoAuth(u: User | null) {
  demoAuthListeners.forEach(fn => fn(u));
}

// ─── Auth helpers ──────────────────────────────────────────────────────────────

export const signInWithGoogle = async () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('vf_demo_auth');
  }
  return signInWithPopup(auth, googleProvider);
};

export const continueAsGuest = async () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('vf_demo_auth');
  }
  try {
    return await signInAnonymously(auth);
  } catch {
    // If anonymous auth is disabled in Firebase console, provide a fallback guest user
    const guestUser: User = {
      ...DEMO_ADMIN_USER,
      uid: `guest-${Date.now()}`,
      email: null,
      displayName: 'Guest Attendee',
      isAnonymous: true,
    };
    if (typeof window !== 'undefined') {
      localStorage.setItem('vf_demo_auth', JSON.stringify(guestUser));
    }
    notifyDemoAuth(guestUser);
    return { user: guestUser };
  }
};

export const signInWithDemoAdmin = async () => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('vf_demo_auth', JSON.stringify(DEMO_ADMIN_USER));
  }
  notifyDemoAuth(DEMO_ADMIN_USER);
  return DEMO_ADMIN_USER;
};

export const signOut = async () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('vf_demo_auth');
  }
  notifyDemoAuth(null);
  return firebaseSignOut(auth).catch(() => {});
};

export function onAuthChange(callback: (user: User | null) => void) {
  demoAuthListeners.add(callback);

  // Check demo auth in localStorage
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('vf_demo_auth');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        callback({ ...DEMO_ADMIN_USER, ...parsed });
      } catch {}
    }
  }

  const unsub = onAuthStateChanged(auth, (u) => {
    if (u) {
      if (typeof window !== 'undefined') localStorage.removeItem('vf_demo_auth');
      callback(u);
    } else {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('vf_demo_auth') : null;
      if (saved) {
        try {
          callback({ ...DEMO_ADMIN_USER, ...JSON.parse(saved) });
          return;
        } catch {}
      }
      callback(null);
    }
  });

  return () => {
    demoAuthListeners.delete(callback);
    unsub();
  };
}

// ─── Database helpers ──────────────────────────────────────────────────────────

export function listenToPath<T>(path: string, callback: (data: T | null) => void): () => void {
  const dbRef = ref(db, path);
  onValue(dbRef, (snapshot) => {
    callback(snapshot.exists() ? (snapshot.val() as T) : null);
  }, (err) => {
    console.warn(`[RTDB listenToPath] Error at ${path}:`, err);
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
