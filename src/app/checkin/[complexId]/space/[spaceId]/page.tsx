'use client';
import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Activity, CheckCircle, Loader2, MapPin, QrCode, Users } from 'lucide-react';
import type { VenueComplex, VenueSpace, SpaceEvent } from '@/types';

/**
 * /checkin/[complexId]/space/[spaceId]?event=eventId
 *
 * Gate-level QR check-in page for a specific space inside a complex.
 * This is the URL printed on entrance QR codes at each hall / auditorium door.
 *
 * Flow:
 *   1. Reads complexId, spaceId, eventId from URL
 *   2. Fetches complex + space + event details from /api/complex
 *   3. Shows building → floor → space → event info
 *   4. "Check In" → POST /api/checkin with full complex context
 *   5. Stores sessionId in sessionStorage
 *   6. Redirects to /g/{complexId}/{spaceId}?session={id}
 */
function ComplexSpaceCheckinContent() {
  const params       = useParams<{ complexId: string; spaceId: string }>();
  const searchParams = useSearchParams();
  const router       = useRouter();

  const { complexId, spaceId } = params;
  const eventId = searchParams?.get('event') ?? undefined;

  const [complex,   setComplex]   = useState<VenueComplex | null>(null);
  const [space,     setSpace]     = useState<VenueSpace | null>(null);
  const [event,     setEvent]     = useState<SpaceEvent | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [checking,  setChecking]  = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [error,     setError]     = useState('');

  useEffect(() => {
    if (!complexId || !spaceId) return;

    fetch(`/api/complex?complexId=${complexId}`)
      .then(r => r.json())
      .then(data => {
        if (!data.ok) { setError('Venue not found'); return; }
        setComplex(data.complex);
        const foundSpace = (data.spaces as VenueSpace[]).find(s => s.id === spaceId);
        setSpace(foundSpace ?? null);
        if (eventId && data.liveEvents) {
          const foundEvent = (data.liveEvents as SpaceEvent[]).find(e => e.id === eventId || e.spaceId === spaceId);
          setEvent(foundEvent ?? null);
        }
      })
      .catch(() => setError('Failed to load venue data'))
      .finally(() => setLoading(false));
  }, [complexId, spaceId, eventId]);

  const handleCheckIn = async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/checkin', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
          venueId  : complexId,    // use complexId as venueId for legacy compatibility
          complexId,
          spaceId,
          eventId  : eventId ?? event?.id,
          zoneId   : 'zone-entrance',
          floor    : space?.floor ?? 0,
          lang     : navigator.language?.split('-')[0] ?? 'en',
        }),
      });
      const data = await res.json();

      if (!data.ok) throw new Error(data.error);

      // Persist session for this complex/space
      sessionStorage.setItem('vf_session_id', data.sessionId);
      sessionStorage.setItem('vf_complex_id', complexId);
      sessionStorage.setItem('vf_space_id',   spaceId);

      setCheckedIn(true);

      // Redirect to guest complex PWA after a short success moment
      setTimeout(() => {
        router.push(`/g/${complexId}/${spaceId}?session=${data.sessionId}`);
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Check-in failed. Please try again.');
      setChecking(false);
    }
  };

  if (loading) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--brand-light)' }} />
    </div>
  );

  if (error && !complex) return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text-1)', gap: '1rem', padding: '2rem' }}>
      <span style={{ fontSize: 48 }}>🚫</span>
      <p style={{ fontSize: '1rem', color: 'var(--danger)', textAlign: 'center' }}>{error}</p>
    </div>
  );

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--text-1)', display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>

      {/* Header */}
      <header style={{ padding: '1.25rem 1.25rem 0.75rem', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.25rem' }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={15} color="#fff" />
          </div>
          <span style={{ fontWeight: 800, fontSize: '1rem' }}>VenueFlow</span>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-4)' }}>Smart venue check-in</p>
      </header>

      <main style={{ flex: 1, padding: '1.5rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Building breadcrumb */}
        <div>
          <p style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.375rem' }}>Venue</p>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-1)', lineHeight: 1.2 }}>
            {complex?.name ?? complexId}
          </h1>
          {complex?.city && (
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <MapPin size={12} /> {complex.city}
            </p>
          )}
        </div>

        {/* Space card */}
        {space && (
          <div className="card" style={{ borderRadius: 14, padding: '1.125rem', background: 'var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div>
                <p style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>Your Location</p>
                <p style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--text-1)' }}>{space.name}</p>
              </div>
              <span className="chip chip-blue" style={{ fontSize: '0.7rem' }}>
                {space.floor === 0 ? 'Ground Floor' : `Floor ${space.floor}`}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div>
                <p className="label-xs" style={{ marginBottom: '0.125rem' }}>Capacity</p>
                <p style={{ fontWeight: 700, fontSize: '0.9375rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Users size={13} color="var(--text-3)" />{space.capacity.toLocaleString()}
                </p>
              </div>
              {space.isStepFree && (
                <div>
                  <p className="label-xs" style={{ marginBottom: '0.125rem' }}>Access</p>
                  <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--success)' }}>♿ Step-Free</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Event card (if live event found) */}
        {event && (
          <div style={{ background: 'color-mix(in srgb, var(--brand) 8%, var(--surface))', border: '1px solid color-mix(in srgb, var(--brand) 25%, transparent)', borderRadius: 14, padding: '1.125rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span className="live-badge"><span className="live-dot" />LIVE NOW</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{event.type}</span>
            </div>
            <p style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-1)', marginBottom: '0.375rem' }}>{event.name}</p>
            {event.description && (
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {event.description}
              </p>
            )}
          </div>
        )}

        {/* Privacy note */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.875rem', display: 'flex', gap: '0.625rem' }}>
          <QrCode size={18} color="var(--text-4)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-2)' }}>Anonymous check-in</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-4)', marginTop: '0.125rem', lineHeight: 1.4 }}>
              No account needed. Your location data is not stored beyond 24 hours and is never shared.
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p style={{ fontSize: '0.8125rem', color: 'var(--danger)', textAlign: 'center' }}>{error}</p>
        )}

        {/* CTA */}
        <button
          id="checkin-btn"
          onClick={handleCheckIn}
          disabled={checking || checkedIn}
          className="btn-glow"
          style={{ width: '100%', justifyContent: 'center', fontSize: '1rem', padding: '0.875rem', borderRadius: 12, gap: '0.5rem', marginTop: 'auto' }}
          aria-label="Check in to venue"
        >
          {checkedIn ? (
            <><CheckCircle size={20} /> Checked in! Redirecting…</>
          ) : checking ? (
            <><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> Checking in…</>
          ) : (
            <><QrCode size={20} /> Check In Now</>
          )}
        </button>
      </main>

      <footer style={{ padding: '0.75rem', background: 'var(--surface)', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
        <p style={{ fontSize: '0.65rem', color: 'var(--text-4)' }}>Powered by <strong style={{ color: 'var(--text-3)' }}>VenueFlow</strong></p>
      </footer>
    </div>
  );
}

export default function ComplexSpaceCheckinPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--brand-light)' }} />
      </div>
    }>
      <ComplexSpaceCheckinContent />
    </Suspense>
  );
}
