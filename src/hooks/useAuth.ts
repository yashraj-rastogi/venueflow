'use client';
import { useState, useEffect, useCallback } from 'react';
import { User } from 'firebase/auth';
import { onAuthChange, signInWithGoogle, signOut as fbSignOut, continueAsGuest } from '@/lib/firebase';

export interface AuthState {
  user: User | null;
  isAdmin: boolean;
  isGuest: boolean;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  loginAsGuest: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthChange(async (u) => {
      setUser(u);
      if (u) {
        // Check for admin custom claim
        const token = await u.getIdTokenResult().catch(() => null);
        setIsAdmin(token?.claims?.admin === true);
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const signIn = useCallback(async () => {
    try { await signInWithGoogle(); } catch {}
  }, []);

  const signOut = useCallback(async () => {
    try { await fbSignOut(); } catch {}
  }, []);

  const loginAsGuest = useCallback(async () => {
    try { await continueAsGuest(); } catch {}
  }, []);

  const isGuest = user?.isAnonymous ?? false;

  return { user, isAdmin, isGuest, loading, signIn, signOut, loginAsGuest };
}
