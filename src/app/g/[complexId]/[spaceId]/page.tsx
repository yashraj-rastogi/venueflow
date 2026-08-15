'use client';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Activity, AlertTriangle, Bell, BellOff, Bot, Building2, CheckCircle, Clock, Loader2, LogOut, MapPin, Wifi, WifiOff } from 'lucide-react';
import { useSpaceCrowd, useComplexNotifications } from '@/hooks/useRealtimeData';
import { fmtCount, fmtPct, fmtDensityColor } from '@/lib/formatters';
import LiveRegion from '@/components/LiveRegion';
import AIChat from '@/components/AIChat';
import dynamic from 'next/dynamic';
import type { VenueComplex, VenueSpace, SpaceEvent } from '@/types';

const ComplexMap = dynamic(() => import('@/components/ComplexMap'), {
  ssr    : false,
  loading: () => (
    <div style={{ height: 280, borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: '0.8125rem' }}>
      Loading building map…
    </div>
  ),
});

type Tab = 'map' | 'waittimes' | 'alerts' | 'chat';

/**
 * /g/[complexId]/[spaceId]
 *
 * Guest PWA scoped to a single event space within a complex building.
 * Shows ONLY crowd data for the guest's space — other spaces are invisible.
 * Receives both space-scoped and complex-wide alerts via useComplexNotifications.
 */
export default function GuestComplexPWA() {
  const params       = useParams<{ complexId: string; spaceId: string }>();
  const searchParams = useSearchParams();

  const { complexId, spaceId } = params;
  const sessionId = searchParams?.get('session') ?? undefined;

  const { crowd, loading: crowdLoading } = useSpaceCrowd(complexId, spaceId);
  const { notifications, unreadCount, markAllRead } = useComplexNotifications(complexId, spaceId);

  const [complex,  setComplex]  = useState<VenueComplex | null>(null);
  const [space,    setSpace]    = useState<VenueSpace | null>(null);
  const [event,    setEvent]    = useState<SpaceEvent | null>(null);
  const [tab,      setTab]      = useState<Tab>('map');
  const [online,   setOnline]   = useState(true);
  const [leaving,  setLeaving]  = useState(false);
  const [emergency, setEmergency] = useState('');

  // Fetch static complex + space metadata
  useEffect(() => {
    if (!complexId) return;
    fetch(`/api/complex?complexId=${complexId}`)
      .then(r => r.json())
      .then(data => {
        if (!data.ok) return;
        setComplex(data.complex);
        const found = (data.spaces as VenueSpace[]).find(s => s.id === spaceId);
        setSpace(found ?? null);
        const liveEvt = (data.liveEvents as SpaceEvent[]).find(e => e.spaceId === spaceId);
        setEvent(liveEvt ?? null);
      })
      .catch(console.error);
  }, [complexId, spaceId]);

  // Restore session from sessionStorage if not in URL
  useEffect(() => {
    if (!sessionId) {
      const stored = sessionStorage.getItem('vf_session_id');
      if (stored) sessionStorage.setItem('vf_session_id', stored);
    }
  }, [sessionId]);

  // Online / offline detection
  useEffect(() => {
    const on  = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  // Emergency notifications
  useEffect(() => {
    const em = notifications.find(n => n.type === 'emergency' && !n.read);
    if (em) setEmergency(em.message);
    else setEmergency('');
  }, [notifications]);

  const handleLeave = async () => {
    if (!confirm(`Leave ${space?.name ?? 'the venue'}?\n\nThis updates real-time crowd numbers.`)) return;
    setLeaving(true);
    try {
      const sid = sessionId ?? sessionStorage.getItem('vf_session_id') ?? undefined;
      await fetch('/api/checkout', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ venueId: complexId, zoneId: 'zone-entrance', sessionId: sid }),
      });
    } catch {} finally {
      sessionStorage.removeItem('vf_session_id');
      window.location.href = '/checkin';
    }
  };

  const density  = crowd?.density ?? 0;
  const count    = crowd?.count   ?? 0;
  const capacity = crowd?.capacity ?? space?.capacity ?? 0;
  const dColor   = fmtDensityColor(density);

  const AMENITY_ICONS: Record<string, string> = { restroom: '🚻', concession: '🍕', merchandise: '👕', gate: '🚪', elevator: '🛗' };

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--text-1)', display: 'flex', flexDirection: 'column', maxWidth: 430, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      <LiveRegion message={emergency} level="assertive" />

      {/* Emergency banner */}
      {emergency && (
        <div role="alert" style={{ background: 'var(--danger-bg)', borderBottom: '1px solid var(--danger-border)', padding: '0.75rem 1rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
          <AlertTriangle size={15} color="var(--danger)" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: '0.8125rem', color: 'var(--danger)', fontWeight: 600 }}>{emergency}</p>
        </div>
      )}

      {/* Live event banner */}
      {event && (
        <div style={{ background: 'color-mix(in srgb, var(--brand) 8%, var(--surface))', borderBottom: '1px solid color-mix(in srgb, var(--brand) 20%, transparent)', padding: '0.625rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="live-badge" style={{ fontSize: '0.65rem' }}><span className="live-dot" />LIVE</span>
          <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: 'var(--brand-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.name}</span>
        </div>
      )}

      {/* Header */}
      <header style={{ padding: '0.875rem 1rem', background: 'var(--surface)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Activity size={13} color="#fff" />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontWeight: 700, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {space?.name ?? spaceId}
              </p>
              <p style={{ fontSize: '0.65rem', color: 'var(--text-4)', display: 'flex', alignItems: 'center', gap: 3 }}>
                <Building2 size={9} />
                {complex?.name ?? complexId}
                {(space?.floor ?? 0) > 0 && <> · Floor {space?.floor}</>}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 }}>
            {!online && <WifiOff size={13} color="var(--danger)" aria-label="Offline" />}
            <button
              onClick={handleLeave}
              disabled={leaving}
              aria-label="Leave venue"
              style={{ background: 'color-mix(in srgb, var(--danger) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)', color: 'var(--danger)', borderRadius: 7, fontSize: '0.72rem', fontWeight: 600, padding: '0.2rem 0.5rem', cursor: leaving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              {leaving ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <LogOut size={11} />} Leave
            </button>
          </div>
        </div>

        {/* Crowd bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
          <span style={{ fontSize: '0.8125rem', color: dColor, fontWeight: 600 }}>
            {density > 0.75 ? 'Very busy' : density > 0.5 ? 'Busy' : 'Light traffic'}
          </span>
          <span style={{ fontSize: '0.7rem', color: dColor, fontWeight: 700 }}>{fmtPct(density)}</span>
        </div>
        <div style={{ height: 3, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${density * 100}%`, background: dColor, transition: 'width 1s ease', borderRadius: 99 }} />
        </div>
      </header>

      {/* Tab bar */}
      <nav role="tablist" style={{ display: 'flex', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        {([
          ['map',       '🗺️ Map',       null],
          ['waittimes', '⏱️ Wait',       null],
          ['alerts',    '🔔 Alerts',     unreadCount > 0 ? unreadCount : null],
          ['chat',      '🤖 Ask AI',     null],
        ] as const).map(([id, label, badge]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => { setTab(id); if (id === 'alerts') markAllRead(); }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', padding: '0.625rem 0.5rem', border: 'none', cursor: 'pointer', background: 'transparent', fontSize: '0.7rem', fontWeight: tab === id ? 600 : 400, color: tab === id ? 'var(--brand-light)' : 'var(--text-3)', borderBottom: `2px solid ${tab === id ? 'var(--brand)' : 'transparent'}`, transition: 'all 0.15s', position: 'relative' }}
          >
            {label}
            {badge != null && (
              <span style={{ position: 'absolute', top: 4, right: '18%', background: 'var(--danger)', color: '#fff', borderRadius: 99, fontSize: '0.55rem', fontWeight: 700, padding: '0.05rem 0.3rem', minWidth: 14, textAlign: 'center' }}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>

        {/* MAP TAB */}
        {tab === 'map' && (
          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {complex && space && (
              <div style={{ height: 280, width: '100%', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
                <ComplexMap
                  complex={complex}
                  spaces={[space]}
                  crowdData={{ [spaceId]: crowd ?? { spaceId: space.id, spaceName: space.name, density: 0, count: 0, capacity: space.capacity, status: 'normal' } }}
                  mode="guest"
                  mySpaceId={spaceId}
                />
              </div>
            )}

            {/* Crowd stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
              <div className="card" style={{ padding: '0.875rem', borderRadius: 10 }}>
                <p className="label-xs" style={{ marginBottom: '0.25rem' }}>Current Guests</p>
                <p className="stat-lg" style={{ color: dColor }}>{crowdLoading ? '–' : fmtCount(count)}</p>
              </div>
              <div className="card" style={{ padding: '0.875rem', borderRadius: 10 }}>
                <p className="label-xs" style={{ marginBottom: '0.25rem' }}>Capacity</p>
                <p className="stat-lg">{fmtCount(capacity)}</p>
              </div>
            </div>

            {/* Your location */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.875rem', display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
              <MapPin size={16} color="var(--success)" style={{ flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: '0.8125rem', fontWeight: 600 }}>📍 Your location</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.1rem' }}>{space?.name} {space?.floor === 0 ? '· Ground Floor' : `· Floor ${space?.floor}`}</p>
              </div>
            </div>
          </div>
        )}

        {/* WAIT TIMES TAB */}
        {tab === 'waittimes' && (
          <div style={{ padding: '1rem' }}>
            <p style={{ fontSize: '0.6875rem', fontWeight: 500, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>Wait times — {space?.name}</p>
            {(space?.amenities ?? []).length === 0 ? (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-3)', textAlign: 'center', marginTop: '2rem' }}>No amenities listed for this space.</p>
            ) : (
              (['restroom', 'concession', 'gate', 'merchandise', 'elevator'] as const).map(type => {
                const items = (space?.amenities ?? []).filter(a => a.type === type && a.isOpen);
                if (!items.length) return null;
                return (
                  <div key={type} style={{ marginBottom: '1rem' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-4)', fontWeight: 500, marginBottom: '0.375rem' }}>{AMENITY_ICONS[type]} {type.charAt(0).toUpperCase() + type.slice(1)}s</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                      {items.sort((a, b) => a.waitTime - b.waitTime).map(a => (
                        <div key={a.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <p style={{ fontWeight: 500, fontSize: '0.875rem' }}>{a.name}</p>
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginTop: '0.1rem' }}>Section {a.section}</p>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: a.waitTime > 10 ? 'var(--danger)' : a.waitTime > 5 ? 'var(--warning)' : 'var(--success)' }}>
                              {a.waitTime === 0 ? 'No wait' : `${a.waitTime}m`}
                            </p>
                            <p style={{ fontSize: '0.65rem', color: a.trend === 'increasing' ? 'var(--danger)' : a.trend === 'decreasing' ? 'var(--success)' : 'var(--text-3)' }}>
                              {a.trend === 'increasing' ? '↑ rising' : a.trend === 'decreasing' ? '↓ falling' : '→ stable'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ALERTS TAB */}
        {tab === 'alerts' && (
          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            <p style={{ fontSize: '0.6875rem', fontWeight: 500, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Alerts for {space?.name}
            </p>
            {notifications.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
                <BellOff size={32} color="var(--text-4)" style={{ margin: '0 auto 0.75rem' }} />
                <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>No alerts right now</p>
              </div>
            ) : (
              notifications.map(n => (
                <div key={n.id} style={{ background: 'var(--surface)', border: `1px solid ${n.type === 'emergency' ? 'var(--danger-border)' : n.type === 'warning' ? 'color-mix(in srgb, var(--warning) 30%, transparent)' : 'var(--border)'}`, borderRadius: 10, padding: '0.875rem', display: 'flex', gap: '0.625rem' }}>
                  <CheckCircle size={15} color={n.type === 'emergency' ? 'var(--danger)' : n.type === 'warning' ? 'var(--warning)' : 'var(--brand-light)'} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{n.title}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.125rem' }}>{n.message}</p>
                    <p style={{ fontSize: '0.65rem', color: 'var(--text-4)', marginTop: '0.375rem' }}>{new Date(n.timestamp).toLocaleTimeString()}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* AI CHAT TAB */}
        {tab === 'chat' && (
          <AIChat
            venueName={event?.name ?? space?.name ?? complexId}
            avgDensity={density}
          />
        )}
      </div>

      <footer style={{ padding: '0.5rem', background: 'var(--surface)', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
        <p style={{ fontSize: '0.65rem', color: 'var(--text-4)' }}>Powered by <strong style={{ color: 'var(--text-3)' }}>VenueFlow</strong></p>
      </footer>
    </div>
  );
}
