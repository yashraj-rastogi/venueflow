'use client';
import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Activity, Shield, Mail, UserCheck, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams?.get('redirect') ?? '/';
  const { user, isGuest, loading, signIn, loginAsGuest } = useAuth();

  const [authLoading, setAuthLoading] = useState<'google' | 'guest' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user && !isGuest) {
      router.replace(redirect);
    }
  }, [user, isGuest, loading, router, redirect]);

  const handleGoogle = async () => {
    setAuthLoading('google');
    setError(null);
    try {
      await signIn();
      router.replace(redirect);
    } catch {
      setError('Sign-in failed. Make sure pop-ups are allowed and try again.');
    }
    setAuthLoading(null);
  };

  const handleGuest = async () => {
    setAuthLoading('guest');
    setError(null);
    try {
      await loginAsGuest();
      router.replace('/');
    } catch {
      setError('Could not continue as guest. Please try again.');
    }
    setAuthLoading(null);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={28} color="var(--blue-soft)" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(59,130,246,0.12) 0%, transparent 70%)' }} />
      <div className="bg-grid" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, opacity: 0.4 }} />

      <div className="anim-fade-up" style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 440 }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: '0 auto 1rem',
            background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 32px rgba(59,130,246,0.5), 0 0 0 1px rgba(59,130,246,0.3)',
          }}>
            <Activity size={24} color="#fff" />
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.03em', marginBottom: '0.375rem' }}>
            Venue<span style={{ color: 'var(--blue-soft)' }}>Flow</span>
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-3)' }}>Real-time crowd intelligence platform</p>
        </div>

        <div className="card-hi" style={{ padding: '2rem' }}>
          {redirect !== '/' && (
            <div style={{
              marginBottom: '1.5rem', padding: '0.75rem 1rem',
              background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: 10, display: 'flex', alignItems: 'center', gap: '0.625rem',
            }}>
              <Shield size={14} color="var(--indigo)" />
              <span style={{ fontSize: '0.8rem', color: 'var(--indigo)', fontWeight: 500 }}>
                Sign in required to access <strong>{redirect}</strong>
              </span>
            </div>
          )}

          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-1)', marginBottom: '0.375rem' }}>Welcome back</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-3)', marginBottom: '1.75rem' }}>
            Sign in to access the VenueFlow dashboard and live crowd data.
          </p>

          <button
            id="btn-google-signin"
            onClick={handleGoogle}
            disabled={authLoading !== null}
            style={{
              width: '100%', padding: '0.875rem 1.25rem',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12, cursor: authLoading !== null ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
              color: 'var(--text-1)', fontSize: '0.9375rem', fontWeight: 600,
              transition: 'all 0.2s',
              opacity: authLoading !== null ? 0.6 : 1,
              marginBottom: '0.875rem',
            }}
            onMouseEnter={e => { if (!authLoading) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'; }}
          >
            {authLoading === 'google' ? (
              <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            Continue with Google
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.875rem' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-4)' }}>or</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          <button
            id="btn-guest-signin"
            onClick={handleGuest}
            disabled={authLoading !== null}
            className="btn-ghost"
            style={{
              width: '100%', padding: '0.75rem 1.25rem',
              justifyContent: 'center',
              opacity: authLoading !== null ? 0.6 : 1,
              cursor: authLoading !== null ? 'not-allowed' : 'pointer',
            }}
          >
            {authLoading === 'guest' ? (
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <UserCheck size={16} />
            )}
            Continue as Guest
          </button>

          {error && (
            <div style={{
              marginTop: '1rem', padding: '0.75rem', borderRadius: 10,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
              fontSize: '0.8125rem', color: 'var(--red)', textAlign: 'center',
            }}>
              {error}
            </div>
          )}

          <p style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: 'var(--text-4)', textAlign: 'center', lineHeight: 1.6 }}>
            <Mail size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Admin access is granted by your organization. Contact your event manager if you need elevated permissions.
          </p>
        </div>

        <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.75rem', color: 'var(--text-4)' }}>
          VenueFlow Mission Control · Real-time crowd intelligence
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={28} color="var(--blue-soft)" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
