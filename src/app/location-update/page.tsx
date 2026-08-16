'use client';
import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, Loader2, MapPin } from 'lucide-react';

/**
 * /location-update?c={complexId}&sp={spaceId}&z={zoneId}&floor=1&src=qr
 *
 * Silent zone-update landing page. Target of internal venue QR codes
 * posted at specific zones (stage, balcony, food court, etc.) inside a space.
 *
 * Flow:
 *   1. Read sessionId from sessionStorage
 *   2. If missing → redirect to check-in page for that space
 *   3. Call POST /api/location/update
 *   4. Show "📍 Location updated" for 1.2 seconds
 *   5. Redirect back to /g/{complexId}/{spaceId}
 *
 * Total UX friction: ~1.5 seconds — invisible to the user in practice.
 */
function LocationUpdateContent() {
  const params       = useParams();
  const searchParams = useSearchParams();
  const router       = useRouter();

  const complexId = searchParams?.get('c')   ?? (params?.complexId as string | undefined) ?? '';
  const spaceId   = searchParams?.get('sp')  ?? '';
  const zoneId    = searchParams?.get('z')   ?? 'zone-main';
  const floor     = parseInt(searchParams?.get('floor') ?? '0', 10);
  const source    = (searchParams?.get('src') ?? 'qr') as 'qr' | 'manual';

  const [status, setStatus] = useState<'loading' | 'updated' | 'error' | 'redirecting'>('loading');

  useEffect(() => {
    const sessionId = sessionStorage.getItem('vf_session_id');

    if (!sessionId) {
      // No session — redirect to check-in
      const dest = complexId && spaceId
        ? `/checkin/${complexId}/space/${spaceId}`
        : '/checkin';
      router.replace(dest);
      return;
    }

    // Fire the update
    fetch('/api/location/update', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ sessionId, complexId, spaceId, zoneId, floor, source }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.ok) {
          setStatus('updated');

          // Update sessionStorage with new position
          if (spaceId)   sessionStorage.setItem('vf_space_id', spaceId);
          if (complexId) sessionStorage.setItem('vf_complex_id', complexId);

          // Redirect back to guest PWA after success moment
          setTimeout(() => {
            setStatus('redirecting');
            const dest = complexId && spaceId
              ? `/g/${complexId}/${spaceId}?session=${sessionId}`
              : `/g/${complexId ?? spaceId}?session=${sessionId}`;
            router.replace(dest);
          }, 1200);
        } else {
          setStatus('error');
          // On error, redirect anyway — don't block the user
          setTimeout(() => {
            const dest = complexId && spaceId ? `/g/${complexId}/${spaceId}` : '/';
            router.replace(dest);
          }, 2500);
        }
      })
      .catch(() => {
        setStatus('error');
        setTimeout(() => {
          const dest = complexId && spaceId ? `/g/${complexId}/${spaceId}` : '/';
          router.replace(dest);
        }, 2500);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{
      minHeight       : '100dvh',
      background      : 'var(--bg)',
      display         : 'flex',
      flexDirection   : 'column',
      alignItems      : 'center',
      justifyContent  : 'center',
      fontFamily      : 'Inter, sans-serif',
      color           : 'var(--text-1)',
      gap             : '1rem',
      padding         : '2rem',
      textAlign       : 'center',
    }}>
      {status === 'loading' && (
        <>
          <Loader2 size={40} style={{ animation: 'spin 1s linear infinite', color: 'var(--brand-light)' }} />
          <p style={{ fontSize: '0.9375rem', color: 'var(--text-3)' }}>Updating your location…</p>
        </>
      )}

      {status === 'updated' && (
        <>
          <div style={{
            width       : 72,
            height      : 72,
            borderRadius: '50%',
            background  : 'color-mix(in srgb, var(--success) 15%, transparent)',
            border      : '2px solid color-mix(in srgb, var(--success) 40%, transparent)',
            display     : 'flex',
            alignItems  : 'center',
            justifyContent: 'center',
            animation   : 'anim-fade-in 0.3s ease',
          }}>
            <CheckCircle size={36} color="var(--success)" />
          </div>
          <div>
            <p style={{ fontSize: '1.125rem', fontWeight: 700 }}>📍 Location updated</p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
              <MapPin size={12} />
              {zoneId.replace('zone-', '').replace(/-/g, ' ')}
              {floor > 0 && ` · Floor ${floor}`}
            </p>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-4)' }}>Returning to your dashboard…</p>
        </>
      )}

      {status === 'redirecting' && (
        <>
          <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: 'var(--brand-light)' }} />
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-4)' }}>Redirecting…</p>
        </>
      )}

      {status === 'error' && (
        <>
          <span style={{ fontSize: 48 }}>⚠️</span>
          <p style={{ fontSize: '0.9375rem', color: 'var(--warning)' }}>Location update failed</p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-4)' }}>Returning to dashboard in a moment…</p>
        </>
      )}
    </div>
  );
}

export default function LocationUpdatePage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight     : '100dvh',
        background    : 'var(--bg)',
        display       : 'flex',
        flexDirection : 'column',
        alignItems    : 'center',
        justifyContent: 'center',
        fontFamily    : 'Inter, sans-serif',
        color         : 'var(--text-1)',
        gap           : '1rem',
        padding       : '2rem',
        textAlign     : 'center',
      }}>
        <Loader2 size={40} style={{ animation: 'spin 1s linear infinite', color: 'var(--brand-light)' }} />
        <p style={{ fontSize: '0.9375rem', color: 'var(--text-3)' }}>Updating your location…</p>
      </div>
    }>
      <LocationUpdateContent />
    </Suspense>
  );
}
