'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import {
  Activity, AlertTriangle, Bell, Building2, Loader2,
  MapPin, Send, Settings, Shield, Users, Zap, RefreshCw,
} from 'lucide-react';
import {
  useComplexCrowd, useComplexNotifications, useGuestPositions,
} from '@/hooks/useRealtimeData';
import { subscribeToComplexSpaces, subscribeToLiveSpaceEvents } from '@/lib/firestore';
import { fmtCount, fmtPct, fmtDensityColor } from '@/lib/formatters';
import SpaceCard from '@/components/SpaceCard';
import dynamic from 'next/dynamic';
import type { VenueComplex, VenueSpace, SpaceEvent } from '@/types';

const ComplexMap = dynamic(() => import('@/components/ComplexMap'), {
  ssr    : false,
  loading: () => (
    <div style={{ height: 340, borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: '0.8125rem' }}>
      Loading building map…
    </div>
  ),
});

type Tab = 'overview' | 'spaces' | 'shared' | 'broadcast' | 'incidents' | 'settings';

/**
 * /complex/[complexId]
 *
 * ComplexAdmin Overview Dashboard — facility manager sees ALL spaces.
 * Requires FGA complex_admin role (enforced server-side by API calls).
 */
export default function ComplexAdminPage() {
  const params    = useParams<{ complexId: string }>();
  const router    = useRouter();
  const complexId = params.complexId;

  const { spaces: crowdSpaces, shared: crowdShared, totalCount, loading: crowdLoading } = useComplexCrowd(complexId);
  const { notifications, unreadCount } = useComplexNotifications(complexId, undefined);
  const { positions } = useGuestPositions(complexId);

  const [complex,   setComplex]   = useState<VenueComplex | null>(null);
  const [spaces,    setSpaces]    = useState<VenueSpace[]>([]);
  const [events,    setEvents]    = useState<SpaceEvent[]>([]);
  const [tab,       setTab]       = useState<Tab>('overview');
  const [broadcast, setBroadcast] = useState({ title: '', message: '', type: 'info' as 'info' | 'warning' | 'emergency' });
  const [sending,   setSending]   = useState(false);
  const [sendOk,    setSendOk]    = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(true);

  // Fetch static complex metadata
  useEffect(() => {
    if (!complexId) return;
    fetch(`/api/complex?complexId=${complexId}`)
      .then(r => r.json())
      .then(data => { if (data.ok) setComplex(data.complex); })
      .catch(console.error)
      .finally(() => setLoadingMeta(false));
  }, [complexId]);

  // Live-subscribe to spaces and events
  useEffect(() => {
    if (!complexId) return;
    const unsubSpaces  = subscribeToComplexSpaces(complexId, setSpaces);
    const unsubEvents  = subscribeToLiveSpaceEvents(complexId, setEvents);
    return () => { unsubSpaces(); unsubEvents(); };
  }, [complexId]);

  const handleBroadcast = useCallback(async () => {
    if (!broadcast.message.trim()) return;
    setSending(true);
    try {
      const res = await fetch('/api/notify', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ complexId, ...broadcast }),
      });
      if ((await res.json()).ok) { setSendOk(true); setBroadcast(p => ({ ...p, message: '', title: '' })); setTimeout(() => setSendOk(false), 3000); }
    } finally { setSending(false); }
  }, [complexId, broadcast]);

  const liveEventCount  = events.filter(e => e.status === 'live').length;
  const allSpaceCrowds  = { ...crowdSpaces, ...crowdShared };
  const busiest         = Object.entries(allSpaceCrowds).sort((a, b) => b[1].density - a[1].density)[0];
  const guestPositionCount = Object.keys(positions).length;

  if (loadingMeta) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--brand-light)' }} />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text-1)', fontFamily: 'Inter, sans-serif' }}>

      {/* Top bar */}
      <header style={{ position: 'sticky', top: 0, zIndex: 40, background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0.875rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={17} color="#fff" />
          </div>
          <div>
            <p style={{ fontWeight: 800, fontSize: '1rem' }}>{complex?.name ?? complexId}</p>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-4)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Building2 size={10} /> ComplexAdmin Dashboard
              {complex?.city && <> · {complex.city}</>}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {unreadCount > 0 && (
            <span style={{ background: 'var(--danger)', color: '#fff', borderRadius: 99, fontSize: '0.7rem', fontWeight: 700, padding: '0.1rem 0.5rem' }}>
              {unreadCount} alerts
            </span>
          )}
          <span className={crowdLoading ? 'chip chip-amber' : 'chip chip-green'} style={{ fontSize: '0.7rem' }}>
            {crowdLoading ? 'Connecting…' : '🟢 Live'}
          </span>
        </div>
      </header>

      <div style={{ display: 'flex', height: 'calc(100vh - 57px)' }}>

        {/* Sidebar tabs */}
        <aside style={{ width: 200, background: 'var(--surface)', borderRight: '1px solid var(--border)', padding: '1rem 0', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {([
            ['overview',   '🏢', 'Overview'],
            ['spaces',     '🚪', 'Spaces'],
            ['shared',     '🔗', 'Shared Areas'],
            ['broadcast',  '📢', 'Broadcast'],
            ['incidents',  '🚨', 'Incidents'],
            ['settings',   '⚙️', 'Settings'],
          ] as const).map(([id, icon, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.625rem 1.125rem', border: 'none', cursor: 'pointer', background: tab === id ? 'color-mix(in srgb, var(--brand) 10%, transparent)' : 'transparent', color: tab === id ? 'var(--brand-light)' : 'var(--text-3)', borderLeft: `3px solid ${tab === id ? 'var(--brand)' : 'transparent'}`, fontSize: '0.8125rem', fontWeight: tab === id ? 600 : 400, textAlign: 'left', transition: 'all 0.15s' }}
            >
              <span>{icon}</span>{label}
            </button>
          ))}
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>

          {/* OVERVIEW */}
          {tab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Summary stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.875rem' }}>
                {[
                  { label: 'Total Guests', value: crowdLoading ? '–' : fmtCount(totalCount), icon: <Users size={16} />, color: 'var(--brand-light)' },
                  { label: 'Live Events', value: liveEventCount, icon: <Activity size={16} />, color: 'var(--success)' },
                  { label: 'Active Spaces', value: spaces.length, icon: <Building2 size={16} />, color: 'var(--warning)' },
                  { label: 'Live Positions', value: guestPositionCount, icon: <MapPin size={16} />, color: 'var(--text-3)' },
                ].map(stat => (
                  <div key={stat.label} className="card" style={{ padding: '1rem', borderRadius: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: stat.color, marginBottom: '0.375rem' }}>
                      {stat.icon}
                      <span className="label-xs">{stat.label}</span>
                    </div>
                    <p className="stat-xl" style={{ color: stat.color }}>{stat.value}</p>
                  </div>
                ))}
              </div>

              {/* Building map */}
              {complex && spaces.length > 0 && (
                <div style={{ height: 340, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <ComplexMap
                    complex={complex}
                    spaces={spaces}
                    crowdData={allSpaceCrowds}
                    mode="admin"
                    onSpaceClick={spaceId => router.push(`/complex/${complexId}/space/${spaceId}/admin`)}
                  />
                </div>
              )}

              {/* Busiest space alert */}
              {busiest && busiest[1].density > 0.75 && (
                <div style={{ background: 'color-mix(in srgb, var(--danger) 10%, var(--surface))', border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)', borderRadius: 12, padding: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <AlertTriangle size={18} color="var(--danger)" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--danger)' }}>Congestion Alert</p>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>
                      <strong>{busiest[1].spaceName ?? busiest[0]}</strong> is at {fmtPct(busiest[1].density)} capacity. Consider dispatching staff.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SPACES */}
          {tab === 'spaces' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <p className="label-xs" style={{ marginBottom: '0.25rem' }}>All Spaces — click to open SpaceAdmin</p>
              {spaces.filter(s => !s.isShared).map(space => (
                <SpaceCard
                  key={space.id}
                  space={space}
                  crowd={crowdSpaces[space.id]}
                  event={events.find(e => e.spaceId === space.id)}
                  mode="admin"
                  onClick={() => router.push(`/complex/${complexId}/space/${space.id}/admin`)}
                />
              ))}
            </div>
          )}

          {/* SHARED AREAS */}
          {tab === 'shared' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <p className="label-xs" style={{ marginBottom: '0.25rem' }}>Shared corridors, restrooms, elevators</p>
              {spaces.filter(s => s.isShared).length === 0 ? (
                <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>No shared spaces defined for this complex.</p>
              ) : (
                spaces.filter(s => s.isShared).map(space => (
                  <SpaceCard
                    key={space.id}
                    space={space}
                    crowd={crowdShared[space.id]}
                    mode="admin"
                  />
                ))
              )}
            </div>
          )}

          {/* BROADCAST */}
          {tab === 'broadcast' && (
            <div style={{ maxWidth: 560, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.25rem' }}>📢 Broadcast to All Spaces</h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)' }}>Messages are delivered to all attendees across every space in this building.</p>
              </div>
              <div>
                <label className="label-xs" style={{ display: 'block', marginBottom: '0.375rem' }}>Alert type</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {(['info', 'warning', 'emergency'] as const).map(t => (
                    <button key={t} onClick={() => setBroadcast(p => ({ ...p, type: t }))}
                      className={broadcast.type === t ? 'btn-glow' : 'btn-ghost'}
                      style={{ fontSize: '0.8125rem', padding: '0.375rem 0.875rem', height: 'auto' }}>
                      {t === 'info' ? '💬 Info' : t === 'warning' ? '⚠️ Warning' : '🚨 Emergency'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label-xs" style={{ display: 'block', marginBottom: '0.375rem' }}>Title (optional)</label>
                <input className="input-dark" value={broadcast.title} onChange={e => setBroadcast(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Gates Open" style={{ width: '100%' }} />
              </div>
              <div>
                <label className="label-xs" style={{ display: 'block', marginBottom: '0.375rem' }}>Message</label>
                <textarea className="input-dark" value={broadcast.message} onChange={e => setBroadcast(p => ({ ...p, message: e.target.value }))} placeholder="e.g. Main keynote starts in 10 minutes — please take your seats." rows={3} style={{ width: '100%', resize: 'vertical' }} />
              </div>
              <button onClick={handleBroadcast} disabled={sending || !broadcast.message.trim()} className="btn-glow" style={{ alignSelf: 'flex-start', gap: '0.5rem', opacity: sending || !broadcast.message.trim() ? 0.5 : 1 }}>
                {sending ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={15} />}
                {sending ? 'Sending…' : 'Send to All Spaces'}
              </button>
              {sendOk && <p style={{ fontSize: '0.8125rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 6 }}><Shield size={13} /> Broadcast sent successfully</p>}
            </div>
          )}

          {/* INCIDENTS */}
          {tab === 'incidents' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>🚨 Incidents</h2>
              {notifications.filter(n => n.type === 'emergency' || n.type === 'warning').length === 0 ? (
                <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>No active incidents. All systems normal.</p>
              ) : (
                notifications.filter(n => n.type === 'emergency' || n.type === 'warning').map(n => (
                  <div key={n.id} style={{ background: 'var(--surface)', border: `1px solid ${n.type === 'emergency' ? 'var(--danger-border)' : 'color-mix(in srgb, var(--warning) 30%, transparent)'}`, borderRadius: 12, padding: '1rem', display: 'flex', gap: '0.75rem' }}>
                    <AlertTriangle size={16} color={n.type === 'emergency' ? 'var(--danger)' : 'var(--warning)'} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <p style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{n.title}</p>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>{n.message}</p>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-4)', marginTop: '0.375rem' }}>{new Date(n.timestamp).toLocaleTimeString()}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* SETTINGS */}
          {tab === 'settings' && (
            <div style={{ maxWidth: 480 }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '1rem' }}>⚙️ Complex Settings</h2>
              <div className="card" style={{ padding: '1.25rem', borderRadius: 14, display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                {[
                  ['Name', complex?.name ?? ''],
                  ['City', complex?.city ?? ''],
                  ['Address', complex?.address ?? ''],
                  ['Total Capacity', complex?.totalCapacity?.toString() ?? ''],
                  ['Floors', complex?.floors?.toString() ?? ''],
                ].map(([label, value]) => (
                  <div key={label}>
                    <label className="label-xs" style={{ display: 'block', marginBottom: '0.375rem' }}>{label}</label>
                    <input className="input-dark" defaultValue={value} style={{ width: '100%' }} readOnly />
                  </div>
                ))}
                <p style={{ fontSize: '0.75rem', color: 'var(--text-4)' }}>Settings editing coming in v2.1 — contact support to update complex configuration.</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
