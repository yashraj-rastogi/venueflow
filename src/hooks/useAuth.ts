'use client';
import { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  onAuthChange,
  signInWithGoogle,
  signOut as fbSignOut,
  continueAsGuest,
  signInWithDemoAdmin,
} from '@/lib/firebase';

export interface AuthState {
  user: User | null;
  isAdmin: boolean;
  isGuest: boolean;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  loginAsGuest: () => Promise<void>;
  loginAsDemoAdmin: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthChange(async (u) => {
      setUser(u);
      if (u) {
        // Check for admin custom claim or demo admin
        if (u.uid === 'admin-demo-user-101' || u.email?.includes('admin')) {
          setIsAdmin(true);
        } else {
          const token = await u.getIdTokenResult().catch(() => null);
          setIsAdmin(token?.claims?.admin === true);
        }
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const signIn = useCallback(async () => {
    await signInWithGoogle();
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut();
    setUser(null);
    setIsAdmin(false);
  }, []);

  const loginAsGuest = useCallback(async () => {
    await continueAsGuest();
  }, []);

  const loginAsDemoAdmin = useCallback(async () => {
    await signInWithDemoAdmin();
  }, []);

  const isGuest = user?.isAnonymous ?? false;

  return { user, isAdmin, isGuest, loading, signIn, signOut, loginAsGuest, loginAsDemoAdmin };
}
