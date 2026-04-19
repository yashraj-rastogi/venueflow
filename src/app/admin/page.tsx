'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Activity, Shield, Users, Bell, Settings, ArrowLeft, Send, CheckCircle, AlertTriangle, Zap, Loader2 } from 'lucide-react';
import { fmtCount, fmtPct, fmtDensityColor } from '@/lib/formatters';
import { useAuth } from '@/hooks/useAuth';
import { useCrowdData, useVenueData } from '@/hooks/useRealtimeData';
import { ensureVenueSeeded } from '@/lib/seedFirebase';

const DEFAULT_VENUE_ID = 'metlife-stadium';

export default function AdminPage() {
  const router = useRouter();
  const { user, isGuest, loading } = useAuth();
  const { venue, loading: venueLoading } = useVenueData(DEFAULT_VENUE_ID);
  const { crowd } = useCrowdData(DEFAULT_VENUE_ID);

  const [notification, setNotification] = useState({ section: 'all', message: '', type: 'info' });
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [amenityStates, setAmenityStates] = useState<Record<string, boolean>>({});

  // Seed RTDB on first load
  useEffect(() => {
    ensureVenueSeeded(DEFAULT_VENUE_ID);
  }, []);

  // Initialise amenity toggle state from live venue data
  useEffect(() => {
    if (venue?.amenities?.length) {
      setAmenityStates(prev => {
        if (Object.keys(prev).length > 0) return prev; // don't overwrite user changes
        return Object.fromEntries(venue.amenities.map(a => [a.id, a.isOpen]));
      });
    }
  }, [venue]);

  // Auth guard — redirect to /login (not home) so user can sign in and return
  useEffect(() => {
    if (!loading && (!user || isGuest)) {
      router.push('/login?redirect=/admin');
    }
  }, [user, isGuest, loading, router]);

  if (loading || venueLoading || !user || isGuest) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={28} color="var(--blue-soft)" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  const handleSend = async () => {
    if (!notification.message || busy) return;
    setBusy(true);
    try {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venueId: DEFAULT_VENUE_ID,
          section: notification.section,
          message: notification.message,
          type: notification.type,
          title: 'Staff Broadcast',
        }),
      });
      setSent(true);
      setTimeout(() => setSent(false), 3000);
      setNotification(prev => ({ ...prev, message: '' }));
    } catch {}
    setBusy(false);
  };

  const toggleAmenity = (id: string) => {
    setAmenityStates(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const crowdZones = crowd.zones ?? {};
  const totalCount = Object.values(crowdZones).reduce((s, z) => s + (z.count ?? 0), 0);
  const avgDensity = Object.values(crowdZones).length
    ? Object.values(crowdZones).reduce((s, z) => s + (z.density ?? 0), 0) / Object.values(crowdZones).length
    : 0;

  const typeEmoji: Record<string, string> = {
    restroom: '🚻', concession: '🍔', merchandise: '🛍️', gate: '🚪', medical: '🏥', elevator: '🛗',
  };

  const notifTypeColor: Record<string, string> = {
    info: 'var(--blue-glow)', warning: 'var(--amber)', success: 'var(--green)', emergency: 'var(--red)',
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Glow */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse 80% 40% at 50% -5%, rgba(99,102,241,0.1) 0%, transparent 70%)',
      }} />
      <div className="bg-grid" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, opacity: 0.3 }} />

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(8,12,24,0.9)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
        padding: '0 1.75rem',
        height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/" style={{ color: 'var(--text-3)', display: 'flex', textDecoration: 'none' }}>
            <button className="btn-ghost" style={{ padding: '0.4rem 0.75rem', gap: '0.375rem' }}>
              <ArrowLeft size={14} /> Back
            </button>
          </Link>
          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: 'rgba(99,102,241,0.15)',
              border: '1px solid rgba(99,102,241,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Shield size={14} color="var(--indigo)" />
            </div>
            <div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-1)' }}>Admin Console</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-4)' }}>Staff operations dashboard</div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <span className="chip chip-purple">
            <Shield size={9} /> Staff Access
          </span>
          <span className="live-badge"><span className="live-dot" />Live Data</span>
        </div>
      </header>

      <main style={{ position: 'relative', zIndex: 1, maxWidth: 1100, margin: '0 auto', padding: '2rem 1.75rem 4rem' }}>

        {/* ── KPI Strip ─────────────────────────────────────────────────────── */}
        <div className="anim-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
          {[
            { label: 'Total Inside', value: fmtCount(totalCount), color: 'var(--blue-soft)', icon: Users, sub: `of ${((venue.capacity ?? 0) / 1000).toFixed(0)}k capacity` },
            { label: 'Avg Density', value: fmtPct(avgDensity), color: fmtDensityColor(avgDensity), icon: Activity, sub: avgDensity > 0.7 ? '⚠ Elevated — monitor' : 'Within normal range' },
            { label: 'Open Amenities', value: `${Object.values(amenityStates).filter(Boolean).length}/${venue.amenities?.length ?? 0}`, color: 'var(--green)', icon: CheckCircle, sub: 'All systems operational' },
            { label: 'Active Zones', value: (venue.zones?.length ?? 0).toString(), color: 'var(--amber)', icon: Zap, sub: 'All zones monitored' },
          ].map(({ label, value, color, icon: Icon, sub }) => (
            <div key={label} className="card-hi" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
                <span className="label-xs">{label}</span>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: `${color}15`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={13} color={color} />
                </div>
              </div>
              <div className="stat-xl mono" style={{ color, marginBottom: 4 }}>{value}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-4)' }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* ── Two-column ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>

          {/* Zone Overview */}
          <div className="card-hi" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Activity size={14} color="var(--blue-glow)" />
                </div>
                <div>
                  <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-1)' }}>Zone Overview</h2>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>Live density per zone</p>
                </div>
              </div>
              <button 
                onClick={() => fetch('/api/crowd/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ venueId: DEFAULT_VENUE_ID })})}
                className="btn-ghost" 
                style={{ padding: '0.35rem 0.6rem', fontSize: '0.7rem', color: 'var(--blue-glow)', border: '1px solid rgba(59,130,246,0.3)', gap: '0.4rem' }}
                title="Simulate random crowd shift"
              >
                <Activity size={12} /> Shift Crowd
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {(venue.zones ?? []).map(zone => {
                const zd = crowdZones[zone.id] ?? { density: 0, count: 0, capacity: zone.capacity };
                const color = fmtDensityColor(zd.density);
                return (
                  <div key={zone.id} style={{ background: 'var(--bg-1)', borderRadius: 10, padding: '0.875rem 1rem', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-1)' }}>{zone.name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{fmtCount(zd.count)}/{fmtCount(zd.capacity)}</span>
                        <span className="mono" style={{ fontSize: '0.9rem', fontWeight: 700, color }}>{fmtPct(zd.density)}</span>
                      </div>
                    </div>
                    <div style={{ height: 6, background: 'var(--bg-5)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 99,
                        width: fmtPct(zd.density),
                        background: `linear-gradient(90deg, ${color}88, ${color})`,
                        boxShadow: `0 0 8px ${color}77`,
                      }} />
                    </div>
                    <div style={{ marginTop: '0.5rem' }}>
                      <span className={`chip ${zd.density > 0.7 ? 'chip-red' : zd.density > 0.4 ? 'chip-amber' : 'chip-green'}`}>
                        {zd.density > 0.7 ? '⚠ High' : zd.density > 0.4 ? 'Moderate' : '✓ Clear'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Amenity Control */}
          <div className="card-hi" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1.25rem' }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Settings size={14} color="var(--indigo)" />
              </div>
              <div>
                <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-1)' }}>Amenity Control</h2>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>Toggle amenity open/closed status</p>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {(venue.amenities ?? []).map(amenity => {
                const isOpen = amenityStates[amenity.id];
                return (
                  <div key={amenity.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'var(--bg-1)', borderRadius: 10, padding: '0.75rem 1rem',
                    border: `1px solid ${isOpen ? 'rgba(16,185,129,0.15)' : 'var(--border)'}`,
                    transition: 'border-color 0.2s',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <span style={{ fontSize: 18 }}>{typeEmoji[amenity.type] ?? '📍'}</span>
                      <div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-1)' }}>{amenity.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-4)', marginTop: 1 }}>
                          {amenity.type} · {amenity.waitTime}m wait
                        </div>
                      </div>
                    </div>
                    <button onClick={() => toggleAmenity(amenity.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <div style={{
                        width: 40, height: 22, borderRadius: 99,
                        background: isOpen ? 'var(--green)' : 'var(--bg-5)',
                        border: isOpen ? '1px solid rgba(16,185,129,0.4)' : '1px solid var(--border)',
                        position: 'relative', transition: 'all 0.25s ease',
                        boxShadow: isOpen ? '0 0 10px rgba(16,185,129,0.3)' : 'none',
                      }}>
                        <div style={{
                          position: 'absolute', top: 2, left: isOpen ? 20 : 2,
                          width: 16, height: 16, borderRadius: '50%',
                          background: '#fff',
                          transition: 'left 0.25s ease',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                        }} />
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isOpen ? 'var(--green)' : 'var(--text-4)', minWidth: 38 }}>
                        {isOpen ? 'Open' : 'Closed'}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Notification Sender ────────────────────────────────────────────── */}
        <div className="card-hi" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1.25rem' }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={14} color="var(--amber)" />
            </div>
            <div>
              <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-1)' }}>Broadcast Notification</h2>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>Send a push alert to all or specific sections</p>
            </div>
          </div>

          {sent && (
            <div style={{ padding: '0.75rem 1rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle size={15} color="var(--green)" />
              <span style={{ fontSize: '0.8125rem', color: 'var(--green)', fontWeight: 600 }}>Notification sent successfully!</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <div className="label-xs" style={{ marginBottom: 6 }}>Target Audience</div>
              <select className="input-dark"
                value={notification.section} onChange={e => setNotification(p => ({ ...p, section: e.target.value }))}>
                <option value="all">All Attendees</option>
                {(venue.sections ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <div className="label-xs" style={{ marginBottom: 6 }}>Alert Type</div>
              <select className="input-dark"
                value={notification.type} onChange={e => setNotification(p => ({ ...p, type: e.target.value }))}>
                {[['info', 'ℹ Info'], ['warning', '⚠ Warning'], ['success', '✓ Success'], ['emergency', '🚨 Emergency']].map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="label-xs" style={{ marginBottom: 6 }}>Message</div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <input
                type="text"
                className="input-dark"
                placeholder="Type your broadcast message here..."
                value={notification.message}
                onChange={e => setNotification(p => ({ ...p, message: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                style={{ flex: 1 }}
              />
              <button
                onClick={handleSend}
                disabled={busy}
                className="btn-glow"
                style={{ borderRadius: 10, opacity: sent || busy ? 0.6 : 1, cursor: sent || busy ? 'not-allowed' : 'pointer' }}
              >
                <Send size={15} />
                {busy ? 'Sending...' : sent ? 'Sent!' : 'Broadcast'}
              </button>
            </div>
          </div>

          {/* Type preview */}
          {notification.type && (
            <div style={{ marginTop: '0.875rem', padding: '0.625rem 0.875rem', borderRadius: 8, background: `${notifTypeColor[notification.type]}10`, border: `1px solid ${notifTypeColor[notification.type]}25`, display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <AlertTriangle size={12} color={notifTypeColor[notification.type]} />
              <span style={{ fontSize: '0.75rem', color: notifTypeColor[notification.type] }}>
                Preview: This will appear as a <strong>{notification.type}</strong> alert to {notification.section === 'all' ? 'all attendees' : notification.section}.
              </span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
