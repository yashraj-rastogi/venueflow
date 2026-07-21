'use client';
import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Activity, Loader2, Shield, UserCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const redirect     = searchParams?.get('redirect') ?? '/';
  const { user, isGuest, loading, signIn, loginAsGuest } = useAuth();

  const [authLoading, setAuthLoading] = useState<'google' | 'guest' | null>(null);
  const [error,       setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user && !isGuest) router.replace(redirect);
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
        <Loader2 size={22} color="var(--brand-light)" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div className="anim-fade-up" style={{ width: '100%', maxWidth: 380 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ width: 44, height: 44, borderRadius: 11, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <Activity size={20} color="#fff" />
          </div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-1)', marginBottom: '0.25rem' }}>VenueFlow</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-3)' }}>Sign in to your account</p>
        </div>

        {/* Card */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '1.5rem' }}>

          {/* Protected route notice */}
          {redirect !== '/' && (
            <div style={{ marginBottom: '1.25rem', padding: '0.625rem 0.875rem', background: 'var(--brand-bg)', border: '1px solid rgba(37,99,235,0.25)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Shield size={13} color="var(--brand-text)" />
              <span style={{ fontSize: '0.8125rem', color: 'var(--brand-text)' }}>Sign in to access this page</span>
            </div>
          )}

          {/* Google button */}
          <button
            id="btn-google-signin"
            onClick={handleGoogle}
            disabled={authLoading !== null}
            style={{
              width: '100%', padding: '0.625rem 1rem', marginBottom: '0.75rem',
              background: 'var(--surface-2)', border: '1px solid var(--border-hi)',
              borderRadius: 8, cursor: authLoading !== null ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.625rem',
              color: 'var(--text-1)', fontSize: '0.9375rem', fontWeight: 500,
              transition: 'background var(--t-fast), border-color var(--t-fast)',
              opacity: authLoading !== null ? 0.5 : 1,
            }}
            onMouseEnter={e => { if (!authLoading) { (e.currentTarget as HTMLButtonElement).style.background = '#222225'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-hi)'; } }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-hi)'; }}
          >
            {authLoading === 'google' ? (
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            Continue with Google
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-4)' }}>or</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>

          {/* Guest button */}
          <button
            id="btn-guest-signin"
            onClick={handleGuest}
            disabled={authLoading !== null}
            className="btn-ghost"
            style={{ width: '100%', justifyContent: 'center', opacity: authLoading !== null ? 0.5 : 1, cursor: authLoading !== null ? 'not-allowed' : 'pointer' }}
          >
            {authLoading === 'guest'
              ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
              : <UserCheck size={15} />
            }
            Continue as Guest
          </button>

          {/* Error */}
          {error && (
            <div style={{ marginTop: '1rem', padding: '0.625rem 0.875rem', borderRadius: 8, background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', fontSize: '0.8125rem', color: 'var(--danger)', textAlign: 'center' }}>
              {error}
            </div>
          )}
        </div>

        {/* Trust signals */}
        <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          {['No credit card', '2-min setup', 'Cancel anytime'].map(t => (
            <span key={t} style={{ fontSize: '0.75rem', color: 'var(--text-4)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ color: 'var(--success)', fontSize: '0.625rem' }}>✓</span> {t}
            </span>
          ))}
        </div>

        <p style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-4)' }}>
          Admin access is granted by your organization owner.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={22} color="var(--brand-light)" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
