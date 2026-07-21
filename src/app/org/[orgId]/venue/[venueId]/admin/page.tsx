'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Activity, AlertTriangle, ArrowLeft, Bell, Calendar, CheckCircle,
  ChevronRight, Loader2, MapPin, Play, Plus, Send, Shield, Square, Users,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCrowdData, useNotifications, useVenueData } from '@/hooks/useRealtimeData';
import { getVenueEvents, createEvent, updateEvent, subscribeToIncidents, resolveIncident } from '@/lib/firestore';
import { EVENT_PHASES, getNextPhaseId, PHASE_ORDER } from '@/lib/crowdEngine';
import { VenueEvent, Incident, EventPhaseId } from '@/types';
import { fmtCount, fmtPct, fmtDensityColor } from '@/lib/formatters';
import { ensureVenueSeeded } from '@/lib/seedFirebase';
import LiveRegion from '@/components/LiveRegion';
import dynamic from 'next/dynamic';
const QRCode   = dynamic(() => import('react-qr-code'), { ssr: false });
const VenueMap = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div style={{ height: 280, borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: '0.8125rem' }}>
      Loading interactive map...
    </div>
  ),
});

const EVENT_PHASE_ORDER: EventPhaseId[] = ['doors_open','pre_game','first_half','halftime','second_half','post_game','egress'];
type Tab = 'overview' | 'events' | 'incidents' | 'broadcast' | 'qr';
const NAV: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'overview',  label: 'Overview',  icon: Shield },
  { id: 'events',    label: 'Events',    icon: Calendar },
  { id: 'incidents', label: 'Incidents', icon: AlertTriangle },
  { id: 'broadcast', label: 'Broadcast', icon: Bell },
  { id: 'qr',        label: 'Guest QR',  icon: Users },
];

const SEVERITY_COLORS: Record<string, string> = { low: 'var(--success)', medium: 'var(--warning)', high: 'var(--warning)', critical: 'var(--danger)' };

export default function PerVenueAdmin() {
  const { orgId, venueId } = useParams<{ orgId: string; venueId: string }>();
  const { venue, loading: venueLoading } = useVenueData(venueId);
  const { crowd }        = useCrowdData(venueId);
  const { notifications, unreadCount } = useNotifications(venueId);

  const [events,     setEvents]     = useState<VenueEvent[]>([]);
  const [incidents,  setIncidents]  = useState<Incident[]>([]);
  const [liveEvent,  setLiveEvent]  = useState<VenueEvent | null>(null);
  const [simRunning, setSimRunning] = useState(false);
  const [simLoading, setSimLoading] = useState(false);
  const [tab,        setTab]        = useState<Tab>('overview');
  const [newEvent,   setNewEvent]   = useState({ name: '', type: 'nfl' as VenueEvent['type'], date: '', attendance: '' });
  const [broadcast,  setBroadcast]  = useState({ section: 'all', message: '', type: 'info' as 'info' | 'warning' | 'emergency' });
  const [sent,       setSent]       = useState(false);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => { if (venueId) ensureVenueSeeded(venueId); }, [venueId]);
  useEffect(() => {
    if (!venueId) return;
    getVenueEvents(venueId).then(e => { setEvents(e); setLiveEvent(e.find(ev => ev.status === 'live') ?? null); });
    return subscribeToIncidents(venueId, setIncidents);
  }, [venueId]);

  const startSim = async () => {
    if (!liveEvent || simRunning) return;
    setSimLoading(true);
    const r = await fetch(`/api/events/${liveEvent.id}/simulate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start', event: liveEvent, venueId }) });
    const d = await r.json();
    if (d.ok) { setSimRunning(true); setAnnouncement('Simulation started'); }
    setSimLoading(false);
  };

  const stopSim = async () => {
    if (!liveEvent) return;
    setSimLoading(true);
    await fetch(`/api/events/${liveEvent.id}/simulate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'stop' }) });
    setSimRunning(false);
    setSimLoading(false);
  };

  const advancePhase = async () => {
    if (!liveEvent?.currentPhaseId) return;
    const next = getNextPhaseId(liveEvent.currentPhaseId);
    if (!next) return;
    await fetch(`/api/events/${liveEvent.id}/simulate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'advance_phase', event: liveEvent }) });
    setLiveEvent(e => e ? { ...e, currentPhaseId: next } : e);
    setAnnouncement(`Phase: ${EVENT_PHASES[next].label}`);
  };

  const goLive = async () => {
    if (!newEvent.name || !newEvent.date) return;
    const eventId = await createEvent({ venueId, orgId, name: newEvent.name, type: newEvent.type, date: new Date(newEvent.date).getTime(), expectedAttendance: parseInt(newEvent.attendance) || (venue?.capacity ?? 50000), status: 'upcoming', weatherRiskFactor: 0 });
    await updateEvent(eventId, { status: 'live' });
    const created: VenueEvent = { id: eventId, venueId, orgId, name: newEvent.name, type: newEvent.type, date: new Date(newEvent.date).getTime(), expectedAttendance: parseInt(newEvent.attendance) || (venue?.capacity ?? 50000), status: 'live', weatherRiskFactor: 0, createdAt: Date.now() };
    setLiveEvent(created);
    setEvents(prev => [created, ...prev]);
    setTab('overview');
    await fetch(`/api/events/${eventId}/simulate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start', event: created, venueId }) });
    setSimRunning(true);
  };

  const sendBroadcast = async () => {
    if (!broadcast.message) return;
    await fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...broadcast, venueId }) });
    setSent(true);
    setTimeout(() => setSent(false), 3000);
    setBroadcast(b => ({ ...b, message: '' }));
  };

  if (venueLoading) return <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={20} color="var(--brand-light)" style={{ animation: 'spin 1s linear infinite' }} /></div>;

  const avgDensity  = crowd ? Object.values(crowd.zones).reduce((s, z) => s + z.density, 0) / Math.max(Object.values(crowd.zones).length, 1) : 0;
  const totalCount  = crowd ? Object.values(crowd.zones).reduce((s, z) => s + z.count, 0) : 0;
  const critZones   = crowd ? Object.values(crowd.zones).filter(z => z.density > 0.85).length : 0;
  const phaseIdx    = liveEvent?.currentPhaseId ? EVENT_PHASE_ORDER.indexOf(liveEvent.currentPhaseId) : -1;
  const openIncidents = incidents.filter(i => i.status === 'open').length;
  const guestQrUrl  = typeof window !== 'undefined' ? `${window.location.origin}/g/${venueId}` : `/g/${venueId}`;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', color: 'var(--text-1)' }}>
      <LiveRegion message={announcement} level="polite" />

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside style={{ width: 220, flexShrink: 0, background: 'var(--surface)', borderRight: '1px solid var(--border)', position: 'fixed', top: 0, bottom: 0, display: 'flex', flexDirection: 'column', zIndex: 40 }}>
        {/* Header */}
        <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid var(--border)' }}>
          <Link href={`/org/${orgId}`} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', textDecoration: 'none', color: 'var(--text-3)', fontSize: '0.8125rem', marginBottom: '0.875rem' }}>
            <ArrowLeft size={13} /> All venues
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={16} color="var(--brand-light)" />
            <span style={{ fontWeight: 600, fontSize: '0.9375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{venue?.name ?? venueId}</span>
          </div>
          {liveEvent && <div style={{ marginTop: '0.5rem' }}><span className="live-badge"><span className="live-dot" />Live event</span></div>}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '0.5rem' }}>
          {NAV.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)} className={`nav-item${tab === id ? ' active' : ''}`} aria-current={tab === id ? 'page' : undefined}>
              <Icon size={15} />
              <span>{label}</span>
              {id === 'incidents' && openIncidents > 0 && <span style={{ marginLeft: 'auto', background: 'var(--danger)', color: '#fff', borderRadius: '50%', width: 18, height: 18, fontSize: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{openIncidents}</span>}
              {id === 'broadcast' && unreadCount > 0 && <span style={{ marginLeft: 'auto', background: 'var(--warning)', color: '#000', borderRadius: '50%', width: 18, height: 18, fontSize: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unreadCount}</span>}
            </button>
          ))}
        </nav>

        {/* Simulation controls */}
        {liveEvent && (
          <div style={{ padding: '0.75rem', borderTop: '1px solid var(--border)' }}>
            <p className="label-xs" style={{ marginBottom: '0.5rem' }}>Crowd Simulation</p>
            {simRunning ? (
              <div style={{ display: 'flex', gap: '0.375rem' }}>
                <button onClick={stopSim} disabled={simLoading} className="btn-ghost" style={{ flex: 1, justifyContent: 'center', fontSize: '0.75rem', padding: '0.375rem', borderColor: 'var(--danger-border)', color: 'var(--danger)' }}>
                  <Square size={11} /> Stop
                </button>
                <button onClick={advancePhase} disabled={simLoading} className="btn-ghost" style={{ flex: 1, justifyContent: 'center', fontSize: '0.75rem', padding: '0.375rem' }}>
                  <ChevronRight size={11} /> Next
                </button>
              </div>
            ) : (
              <button onClick={startSim} disabled={simLoading} className="btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: '0.8125rem', padding: '0.4375rem' }}>
                {simLoading ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <><Play size={13} /> Go Live</>}
              </button>
            )}
          </div>
        )}
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main style={{ marginLeft: 220, flex: 1, padding: '2rem', minWidth: 0 }}>

        {/* ═ OVERVIEW ═══════════════════════════════════════════════════════ */}
        {tab === 'overview' && (<>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.025em', marginBottom: '0.25rem' }}>{venue?.name}</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-3)', marginBottom: '1.5rem' }}><MapPin size={12} style={{ display: 'inline', marginRight: 3 }} />{venue?.city}</p>

          {/* Live event banner */}
          {liveEvent && (
            <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 10, padding: '0.875rem 1.125rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <span className="live-badge"><span className="live-dot" />Live</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{liveEvent.name}</p>
                {liveEvent.currentPhaseId && <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.125rem' }}>Phase: {EVENT_PHASES[liveEvent.currentPhaseId].label}</p>}
              </div>
              {/* Phase pills */}
              <div style={{ display: 'flex', gap: '3px' }}>
                {EVENT_PHASE_ORDER.map((p, i) => (
                  <div key={p} title={EVENT_PHASES[p].label} style={{ width: 20, height: 4, borderRadius: 2, background: i < phaseIdx ? 'var(--success)' : i === phaseIdx ? 'var(--brand)' : 'var(--border)' }} />
                ))}
              </div>
            </div>
          )}

          {/* KPI row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {[
              { label: 'Total guests',   value: fmtCount(totalCount),   color: 'var(--text-1)' },
              { label: 'Avg occupancy',  value: fmtPct(avgDensity),     color: fmtDensityColor(avgDensity) },
              { label: 'Critical zones', value: critZones,              color: critZones > 0 ? 'var(--danger)' : 'var(--text-1)' },
              { label: 'Open incidents', value: openIncidents,          color: openIncidents > 0 ? 'var(--warning)' : 'var(--text-1)' },
            ].map(k => (
              <div key={k.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem' }}>
                <div style={{ fontSize: '1.375rem', fontWeight: 700, color: k.color, letterSpacing: '-0.02em' }}>{k.value}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Interactive Live Map */}
          {venue && (
            <div style={{ height: 320, width: '100%', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
              <VenueMap venue={venue} crowd={crowd ?? { timestamp: Date.now(), venueId: venue.id, totalCount, zones: {} }} />
            </div>
          )}

          {/* Zone table */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '0.875rem 1.125rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '0.875rem', fontWeight: 600 }}>Zone Status</h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Updates every 30s</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  {['Zone', 'Guests', 'Occupancy', 'Safety', 'Accessible'].map(h => (
                    <th key={h} style={{ padding: '0.5rem 1.125rem', textAlign: 'left', fontSize: '0.6875rem', color: 'var(--text-3)', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {venue?.zones.map((zone, i) => {
                  const zData   = crowd?.zones[zone.id];
                  const density = zData?.density ?? zone.density;
                  const count   = zData?.count   ?? zone.currentCount;
                  const safety  = density > 0.85 ? 'critical' : density > 0.7 ? 'warning' : 'safe';
                  return (
                    <tr key={zone.id} style={{ borderTop: '1px solid var(--border)', background: i % 2 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                      <td style={{ padding: '0.625rem 1.125rem', fontSize: '0.875rem', fontWeight: 500 }}>{zone.name}</td>
                      <td style={{ padding: '0.625rem 1.125rem', fontSize: '0.875rem', color: 'var(--text-2)', fontFamily: 'monospace' }}>{fmtCount(count)}</td>
                      <td style={{ padding: '0.625rem 1.125rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ width: 56, height: 4, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${density * 100}%`, background: fmtDensityColor(density), transition: 'width 0.5s' }} />
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-2)', fontFamily: 'monospace', width: 38 }}>{fmtPct(density)}</span>
                        </div>
                      </td>
                      <td style={{ padding: '0.625rem 1.125rem' }}>
                        <span className={`chip chip-${safety === 'critical' ? 'red' : safety === 'warning' ? 'amber' : 'green'}`}>{safety}</span>
                      </td>
                      <td style={{ padding: '0.625rem 1.125rem', fontSize: '0.875rem' }}>
                        {zone.isStepFree ? <span style={{ color: 'var(--success)' }}>Yes</span> : <span style={{ color: 'var(--text-4)' }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>)}

        {/* ═ EVENTS ═════════════════════════════════════════════════════════ */}
        {tab === 'events' && (<>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.025em', marginBottom: '1.5rem' }}>Events</h1>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem', marginBottom: '1.25rem' }}>
            <h2 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem' }}>Create event</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.875rem' }}>
              <input className="input-dark" placeholder="Event name" value={newEvent.name} onChange={e => setNewEvent(n => ({ ...n, name: e.target.value }))} style={{ gridColumn: '1/-1' }} />
              <select className="input-dark" value={newEvent.type} onChange={e => setNewEvent(n => ({ ...n, type: e.target.value as VenueEvent['type'] }))}>
                {['nfl', 'nba', 'concert', 'soccer', 'other'].map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
              </select>
              <input type="datetime-local" className="input-dark" value={newEvent.date} onChange={e => setNewEvent(n => ({ ...n, date: e.target.value }))} />
              <input className="input-dark" placeholder={`Expected attendance`} value={newEvent.attendance} onChange={e => setNewEvent(n => ({ ...n, attendance: e.target.value }))} style={{ gridColumn: '1/-1' }} />
            </div>
            <button onClick={goLive} disabled={!newEvent.name || !newEvent.date} className="btn-primary" style={{ gap: '0.375rem', opacity: !newEvent.name || !newEvent.date ? 0.5 : 1 }}>
              <Play size={14} /> Create &amp; Go Live
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {events.map(ev => (
              <div key={ev.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.875rem 1.125rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                <span className={`chip chip-${ev.status === 'live' ? 'green' : ev.status === 'upcoming' ? 'amber' : 'purple'}`}>{ev.status}</span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{ev.name}</span>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-3)', marginLeft: '0.75rem' }}>{new Date(ev.date).toLocaleString()}</span>
                </div>
                {ev.status === 'live' && (
                  <button onClick={advancePhase} className="btn-ghost" style={{ fontSize: '0.8125rem', gap: '0.25rem', padding: '0.375rem 0.75rem' }}>
                    <ChevronRight size={13} /> Next phase
                  </button>
                )}
              </div>
            ))}
            {events.length === 0 && <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>No events yet.</p>}
          </div>
        </>)}

        {/* ═ INCIDENTS ══════════════════════════════════════════════════════ */}
        {tab === 'incidents' && (<>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.025em', marginBottom: '1.5rem' }}>Incidents</h1>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {incidents.map(inc => (
              <div key={inc.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.875rem 1.125rem', borderLeft: `3px solid ${SEVERITY_COLORS[inc.severity] ?? 'var(--border)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', marginBottom: '0.375rem', flexWrap: 'wrap' }}>
                      <span className={`chip chip-${inc.severity === 'critical' ? 'red' : inc.severity === 'high' ? 'amber' : 'blue'}`}>{inc.severity}</span>
                      <span className="chip">{inc.type}</span>
                    </div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-1)', marginBottom: '0.25rem' }}>{inc.description}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{new Date(inc.reportedAt).toLocaleTimeString()} · {inc.status}</p>
                  </div>
                  {inc.status !== 'resolved' && (
                    <button onClick={() => resolveIncident(inc.id)} className="btn-ghost" style={{ fontSize: '0.8125rem', padding: '0.375rem 0.75rem', gap: '0.25rem', flexShrink: 0 }}>
                      <CheckCircle size={13} /> Resolve
                    </button>
                  )}
                </div>
              </div>
            ))}
            {incidents.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-3)' }}>
                <CheckCircle size={32} color="var(--success)" style={{ margin: '0 auto 0.75rem', opacity: 0.6 }} />
                <p style={{ fontSize: '0.875rem' }}>No incidents. All clear.</p>
              </div>
            )}
          </div>
        </>)}

        {/* ═ BROADCAST ══════════════════════════════════════════════════════ */}
        {tab === 'broadcast' && (<>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.025em', marginBottom: '1.5rem' }}>Broadcast</h1>
          <div style={{ maxWidth: 520, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.5rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              <label className="label-xs" style={{ display: 'block', marginBottom: '0.5rem' }}>Type</label>
              <div style={{ display: 'flex', gap: '0.375rem' }}>
                {(['info', 'warning', 'emergency'] as const).map(t => (
                  <button key={t} onClick={() => setBroadcast(b => ({ ...b, type: t }))} className={broadcast.type === t ? 'btn-primary' : 'btn-ghost'} style={{ fontSize: '0.8125rem', padding: '0.375rem 0.875rem' }}>{t}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label className="label-xs" style={{ display: 'block', marginBottom: '0.5rem' }}>Target zone</label>
              <select className="input-dark" value={broadcast.section} onChange={e => setBroadcast(b => ({ ...b, section: e.target.value }))}>
                <option value="all">All zones</option>
                {venue?.sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <label className="label-xs" style={{ display: 'block', marginBottom: '0.5rem' }}>Message</label>
              <textarea className="input-dark" rows={4} placeholder="Type your message to guests..." value={broadcast.message} onChange={e => setBroadcast(b => ({ ...b, message: e.target.value }))} style={{ resize: 'vertical' }} />
            </div>
            <button onClick={sendBroadcast} disabled={!broadcast.message} className={sent ? 'btn-ghost' : 'btn-primary'} style={{ gap: '0.375rem', opacity: !broadcast.message ? 0.5 : 1 }}>
              {sent ? <><CheckCircle size={14} /> Sent</> : <><Send size={14} /> Send to guests</>}
            </button>
          </div>
        </>)}

        {/* ═ GUEST QR ═══════════════════════════════════════════════════════ */}
        {tab === 'qr' && (<>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.025em', marginBottom: '0.375rem' }}>Guest QR Code</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-3)', marginBottom: '2rem' }}>Display at your venue entrance. Guests scan to access live crowd info — no app required.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2rem', alignItems: 'start' }}>
            <div style={{ background: '#fff', padding: '1.25rem', borderRadius: 12, display: 'inline-block' }}>
              <QRCode value={guestQrUrl} size={180} />
              <p style={{ textAlign: 'center', marginTop: '0.75rem', fontSize: '0.65rem', color: '#666', fontFamily: 'monospace', wordBreak: 'break-all' }}>{guestQrUrl}</p>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem' }}>Guest experience includes</h3>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {['Real-time zone crowd map', 'Wait times for all amenities', 'AI navigation in 6 languages', 'Emergency alerts (screen-reader accessible)', 'Step-free routing for wheelchair users'].map(f => (
                  <li key={f} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-2)', alignItems: 'flex-start' }}>
                    <CheckCircle size={14} color="var(--success)" style={{ marginTop: 2, flexShrink: 0 }} /> {f}
                  </li>
                ))}
              </ul>
              <a href={guestQrUrl} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ marginTop: '1.25rem', display: 'inline-flex', gap: '0.375rem', textDecoration: 'none', fontSize: '0.875rem' }}>
                <Users size={14} /> Preview guest view
              </a>
            </div>
          </div>
        </>)}
      </main>
    </div>
  );
}
