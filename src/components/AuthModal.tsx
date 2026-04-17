'use client';
import { useState, useEffect } from 'react';
import { Activity, Chrome, UserCircle2, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function AuthModal() {
  const { user, loading, signIn, loginAsGuest } = useAuth();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    // Show modal only if no session has been established and user hasn't dismissed
    const dismissed = sessionStorage.getItem('auth_dismissed');
    if (!user && !dismissed) {
      // Small delay so page renders first
      const t = setTimeout(() => setShow(true), 800);
      return () => clearTimeout(t);
    }
  }, [user, loading]);

  if (!show || user) return null;

  const dismiss = () => {
    sessionStorage.setItem('auth_dismissed', '1');
    setShow(false);
  };

  const handleGoogle = async () => {
    setBusy(true);
    await signIn();
    setBusy(false);
    setShow(false);
  };

  const handleGuest = async () => {
    setBusy(true);
    await loginAsGuest();
    sessionStorage.setItem('auth_dismissed', '1');
    setBusy(false);
    setShow(false);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(4,7,18,0.75)', backdropFilter: 'blur(8px)', zIndex: 200 }}
        onClick={dismiss}
      />
      {/* Modal */}
      <div className="anim-fade-up" style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 201, width: 400, padding: '2rem',
        background: 'var(--bg-2)', border: '1px solid var(--border)',
        borderRadius: 20, boxShadow: '0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(59,130,246,0.1)',
      }}>
        <button onClick={dismiss} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-4)', cursor: 'pointer' }}>
          <X size={16} />
        </button>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg, #3b82f6, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', boxShadow: '0 0 24px rgba(59,130,246,0.4)' }}>
            <Activity size={24} color="#fff" />
          </div>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>Welcome to VenueFlow</h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)', marginTop: 6, lineHeight: 1.55 }}>Real-time crowd intelligence for every event. Sign in for a personalized experience or continue as a guest.</p>
        </div>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button
            onClick={handleGoogle}
            disabled={busy}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.625rem',
              padding: '0.875rem 1.25rem', borderRadius: 12,
              background: '#fff', color: '#1a1a2e',
              border: 'none', fontWeight: 700, fontSize: '0.9rem',
              cursor: 'pointer', width: '100%',
              boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
              opacity: busy ? 0.7 : 1, transition: 'all 0.2s',
            }}
          >
            <Chrome size={18} color="#4285F4" />
            Continue with Google
          </button>

          <button
            onClick={handleGuest}
            disabled={busy}
            className="btn-ghost"
            style={{ width: '100%', justifyContent: 'center', padding: '0.875rem', borderRadius: 12, gap: '0.5rem', fontSize: '0.875rem', opacity: busy ? 0.7 : 1 }}
          >
            <UserCircle2 size={16} />
            Continue as Guest
          </button>
        </div>

        <p style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-4)', marginTop: '1.25rem', lineHeight: 1.6 }}>
          No personal location data is collected. All crowd data is aggregated and anonymous.
        </p>
      </div>
    </>
  );
}
