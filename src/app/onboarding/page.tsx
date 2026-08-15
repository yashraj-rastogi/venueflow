'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, ArrowRight, CheckCircle, Loader2, MapPin } from 'lucide-react';
import { signInWithGoogle } from '@/lib/firebase';
import { createOrganization, upsertStaffMember } from '@/lib/firestore';
import { useAuth } from '@/hooks/useAuth';

const VENUE_EXAMPLES = [
  'MetLife Stadium',
];

const STEPS = [
  { id: 'auth',  label: 'Sign in' },
  { id: 'org',   label: 'Your organization' },
  { id: 'venue', label: 'Add venue' },
  { id: 'done',  label: 'All set' },
] as const;
type Step = typeof STEPS[number]['id'];

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export default function OnboardingPage() {
  const router     = useRouter();
  const { user }   = useAuth();

  const [step,         setStep]         = useState<Step>(user ? 'org' : 'auth');
  const [orgName,      setOrgName]      = useState('');
  const [venueName,    setVenueName]    = useState('');
  const [venueCity,    setVenueCity]    = useState('');
  const [mapsUrl,      setMapsUrl]      = useState('');
  const [apiKey,       setApiKey]       = useState('');
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState('');
  const [createdOrgId, setCreatedOrgId] = useState('');

  const currentIdx = STEPS.findIndex(s => s.id === step);

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError('');
    try { await signInWithGoogle(); setStep('org'); }
    catch { setError('Google popup was closed or unavailable. You can also use 1-Click Demo Admin below.'); }
    finally { setLoading(false); }
  };

  const handleDemoAuth = async () => {
    setLoading(true);
    setError('');
    try {
      const { signInWithDemoAdmin } = await import('@/lib/firebase');
      await signInWithDemoAdmin();
      setStep('org');
    } catch {
      setError('Could not initialize demo session.');
    } finally {
      setLoading(false);
    }
  };

  const handleOrgSubmit = async () => {
    if (!orgName.trim()) { setError('Organization name is required'); return; }
    setLoading(true);
    setError('');
    try {
      const orgId = await createOrganization({
        name: orgName.trim(), slug: slugify(orgName),
        ownerEmail: user?.email ?? '', plan: 'starter',
      });
      if (user) {
        await upsertStaffMember(orgId, '_placeholder', {
          uid: user.uid, email: user.email ?? '', name: user.displayName ?? 'Owner',
          role: 'owner', venueId: '_placeholder', orgId, joinedAt: Date.now(), isOnDuty: false,
        });
      }
      setCreatedOrgId(orgId);
      setStep('venue');
    } catch (e) { setError('Failed to create organization: ' + String(e)); }
    finally { setLoading(false); }
  };

  const handleVenueImport = async () => {
    if (!venueName.trim()) { setError('Venue name is required'); return; }
    setLoading(true);
    setError('');
    try {
      const res  = await fetch('/api/venues/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body  : JSON.stringify({ orgId: createdOrgId, name: venueName, city: venueCity, mapsUrl, apiKey }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? 'Import failed');
      setStep('done');
      setTimeout(() => router.push(`/org/${createdOrgId}`), 2000);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <header style={{ padding: '0 1.5rem', height: 56, display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={14} color="#fff" />
          </div>
          <span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>VenueFlow</span>
        </div>
      </header>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem' }}>
        <div style={{ width: '100%', maxWidth: 460 }}>

          {/* ── Step progress ────────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '2.5rem' }}>
            {STEPS.map((s, i) => {
              const done    = i < currentIdx;
              const current = i === currentIdx;
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 'initial' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: done ? 'var(--brand)' : current ? 'var(--brand)' : 'var(--surface-2)',
                      border: `1px solid ${done || current ? 'var(--brand)' : 'var(--border-hi)'}`,
                      fontSize: '0.6875rem', fontWeight: 700,
                      color: done || current ? '#fff' : 'var(--text-4)',
                      transition: 'all 0.2s',
                    }}>
                      {done ? <CheckCircle size={13} /> : i + 1}
                    </div>
                    <span style={{ fontSize: '0.8125rem', fontWeight: current ? 600 : 400, color: current ? 'var(--text-1)' : done ? 'var(--text-3)' : 'var(--text-4)', whiteSpace: 'nowrap' }}>
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div style={{ flex: 1, height: 1, background: done ? 'var(--brand)' : 'var(--border)', margin: '0 0.75rem', transition: 'background 0.3s' }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Step content ─────────────────────────────────────────────── */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '1.75rem' }}>

            {/* STEP: Sign in */}
            {step === 'auth' && (
              <div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.375rem' }}>Create your account</h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-3)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                  Sign in to get started. No credit card required.
                </p>

                <button onClick={handleDemoAuth} disabled={loading} className="btn-glow" style={{
                  width: '100%', padding: '0.625rem 1rem', marginBottom: '0.75rem',
                  borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.625rem',
                  fontSize: '0.9375rem', fontWeight: 700,
                  opacity: loading ? 0.5 : 1,
                }}>
                  ⚡ 1-Click Demo Admin Sign-In
                </button>

                <button onClick={handleGoogleAuth} disabled={loading} style={{
                  width: '100%', padding: '0.625rem 1rem',
                  background: 'var(--surface-2)', border: '1px solid var(--border-hi)',
                  borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.625rem',
                  color: 'var(--text-1)', fontSize: '0.9375rem', fontWeight: 500,
                  opacity: loading ? 0.5 : 1,
                }}>
                  {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : (
                    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  )}
                  Continue with Google
                </button>
              </div>
            )}

            {/* STEP: Organization */}
            {step === 'org' && (
              <div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.375rem' }}>Name your organization</h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-3)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                  This is typically your team, company, or league name.
                </p>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-2)', marginBottom: '0.375rem' }}>
                    Organization name
                  </label>
                  <input
                    className="input-dark"
                    placeholder="e.g. New York Giants, Live Nation West"
                    value={orgName}
                    onChange={e => setOrgName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleOrgSubmit()}
                    autoFocus
                  />
                </div>
                <button onClick={handleOrgSubmit} disabled={loading || !orgName.trim()} className="btn-primary" style={{ width: '100%', justifyContent: 'center', opacity: !orgName.trim() ? 0.5 : 1 }}>
                  {loading ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <><span>Continue</span> <ArrowRight size={15} /></>}
                </button>
              </div>
            )}

            {/* STEP: Venue */}
            {step === 'venue' && (
              <div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.375rem' }}>Add your first venue</h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-3)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                  Enter your stadium name or paste a Google Maps location URL to extract real-world coordinates.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', marginBottom: '1.25rem' }}>
                  <div>
                    <label className="label-xs" style={{ display: 'block', marginBottom: '0.375rem' }}>Stadium name *</label>
                    <input className="input-dark" placeholder="e.g. Wembley Stadium or MetLife Stadium" value={venueName} onChange={e => setVenueName(e.target.value)} autoFocus />
                    {/* Quick-fill example */}
                    <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                      {VENUE_EXAMPLES.map(v => (
                        <button key={v} onClick={() => setVenueName(v)} style={{
                          fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: 6,
                          background: 'var(--surface-2)', border: '1px solid var(--border)',
                          color: 'var(--text-3)', cursor: 'pointer',
                        }}>{v} (Demo)</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="label-xs" style={{ display: 'block', marginBottom: '0.375rem' }}>City (optional)</label>
                    <input className="input-dark" placeholder="e.g. London, UK or East Rutherford, NJ" value={venueCity} onChange={e => setVenueCity(e.target.value)} />
                  </div>
                  <div>
                    <label className="label-xs" style={{ display: 'block', marginBottom: '0.375rem' }}>Google Maps Location URL (optional)</label>
                    <input className="input-dark" placeholder="https://www.google.com/maps/place/..." value={mapsUrl} onChange={e => setMapsUrl(e.target.value)} />
                  </div>
                  <div>
                    <label className="label-xs" style={{ display: 'block', marginBottom: '0.375rem' }}>Google Places API Key (optional override)</label>
                    <input className="input-dark" type="password" placeholder="AIzaSy..." value={apiKey} onChange={e => setApiKey(e.target.value)} />
                  </div>
                </div>

                <button onClick={handleVenueImport} disabled={loading || !venueName.trim()} className="btn-primary" style={{ width: '100%', justifyContent: 'center', opacity: !venueName.trim() ? 0.5 : 1 }}>
                  {loading ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <><MapPin size={15} /> Import real venue</>}
                </button>
              </div>
            )}

            {/* STEP: Done */}
            {step === 'done' && (
              <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--success-bg)', border: '1px solid var(--success-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                  <CheckCircle size={22} color="var(--success)" />
                </div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.375rem' }}>You're all set!</h2>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-3)', lineHeight: 1.6 }}>
                  Redirecting you to your dashboard…
                </p>
                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', marginTop: '1.25rem', color: 'var(--brand-light)' }} />
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{ marginTop: '1rem', padding: '0.625rem 0.875rem', borderRadius: 8, background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', fontSize: '0.8125rem', color: 'var(--danger)' }}>
                {error}
              </div>
            )}
          </div>

          <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.75rem', color: 'var(--text-4)' }}>
            No credit card · Setup takes ~2 minutes
          </p>
        </div>
      </div>
    </div>
  );
}
