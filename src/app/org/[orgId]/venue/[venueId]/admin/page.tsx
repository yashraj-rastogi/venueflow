'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Activity, AlertTriangle, ArrowLeft, Bell, Calendar, CheckCircle,
  ChevronRight, Loader2, MapPin, Play, Plus, Send, Shield, Square, Trash2, Users,
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
  const [newEvent,   setNewEvent]   = useState({ name: '', type: 'nfl' as VenueEvent['type'], date: '', attendance: '', description: '', specialInstructions: '' });
  const [broadcast,  setBroadcast]  = useState({ title: '', section: 'all', message: '', type: 'info' as 'info' | 'warning' | 'emergency' });
  const [sent,       setSent]       = useState(false);
  const [copiedQr,   setCopiedQr]   = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const sendBroadcast = async () => {
    if (!broadcast.message) return;
    await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...broadcast, venueId }),
    });
    setSent(true);
    setTimeout(() => setSent(false), 3000);
    setBroadcast(b => ({ ...b, title: '', message: '' }));
  };

  const deleteNotification = async (notifId?: string) => {
    if (notifId && !confirm('Delete this broadcast message?')) return;
    if (!notifId && !confirm(`Clear all broadcast notifications for ${venue?.name ?? 'this venue'}?`)) return;

    await fetch('/api/notify', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ venueId, notifId }),
    });
  };

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

  const createUpcomingEvent = async () => {
    if (!newEvent.name || !newEvent.date) return;
    const eventId = await createEvent({
      venueId, orgId, name: newEvent.name, type: newEvent.type,
      date: new Date(newEvent.date).getTime(),
      expectedAttendance: parseInt(newEvent.attendance) || (venue?.capacity ?? 50000),
      description: newEvent.description,
      specialInstructions: newEvent.specialInstructions,
      status: 'upcoming', weatherRiskFactor: 0
    });
    const created: VenueEvent = {
      id: eventId, venueId, orgId, name: newEvent.name, type: newEvent.type,
      date: new Date(newEvent.date).getTime(),
      expectedAttendance: parseInt(newEvent.attendance) || (venue?.capacity ?? 50000),
      description: newEvent.description,
      specialInstructions: newEvent.specialInstructions,
      status: 'upcoming', weatherRiskFactor: 0, createdAt: Date.now()
    };
    setEvents(prev => [created, ...prev]);
    setNewEvent({ name: '', type: 'nfl', date: '', attendance: '', description: '', specialInstructions: '' });
    setAnnouncement(`Event "${created.name}" created.`);
  };

  const goLive = async () => {
    if (!newEvent.name || !newEvent.date) return;
    const eventId = await createEvent({
      venueId, orgId, name: newEvent.name, type: newEvent.type,
      date: new Date(newEvent.date).getTime(),
      expectedAttendance: parseInt(newEvent.attendance) || (venue?.capacity ?? 50000),
      description: newEvent.description,
      specialInstructions: newEvent.specialInstructions,
      status: 'upcoming', weatherRiskFactor: 0
    });
    await updateEvent(eventId, { status: 'live' });
    const created: VenueEvent = {
      id: eventId, venueId, orgId, name: newEvent.name, type: newEvent.type,
      date: new Date(newEvent.date).getTime(),
      expectedAttendance: parseInt(newEvent.attendance) || (venue?.capacity ?? 50000),
      description: newEvent.description,
      specialInstructions: newEvent.specialInstructions,
      status: 'live', weatherRiskFactor: 0, createdAt: Date.now()
    };
    setLiveEvent(created);
    setEvents(prev => [created, ...prev]);
    setNewEvent({ name: '', type: 'nfl', date: '', attendance: '', description: '', specialInstructions: '' });
    setTab('overview');
    await fetch(`/api/events/${eventId}/simulate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start', event: created, venueId }) });
    setSimRunning(true);
  };

  const setEventStatus = async (ev: VenueEvent, newStatus: 'live' | 'ended' | 'upcoming') => {
    await updateEvent(ev.id, { status: newStatus });
    setEvents(prev => prev.map(e => e.id === ev.id ? { ...e, status: newStatus } : newStatus === 'live' && e.status === 'live' ? { ...e, status: 'ended' } : e));
    if (newStatus === 'live') {
      const liveEv = { ...ev, status: 'live' as const };
      setLiveEvent(liveEv);
      fetch(`/api/events/${ev.id}/simulate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start', event: liveEv, venueId }) });
      setSimRunning(true);
      setAnnouncement(`Event "${ev.name}" is now Live.`);
    } else if (newStatus === 'ended' && liveEvent?.id === ev.id) {
      setLiveEvent(null);
      setSimRunning(false);
      setAnnouncement(`Event "${ev.name}" ended.`);
    }
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
          <Link
            href={`/org/${orgId}/venue/${venueId}/events`}
            className="nav-item"
            style={{ textDecoration: 'none', color: 'var(--brand-light)', background: 'color-mix(in srgb, var(--brand) 12%, transparent)', marginBottom: '0.5rem' }}
          >
            <Calendar size={15} />
            <span style={{ fontWeight: 600 }}>Events Hub & QR</span>
          </Link>

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

          {/* Quick Actions Strip (Phase 6c) */}
          <div style={{ display: 'flex', gap: '0.625rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <button onClick={() => setTab('broadcast')} className="btn-glow" style={{ fontSize: '0.8125rem', padding: '0.5rem 0.875rem', height: 'auto', gap: 6 }}>
              📢 Send Alert
            </button>
            <button onClick={() => setTab('events')} className="btn-glow" style={{ fontSize: '0.8125rem', padding: '0.5rem 0.875rem', height: 'auto', gap: 6 }}>
              🎟️ Manage Events
            </button>
            <button onClick={() => setTab('qr')} className="btn-ghost" style={{ fontSize: '0.8125rem', padding: '0.5rem 0.875rem', height: 'auto', gap: 6 }}>
              📱 Guest QR Code
            </button>
            <Link href={`/staff/${venueId}`} target="_blank" className="btn-ghost" style={{ fontSize: '0.8125rem', padding: '0.5rem 0.875rem', height: 'auto', gap: 6, textDecoration: 'none' }}>
              🛡️ Staff Concourse View
            </Link>
          </div>

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
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.025em', marginBottom: '1.5rem' }}>Events Management</h1>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem' }}>Create New Event</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.875rem' }}>
              <input className="input-dark" placeholder="Event Name (e.g. NY Giants vs Dallas Cowboys)" value={newEvent.name} onChange={e => setNewEvent(n => ({ ...n, name: e.target.value }))} style={{ gridColumn: '1/-1' }} />
              <select className="input-dark" value={newEvent.type} onChange={e => setNewEvent(n => ({ ...n, type: e.target.value as VenueEvent['type'] }))}>
                <option value="nfl">🏈 NFL Football</option>
                <option value="nba">🏀 NBA Basketball</option>
                <option value="concert">🎤 Live Concert</option>
                <option value="soccer">⚽ Soccer Match</option>
                <option value="other">🏟️ Other Event</option>
              </select>
              <input type="datetime-local" className="input-dark" value={newEvent.date} onChange={e => setNewEvent(n => ({ ...n, date: e.target.value }))} />
              <input className="input-dark" placeholder="Expected Attendance (e.g. 80000)" value={newEvent.attendance} onChange={e => setNewEvent(n => ({ ...n, attendance: e.target.value }))} />
              <input className="input-dark" placeholder="Short Event Description (e.g. Regular Season Championship)" value={newEvent.description} onChange={e => setNewEvent(n => ({ ...n, description: e.target.value }))} />
              <input className="input-dark" placeholder="Special Guest Instructions (e.g. Clear bag policy in effect)" value={newEvent.specialInstructions} onChange={e => setNewEvent(n => ({ ...n, specialInstructions: e.target.value }))} style={{ gridColumn: '1/-1' }} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button onClick={createUpcomingEvent} disabled={!newEvent.name || !newEvent.date} className="btn-ghost" style={{ gap: '0.375rem', opacity: !newEvent.name || !newEvent.date ? 0.5 : 1 }}>
                <Plus size={14} /> Save Upcoming Event
              </button>
              <button onClick={goLive} disabled={!newEvent.name || !newEvent.date} className="btn-primary" style={{ gap: '0.375rem', opacity: !newEvent.name || !newEvent.date ? 0.5 : 1 }}>
                <Play size={14} /> Create &amp; Go Live Now
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {events.map(ev => {
              const eventGuestUrl = typeof window !== 'undefined' ? `${window.location.origin}/g/${venueId}?eventId=${ev.id}` : `/g/${venueId}?eventId=${ev.id}`;
              return (
                <div key={ev.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className={`chip chip-${ev.status === 'live' ? 'green' : ev.status === 'upcoming' ? 'amber' : 'purple'}`}>
                        {ev.status === 'live' ? '● LIVE' : ev.status.toUpperCase()}
                      </span>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{ev.name}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.375rem' }}>
                      {ev.status !== 'live' && ev.status !== 'ended' && (
                        <button onClick={() => setEventStatus(ev, 'live')} className="btn-primary" style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem', gap: '0.25rem' }}>
                          <Play size={12} /> Set Live
                        </button>
                      )}
                      {ev.status === 'live' && (
                        <button onClick={() => setEventStatus(ev, 'ended')} className="btn-ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem', color: 'var(--danger)' }}>
                          End Event
                        </button>
                      )}
                      <button onClick={() => { navigator.clipboard.writeText(eventGuestUrl); setAnnouncement('Event link copied'); }} className="btn-ghost" style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }}>
                        Copy Join Link
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.8125rem', color: 'var(--text-3)' }}>
                    <span>📅 {new Date(ev.date).toLocaleString()}</span>
                    <span>👥 {ev.expectedAttendance.toLocaleString()} expected</span>
                    <span>🏷️ {ev.type.toUpperCase()}</span>
                  </div>
                  {ev.specialInstructions && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--brand-light)', background: 'var(--surface-2)', padding: '0.375rem 0.625rem', borderRadius: 6 }}>
                      ℹ️ {ev.specialInstructions}
                    </p>
                  )}
                </div>
              );
            })}
            {events.length === 0 && <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>No events created yet.</p>}
          </div>
        </>)}

        {/* ═ INCIDENTS (Coming Soon View) ═══════════════════════════════════ */}
        {tab === 'incidents' && (<>
          <div style={{ padding: '3rem 1.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 380, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: 20,
              background: 'color-mix(in srgb, var(--warning) 15%, transparent)',
              border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.25rem',
              boxShadow: '0 0 20px color-mix(in srgb, var(--warning) 20%, transparent)',
            }}>
              <AlertTriangle size={32} color="var(--warning)" />
            </div>

            <span className="chip" style={{ background: 'color-mix(in srgb, var(--warning) 15%, transparent)', color: 'var(--warning)', borderColor: 'color-mix(in srgb, var(--warning) 30%, transparent)', marginBottom: '0.75rem', fontSize: '0.75rem', fontWeight: 600 }}>
              🚀 ROADMAP FEATURE • V2.0
            </span>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-1)', marginBottom: '0.375rem' }}>
              Automated Incident & Safety Dispatch
            </h3>

            <p style={{ fontSize: '0.84375rem', color: 'var(--text-3)', maxWidth: 400, lineHeight: 1.5, marginBottom: '1.5rem' }}>
              We are expanding the DIM-ICE safety engine to support multi-agency staff dispatching, live GPS responder tracking, and automated overcrowding containment.
            </p>

            {/* Planned Capabilities */}
            <div style={{ width: '100%', maxWidth: 420, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '1rem 1.25rem', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Planned Incident Engine Capabilities:
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shield size={14} color="var(--warning)" /> Live staff GPS dispatching & task assignment
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={14} color="var(--danger)" /> Automated medical & overcrowding alert routing
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle size={14} color="var(--success)" /> Post-event safety compliance & audit logs
              </div>
            </div>
          </div>
        </>)}

        {/* ═ BROADCAST ══════════════════════════════════════════════════════ */}
        {tab === 'broadcast' && (<>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.025em', marginBottom: 2 }}>
                Live Guest Broadcast Manager
              </h1>
              <p style={{ fontSize: '0.78125rem', color: 'var(--text-3)' }}>
                Target live push announcements to guests in <strong>{venue?.name ?? venueId}</strong>.
              </p>
            </div>

            {notifications.length > 0 && (
              <button
                onClick={() => deleteNotification()}
                className="btn-ghost"
                style={{ fontSize: '0.78125rem', padding: '0.4rem 0.75rem', color: 'var(--danger)', borderColor: 'var(--danger-border, rgba(239, 68, 68, 0.3))' }}
              >
                <Trash2 size={13} /> Clear All Broadcasts
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {/* Form Column */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-1)' }}>New Announcement</h2>

              {/* Severity Type */}
              <div>
                <label className="label-xs" style={{ display: 'block', marginBottom: '0.5rem' }}>Announcement Severity</label>
                <div style={{ display: 'flex', gap: '0.375rem' }}>
                  {(['info', 'warning', 'emergency'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setBroadcast(b => ({ ...b, type: t }))}
                      className={broadcast.type === t ? 'btn-primary' : 'btn-ghost'}
                      style={{ flex: 1, fontSize: '0.75rem', padding: '0.4rem 0.5rem', textTransform: 'uppercase', justifyContent: 'center' }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Zone */}
              <div>
                <label className="label-xs" style={{ display: 'block', marginBottom: '0.5rem' }}>Target Zone / Section</label>
                <select className="input-dark" value={broadcast.section} onChange={e => setBroadcast(b => ({ ...b, section: e.target.value }))} style={{ width: '100%' }}>
                  <option value="all">📢 All Zones & Conourses ({venue?.name})</option>
                  {venue?.zones.map(z => <option key={z.id} value={z.id}>{z.name} (Cap: {z.capacity.toLocaleString()})</option>)}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="label-xs" style={{ display: 'block', marginBottom: '0.5rem' }}>Title (Optional)</label>
                <input
                  className="input-dark"
                  placeholder="e.g. Concourse Heat Alert or Gate B Status"
                  value={broadcast.title}
                  onChange={e => setBroadcast(b => ({ ...b, title: e.target.value }))}
                  style={{ width: '100%' }}
                />
              </div>

              {/* Message */}
              <div>
                <label className="label-xs" style={{ display: 'block', marginBottom: '0.5rem' }}>Message Body *</label>
                <textarea
                  className="input-dark"
                  rows={4}
                  placeholder="Type official broadcast message to active guests..."
                  value={broadcast.message}
                  onChange={e => setBroadcast(b => ({ ...b, message: e.target.value }))}
                  style={{ width: '100%', resize: 'vertical' }}
                  required
                />
              </div>

              <button onClick={sendBroadcast} disabled={!broadcast.message.trim()} className={sent ? 'btn-ghost' : 'btn-primary'} style={{ width: '100%', justifyContent: 'center', opacity: !broadcast.message.trim() ? 0.5 : 1 }}>
                {sent ? <><CheckCircle size={15} /> Broadcast Sent!</> : <><Send size={15} /> Push Broadcast to Guests</>}
              </button>
            </div>

            {/* Live Feed Column */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Bell size={16} color="var(--brand-light)" /> Active Venue Feed ({notifications.length})
                </h2>
              </div>

              {notifications.length === 0 ? (
                <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-3)', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <Bell size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
                  <p style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-2)' }}>No active broadcasts</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-4)', marginTop: 4 }}>Sent announcements for {venue?.name} will appear here in real time.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: 420, overflowY: 'auto' }}>
                  {notifications.map(n => {
                    const isEmergency = n.type === 'emergency';
                    const isWarning = n.type === 'warning';
                    const badgeColor = isEmergency ? 'var(--danger)' : isWarning ? 'var(--warning)' : 'var(--brand-light)';

                    return (
                      <div
                        key={n.id}
                        style={{
                          background: 'var(--surface-2)',
                          border: '1px solid var(--border)',
                          borderRadius: 10,
                          padding: '0.875rem 1rem',
                          borderLeft: `4px solid ${badgeColor}`,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: '0.75rem',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: badgeColor, background: `color-mix(in srgb, ${badgeColor} 15%, transparent)`, padding: '0.15rem 0.4rem', borderRadius: 4, textTransform: 'uppercase' }}>
                              {n.type}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-3)' }}>
                              📍 {n.section === 'all' || !n.section ? 'All Zones' : venue?.zones.find(z => z.id === n.section)?.name ?? n.section}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-4)', marginLeft: 'auto' }}>
                              {new Date(n.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          {n.title && <div style={{ fontSize: '0.84375rem', fontWeight: 700, color: 'var(--text-1)', marginBottom: 2 }}>{n.title}</div>}
                          <div style={{ fontSize: '0.8125rem', color: 'var(--text-2)', lineHeight: 1.4 }}>{n.message}</div>
                        </div>

                        <button
                          onClick={() => deleteNotification(n.id)}
                          title="Delete broadcast"
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-4)', cursor: 'pointer', padding: 2 }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-4)')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>)}

        {/* ═ GUEST QR ═══════════════════════════════════════════════════════ */}
        {tab === 'qr' && (<>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.025em', marginBottom: '0.375rem' }}>Guest Entrance &amp; Event QR Codes</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-3)', marginBottom: '1.5rem' }}>Display at your stadium gates or print on event tickets. Guests scan to join the live event — no app download required.</p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {/* General Check-in QR */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem', textAlign: 'center' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>1. Venue Entrance Gate QR</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '1rem' }}>General gate check-in URL</p>
              <div style={{ background: '#fff', padding: '1rem', borderRadius: 10, display: 'inline-block', marginBottom: '1rem' }}>
                <QRCode value={guestQrUrl} size={150} />
              </div>
              <p style={{ fontSize: '0.65rem', color: 'var(--text-4)', fontFamily: 'monospace', wordBreak: 'break-all', marginBottom: '0.75rem' }}>{guestQrUrl}</p>
              <button onClick={() => { navigator.clipboard.writeText(guestQrUrl); setCopiedQr(true); setTimeout(() => setCopiedQr(false), 2000); }} className="btn-ghost" style={{ width: '100%', justifyContent: 'center', fontSize: '0.75rem' }}>
                {copiedQr ? '✓ Copied Gate URL' : 'Copy Gate Check-in URL'}
              </button>
            </div>

            {/* Active Live Event QR */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem', textAlign: 'center' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.5rem' }}>2. Live Event Guest Join QR</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '1rem' }}>
                {liveEvent ? `Active: ${liveEvent.name}` : 'No active live event'}
              </p>
              {liveEvent ? (
                <>
                  <div style={{ background: '#fff', padding: '1rem', borderRadius: 10, display: 'inline-block', marginBottom: '1rem' }}>
                    <QRCode value={typeof window !== 'undefined' ? `${window.location.origin}/g/${venueId}?eventId=${liveEvent.id}` : `/g/${venueId}?eventId=${liveEvent.id}`} size={150} />
                  </div>
                  <p style={{ fontSize: '0.65rem', color: 'var(--text-4)', fontFamily: 'monospace', wordBreak: 'break-all', marginBottom: '0.75rem' }}>
                    {typeof window !== 'undefined' ? `${window.location.origin}/g/${venueId}?eventId=${liveEvent.id}` : `/g/${venueId}?eventId=${liveEvent.id}`}
                  </p>
                  <button onClick={() => { const link = `${window.location.origin}/g/${venueId}?eventId=${liveEvent.id}`; navigator.clipboard.writeText(link); setCopiedQr(true); setTimeout(() => setCopiedQr(false), 2000); }} className="btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: '0.75rem' }}>
                    Copy Event Join Link
                  </button>
                </>
              ) : (
                <div style={{ padding: '2rem 1rem', color: 'var(--text-4)', fontSize: '0.8125rem' }}>
                  Set an event to <strong>LIVE</strong> in the Events tab to generate a direct Event Join QR Code.
                </div>
              )}
            </div>
          </div>
        </>)}
      </main>
    </div>
  );
}
