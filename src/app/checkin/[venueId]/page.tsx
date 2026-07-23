'use client';
/**
 * /checkin/[venueId] — QR Code Entry & Event Join Landing Page
 *
 * Scanned at venue entrance or section gates.
 * Link format: /checkin/metlife-stadium?event=evt-123&z=zone-n&s=Section%20101
 */
import { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Activity, ArrowRight, CheckCircle, Compass, Loader2, MapPin, Sparkles, Ticket } from 'lucide-react';
import GuestTutorial from '@/components/GuestTutorial';

const GREETINGS: Record<string, string> = {
  en: "You're checked in!",
  es: '¡Bienvenido/a!',
  pt: 'Bem-vindo(a)!',
  fr: 'Bienvenue!',
  hi: 'स्वागत है!',
  ar: '!أهلاً بكم',
};

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
      <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>Verifying your venue entrance…</p>
    </div>
  );
}

function CheckInContent() {
  const { venueId }  = useParams<{ venueId: string }>();
  const searchParams = useSearchParams();
  const router       = useRouter();

  const eventId = searchParams?.get('event') ?? undefined;
  const zoneId  = searchParams?.get('z')     ?? undefined;
  const section = searchParams?.get('s')     ?? undefined;
  const seat    = searchParams?.get('seat')  ?? undefined;
  const lang    = searchParams?.get('lang')  ?? 'en';

  const [status,       setStatus]       = useState<'checking' | 'done' | 'error'>('checking');
  const [venueName,    setVenueName]    = useState('');
  const [zoneName,     setZoneName]     = useState('');
  const [eventName,    setEventName]    = useState('');
  const [sessionId,    setSessionId]    = useState('');
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    if (!venueId) return;

    fetch('/api/checkin', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ venueId, eventId, zoneId, section, seat, lang }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setSessionId(data.sessionId ?? '');
          setVenueName(data.venue?.name ?? venueId.replace(/-/g, ' ').toUpperCase());
          setZoneName(section || zoneId || 'General Entry');
          if (data.event?.name) setEventName(data.event.name);
          setStatus('done');

          // If user hasn't seen tutorial, prompt tutorial
          const seen = localStorage.getItem('vf_tutorial_seen');
          if (!seen) {
            setShowTutorial(true);
          }
        } else {
          setStatus('error');
        }
      })
      .catch(() => setStatus('error'));
  }, [venueId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleProceed = () => {
    const targetUrl = `/g/${venueId}?session=${sessionId}&event=${eventId ?? ''}&zone=${zoneId ?? ''}&lang=${lang}`;
    router.replace(targetUrl);
  };

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
      maxWidth      : 440,
      margin        : '0 auto',
      color         : 'var(--text-1)',
    }}>
      {/* Brand Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Activity size={18} color="#fff" />
        </div>
        <span style={{ fontWeight: 800, fontSize: '1.125rem', letterSpacing: '-0.02em' }}>VenueFlow</span>
      </div>

      {/* Checking State */}
      {status === 'checking' && (
        <div style={{ padding: '2rem 0' }}>
          <Loader2 size={44} color="var(--brand-light)" style={{ animation: 'spin 1s linear infinite', marginBottom: '1.25rem' }} />
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-1)', marginBottom: '0.375rem' }}>Checking you in…</h2>
          <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>Connecting to venue crowd monitoring system</p>
        </div>
      )}

      {/* Success State */}
      {status === 'done' && (
        <div className="anim-fade-up" style={{ width: '100%' }}>
          <div style={{
            width: 76, height: 76, borderRadius: '50%',
            background: 'color-mix(in srgb, var(--success) 15%, transparent)',
            border: '2px solid var(--success)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.5rem',
          }}>
            <CheckCircle size={38} color="var(--success)" />
          </div>

          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-1)', marginBottom: '0.375rem' }}>
            {GREETINGS[lang] ?? GREETINGS.en}
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--brand-light)', fontSize: '0.9375rem', fontWeight: 600, marginBottom: '1.5rem' }}>
            <MapPin size={16} />
            <span>{venueName}</span>
          </div>

          {/* Event & Seat Badge */}
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: '1rem 1.25rem',
            textAlign: 'left',
            marginBottom: '1.5rem',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          }}>
            {eventName && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.625rem', paddingBottom: '0.625rem', borderBottom: '1px solid var(--border)' }}>
                <Ticket size={16} color="var(--accent)" />
                <div>
                  <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)' }}>Event</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-1)' }}>{eventName}</div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)' }}>Zone / Section</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-1)' }}>{zoneName}</div>
              </div>
              {seat && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-3)' }}>Seat</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--brand-light)' }}>{seat}</div>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              onClick={() => setShowTutorial(true)}
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', fontSize: '0.9375rem' }}
            >
              <Sparkles size={16} /> Take Quick App Tutorial
            </button>

            <button
              onClick={handleProceed}
              className="btn-ghost"
              style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', fontSize: '0.875rem' }}
            >
              Enter Venue Live Dashboard <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Error State */}
      {status === 'error' && (
        <div>
          <p style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.9375rem' }}>
            Check-in failed. You can still access the venue map directly.
          </p>
          <button
            onClick={() => router.replace(`/g/${venueId}`)}
            className="btn-primary"
          >
            Go to Venue Map
          </button>
        </div>
      )}

      {/* Interactive Tutorial Modal */}
      <GuestTutorial
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
        onComplete={handleProceed}
        venueName={venueName}
        eventName={eventName}
      />
    </div>
  );
}

export default function CheckInPage() {
  return (
    <Suspense fallback={<LoadingShell />}>
      <CheckInContent />
    </Suspense>
  );
}
