'use client';
/**
 * /checkin/[venueId] — QR Code Landing Page
 *
 * Opened automatically when a guest scans the venue entrance QR code.
 * Extracts zone/section/seat from URL query params embedded in the QR payload.
 * Shows a quick animated welcome, then redirects to the Guest PWA.
 *
 * IMPORTANT: useSearchParams() requires a Suspense boundary in Next.js 15.
 * The inner component (CheckInContent) is wrapped by the default export.
 */
import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Activity, CheckCircle, Loader2, MapPin } from 'lucide-react';

const GREETINGS: Record<string, string> = {
  en: "You're checked in!",
  es: '¡Bienvenido/a!',
  pt: 'Bem-vindo(a)!',
  fr: 'Bienvenue!',
  hi: 'स्वागत है!',
  ar: '!أهلاً بكم',
};

const AMENITY_ICONS: Record<string, string> = {
  restroom: '🚻', concession: '🍕', merchandise: '👕', gate: '🚪', elevator: '🛗',
};

/* ── Spinner shown while Suspense resolves ───────────────────────────────── */
function LoadingShell() {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Activity size={16} color="#fff" />
        </div>
        <span style={{ fontWeight: 700, fontSize: '1rem' }}>VenueFlow</span>
      </div>
      <Loader2 size={24} color="var(--brand-light)" style={{ animation: 'spin 1s linear infinite' }} />
      <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>Checking you in…</p>
    </div>
  );
}

/* ── Inner component (safe to call useSearchParams here) ─────────────────── */
function CheckInContent() {
  const { venueId }  = useParams<{ venueId: string }>();
  const searchParams = useSearchParams();   // ← requires Suspense ancestor
  const router       = useRouter();

  const zoneId  = searchParams.get('z')    ?? undefined;
  const section = searchParams.get('s')    ?? undefined;
  const seat    = searchParams.get('seat') ?? undefined;
  const lang    = searchParams.get('lang') ?? 'en';

  const [status,    setStatus]    = useState<'checking' | 'done' | 'error'>('checking');
  const [venueName, setVenueName] = useState('');
  const [zoneName,  setZoneName]  = useState('');
  const [amenities, setAmenities] = useState<{ name: string; waitTime: number; type: string }[]>([]);

  useEffect(() => {
    if (!venueId) return;
    fetch('/api/checkin', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ venueId, zoneId, section, seat, language: lang }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setVenueName(data.venue?.name ?? venueId);
          setZoneName(data.zone?.name ?? '');
          setAmenities(data.nearestAmenities ?? []);
          setStatus('done');
          setTimeout(() => {
            router.replace(`/g/${venueId}?session=${data.sessionId}&zone=${zoneId ?? ''}&lang=${lang}`);
          }, 2500);
        } else {
          setStatus('error');
        }
      })
      .catch(() => setStatus('error'));
  }, [venueId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      minHeight     : '100dvh',
      background    : 'var(--bg)',
      display       : 'flex',
      flexDirection : 'column',
      alignItems    : 'center',
      justifyContent: 'center',
      padding       : '2rem 1.5rem',
      textAlign     : 'center',
      maxWidth      : 400,
      margin        : '0 auto',
      color         : 'var(--text-1)',
    }}>

      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2.5rem' }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Activity size={16} color="#fff" />
        </div>
        <span style={{ fontWeight: 700, fontSize: '1rem' }}>VenueFlow</span>
      </div>

      {/* Checking */}
      {status === 'checking' && (
        <>
          <Loader2 size={40} color="var(--brand-light)" style={{ animation: 'spin 1s linear infinite', marginBottom: '1.25rem' }} />
          <p style={{ color: 'var(--text-3)', fontSize: '0.9375rem' }}>Checking you in…</p>
        </>
      )}

      {/* Done */}
      {status === 'done' && (
        <div className="anim-fade-up">
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'var(--success-bg)', border: '1px solid var(--success-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.5rem',
          }}>
            <CheckCircle size={32} color="var(--success)" />
          </div>

          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '0.5rem' }}>
            {GREETINGS[lang] ?? GREETINGS.en}
          </h1>
          <p style={{ color: 'var(--text-3)', fontSize: '0.9375rem', marginBottom: '1.5rem' }}>
            Welcome to <strong style={{ color: 'var(--text-1)' }}>{venueName}</strong>
            {zoneName && (
              <><br /><span style={{ color: 'var(--text-4)', fontSize: '0.8125rem' }}>
                <MapPin size={11} style={{ display: 'inline', marginRight: 3 }} />{zoneName}
              </span></>
            )}
          </p>

          {/* Nearest amenities */}
          {amenities.length > 0 && (
            <div style={{ width: '100%', marginBottom: '1.5rem' }}>
              <p className="label-xs" style={{ marginBottom: '0.625rem' }}>Nearest amenities</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {amenities.slice(0, 4).map(a => (
                  <div key={a.name} style={{
                    background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9,
                    padding: '0.625rem 0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-2)' }}>
                      {AMENITY_ICONS[a.type] ?? '📍'} {a.name}
                    </span>
                    <span style={{
                      fontSize: '0.875rem', fontWeight: 700,
                      color: a.waitTime > 8 ? 'var(--danger)' : a.waitTime > 4 ? 'var(--warning)' : 'var(--success)',
                    }}>
                      {a.waitTime === 0 ? 'No wait' : `${a.waitTime}m`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-4)', fontSize: '0.8125rem' }}>
            <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
            Opening your venue guide…
          </div>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
            <span style={{ fontSize: '1.5rem' }}>⚠️</span>
          </div>
          <p style={{ color: 'var(--danger)', fontSize: '0.9375rem', marginBottom: '1.25rem', lineHeight: 1.5 }}>
            Unable to check in. Please try scanning the QR code again.
          </p>
          <button onClick={() => window.location.reload()} className="btn-ghost" style={{ width: '100%', justifyContent: 'center' }}>
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Default export — wraps with Suspense (required by Next.js 15) ────────── */
export default function CheckInPage() {
  return (
    <Suspense fallback={<LoadingShell />}>
      <CheckInContent />
    </Suspense>
  );
}
