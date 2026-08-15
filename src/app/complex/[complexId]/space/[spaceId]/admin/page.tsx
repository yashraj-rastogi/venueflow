'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Activity, AlertTriangle, Bell, Building2, Calendar, CheckCircle,
  Clock, Loader2, MapPin, Play, Send, Shield, StopCircle, Users, Zap,
} from 'lucide-react';
import { useSpaceCrowd, useComplexNotifications } from '@/hooks/useRealtimeData';
import { getSpace, getSpaceEvents, createSpaceEvent, updateSpaceEvent } from '@/lib/firestore';
import { fmtCount, fmtPct, fmtDensityColor } from '@/lib/formatters';
import type { VenueSpace, SpaceEvent } from '@/types';

type Tab = 'overview' | 'events' | 'broadcast' | 'staff' | 'incidents';

/**
 * /complex/[complexId]/space/[spaceId]/admin
 *
 * SpaceAdmin Dashboard — scoped to a single event organizer / space admin.
 * Enforces strict isolation: sees ONLY crowd, events, and broadcast for their space.
 */
export default function SpaceAdminPage() {
  const params = useParams<{ complexId: string; spaceId: string }>();
  const router = useRouter();

  const { complexId, spaceId } = params;

  const { crowd, loading: crowdLoading } = useSpaceCrowd(complexId, spaceId);
  const { notifications, unreadCount } = useComplexNotifications(complexId, spaceId);

  const [space,       setSpace]       = useState<VenueSpace | null>(null);
  const [events,      setEvents]      = useState<SpaceEvent[]>([]);
  const [activeEvent, setActiveEvent] = useState<SpaceEvent | null>(null);
  const [tab,         setTab]         = useState<Tab>('overview');
  const [loading,     setLoading]     = useState(true);

  // Broadcast state
  const [broadcast, setBroadcast] = useState({ title: '', message: '', type: 'info' as 'info' | 'warning' | 'emergency' });
  const [sending,   setSending]   = useState(false);
  const [sendOk,    setSendOk]    = useState(false);

  // New Event Form State
  const [newEvent, setNewEvent] = useState({ name: '', type: 'conference', expectedAttendance: 500, description: '' });
  const [creating, setCreating] = useState(false);

  // Load space & space events
  const loadData = useCallback(async () => {
    if (!complexId || !spaceId) return;
    try {
      const s = await getSpace(complexId, spaceId);
      setSpace(s);
      const evs = await getSpaceEvents(complexId, spaceId);
      setEvents(evs);
      const live = evs.find(e => e.status === 'live');
      setActiveEvent(live ?? null);
    } catch (err) {
      console.error('Failed to load space data:', err);
    } finally {
      setLoading(false);
    }
  }, [complexId, spaceId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Event Status Transition (Go Live / End Event)
  const handleEventStatusChange = async (eventId: string, newStatus: 'live' | 'ended') => {
    try {
      const res = await fetch('/api/space-events', {
        method : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ eventId, spaceId, complexId, status: newStatus }),
      });
      if ((await res.json()).ok) {
        await loadData();
      }
    } catch (err) {
      console.error('Event status change failed:', err);
    }
  };

  // Handle Create Event
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/space-events', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
          complexId,
          spaceId,
          orgId: 'org-space-admin',
          name : newEvent.name,
          type : newEvent.type,
          date : Date.now(),
          expectedAttendance: Number(newEvent.expectedAttendance),
          description: newEvent.description,
        }),
      });
      if ((await res.json()).ok) {
        setNewEvent({ name: '', type: 'conference', expectedAttendance: 500, description: '' });
        await loadData();
      }
    } catch (err) {
      console.error('Create event failed:', err);
    } finally {
      setCreating(false);
    }
  };

  // Handle Space-scoped Broadcast
  const handleBroadcast = async () => {
    if (!broadcast.message.trim()) return;
    setSending(true);
    try {
      const res = await fetch('/api/notify', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ complexId, spaceId, ...broadcast }),
      });
      if ((await res.json()).ok) {
        setSendOk(true);
        setBroadcast(p => ({ ...p, message: '', title: '' }));
        setTimeout(() => setSendOk(false), 3000);
      }
    } finally {
      setSending(false);
    }
  };

  const density  = crowd?.density ?? 0;
  const count    = crowd?.count   ?? 0;
  const capacity = crowd?.capacity ?? space?.capacity ?? 0;
  const dColor   = fmtDensityColor(density);

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--brand-light)' }} />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text-1)', fontFamily: 'Inter, sans-serif' }}>
      
      {/* Top Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 40, background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0.875rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Building2 size={17} color="#fff" />
          </div>
          <div>
            <p style={{ fontWeight: 800, fontSize: '1rem' }}>{space?.name ?? spaceId}</p>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-4)', display: 'flex', alignItems: 'center', gap: 4 }}>
              SpaceAdmin Dashboard · {space?.floor === 0 ? 'Ground Floor' : `Floor ${space?.floor}`}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => router.push(`/complex/${complexId}`)}
            className="btn-ghost"
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem', height: 'auto' }}
          >
            ← Complex Overview
          </button>
          <span className={crowdLoading ? 'chip chip-amber' : 'chip chip-green'} style={{ fontSize: '0.7rem' }}>
            {crowdLoading ? 'Syncing...' : '🟢 Live Feed'}
          </span>
        </div>
      </header>

      <div style={{ display: 'flex', height: 'calc(100vh - 57px)' }}>

        {/* Sidebar */}
        <aside style={{ width: 200, background: 'var(--surface)', borderRight: '1px solid var(--border)', padding: '1rem 0', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {([
            ['overview',  '📊', 'Space Overview'],
            ['events',    '🎟️', 'Event Management'],
            ['broadcast', '📢', 'Space Alert'],
            ['incidents', '🚨', 'Incidents'],
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

        {/* Main Content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>

          {/* OVERVIEW */}
          {tab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Active event banner */}
              {activeEvent ? (
                <div style={{ background: 'color-mix(in srgb, var(--brand) 10%, var(--surface))', border: '1px solid color-mix(in srgb, var(--brand) 30%, transparent)', borderRadius: 14, padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span className="live-badge"><span className="live-dot" />LIVE EVENT</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-4)' }}>{activeEvent.type.toUpperCase()}</span>
                    </div>
                    <h2 style={{ fontSize: '1.125rem', fontWeight: 800 }}>{activeEvent.name}</h2>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)', marginTop: 2 }}>
                      Expected: {activeEvent.expectedAttendance.toLocaleString()} attendees
                    </p>
                  </div>
                  <button
                    onClick={() => handleEventStatusChange(activeEvent.id, 'ended')}
                    className="btn-ghost"
                    style={{ color: 'var(--danger)', borderColor: 'color-mix(in srgb, var(--danger) 30%, transparent)', gap: 6 }}
                  >
                    <StopCircle size={15} /> End Event
                  </button>
                </div>
              ) : (
                <div className="card" style={{ padding: '1.25rem', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-2)' }}>No Live Event in {space?.name}</p>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-4)', marginTop: 2 }}>Select an upcoming event or start a new session below.</p>
                  </div>
                  <button onClick={() => setTab('events')} className="btn-primary" style={{ gap: 6 }}>
                    <Play size={14} /> Manage Events
                  </button>
                </div>
              )}

              {/* Real-time Telemetry Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.875rem' }}>
                <div className="card" style={{ padding: '1rem', borderRadius: 12 }}>
                  <p className="label-xs" style={{ marginBottom: '0.25rem' }}>Current Occupancy</p>
                  <p className="stat-xl" style={{ color: dColor }}>{crowdLoading ? '–' : fmtCount(count)}</p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-4)', marginTop: 4 }}>Live check-ins</p>
                </div>

                <div className="card" style={{ padding: '1rem', borderRadius: 12 }}>
                  <p className="label-xs" style={{ marginBottom: '0.25rem' }}>Capacity Density</p>
                  <p className="stat-xl" style={{ color: dColor }}>{fmtPct(density)}</p>
                  <div className="progress-track" style={{ marginTop: 8 }}>
                    <div className="progress-fill" style={{ width: `${density * 100}%`, background: dColor }} />
                  </div>
                </div>

                <div className="card" style={{ padding: '1rem', borderRadius: 12 }}>
                  <p className="label-xs" style={{ marginBottom: '0.25rem' }}>Space Capacity</p>
                  <p className="stat-xl">{fmtCount(capacity)}</p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-4)', marginTop: 4 }}>Maximum limit</p>
                </div>
              </div>

              {/* Amenities & Wait Times for this space */}
              <div className="card" style={{ padding: '1.25rem', borderRadius: 14 }}>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: '0.75rem' }}>Space Amenities Status</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
                  {(space?.amenities ?? []).map(a => (
                    <div key={a.id} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{a.name}</span>
                        <span className={a.isOpen ? 'chip chip-green' : 'chip chip-red'} style={{ fontSize: '0.65rem' }}>
                          {a.isOpen ? 'Open' : 'Closed'}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 4 }}>
                        Wait: <strong>{a.waitTime}m</strong> ({a.trend})
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* EVENTS MANAGEMENT */}
          {tab === 'events' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.25rem' }}>🎟️ Event Lifecycle</h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)' }}>Create and launch events hosted in {space?.name}.</p>
              </div>

              {/* Create event card */}
              <form onSubmit={handleCreateEvent} className="card" style={{ padding: '1.25rem', borderRadius: 14, display: 'flex', flexDirection: 'column', gap: '0.875rem', maxWidth: 520 }}>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 700 }}>Schedule New Event</h3>
                <div>
                  <label className="label-xs" style={{ display: 'block', marginBottom: '0.25rem' }}>Event Title</label>
                  <input className="input-dark" value={newEvent.name} onChange={e => setNewEvent(p => ({ ...p, name: e.target.value }))} placeholder="e.g. AI Security Keynote" required style={{ width: '100%' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label className="label-xs" style={{ display: 'block', marginBottom: '0.25rem' }}>Event Type</label>
                    <select className="input-dark" value={newEvent.type} onChange={e => setNewEvent(p => ({ ...p, type: e.target.value }))} style={{ width: '100%' }}>
                      <option value="conference">Conference</option>
                      <option value="summit">Summit</option>
                      <option value="expo">Expo</option>
                      <option value="keynote">Keynote</option>
                      <option value="workshop">Workshop</option>
                    </select>
                  </div>
                  <div>
                    <label className="label-xs" style={{ display: 'block', marginBottom: '0.25rem' }}>Expected Attendance</label>
                    <input type="number" className="input-dark" value={newEvent.expectedAttendance} onChange={e => setNewEvent(p => ({ ...p, expectedAttendance: Number(e.target.value) }))} style={{ width: '100%' }} />
                  </div>
                </div>
                <div>
                  <label className="label-xs" style={{ display: 'block', marginBottom: '0.25rem' }}>Description</label>
                  <textarea className="input-dark" value={newEvent.description} onChange={e => setNewEvent(p => ({ ...p, description: e.target.value }))} rows={2} placeholder="Short event summary..." style={{ width: '100%', resize: 'vertical' }} />
                </div>
                <button type="submit" disabled={creating} className="btn-primary" style={{ alignSelf: 'flex-start' }}>
                  {creating ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : 'Create Event'}
                </button>
              </form>

              {/* List of events */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 700 }}>Existing Events</h3>
                {events.length === 0 ? (
                  <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>No events created yet.</p>
                ) : (
                  events.map(e => (
                    <div key={e.id} className="card" style={{ padding: '1rem', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <span className={e.status === 'live' ? 'chip chip-green' : e.status === 'ended' ? 'chip' : 'chip chip-blue'} style={{ fontSize: '0.65rem' }}>
                            {e.status.toUpperCase()}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-4)' }}>{e.type}</span>
                        </div>
                        <p style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{e.name}</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 2 }}>{e.description}</p>
                      </div>
                      <div>
                        {e.status === 'upcoming' && (
                          <button onClick={() => handleEventStatusChange(e.id, 'live')} className="btn-glow" style={{ fontSize: '0.75rem', padding: '0.375rem 0.75rem', height: 'auto', gap: 4 }}>
                            <Play size={12} /> Go Live
                          </button>
                        )}
                        {e.status === 'live' && (
                          <button onClick={() => handleEventStatusChange(e.id, 'ended')} className="btn-ghost" style={{ color: 'var(--danger)', fontSize: '0.75rem', padding: '0.375rem 0.75rem', height: 'auto', gap: 4 }}>
                            <StopCircle size={12} /> End Event
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* BROADCAST */}
          {tab === 'broadcast' && (
            <div style={{ maxWidth: 520, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.25rem' }}>📢 Broadcast to {space?.name} Attendees</h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)' }}>Alerts are delivered ONLY to attendees checked in to this specific space.</p>
              </div>

              <div>
                <label className="label-xs" style={{ display: 'block', marginBottom: '0.375rem' }}>Alert level</label>
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
                <input className="input-dark" value={broadcast.title} onChange={e => setBroadcast(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Session Starting" style={{ width: '100%' }} />
              </div>

              <div>
                <label className="label-xs" style={{ display: 'block', marginBottom: '0.375rem' }}>Message</label>
                <textarea className="input-dark" value={broadcast.message} onChange={e => setBroadcast(p => ({ ...p, message: e.target.value }))} placeholder="Message text..." rows={3} style={{ width: '100%', resize: 'vertical' }} />
              </div>

              <button onClick={handleBroadcast} disabled={sending || !broadcast.message.trim()} className="btn-glow" style={{ alignSelf: 'flex-start', gap: '0.5rem' }}>
                {sending ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={15} />}
                Send to {space?.name}
              </button>

              {sendOk && <p style={{ fontSize: '0.8125rem', color: 'var(--success)' }}>✓ Space alert broadcast successfully</p>}
            </div>
          )}

          {/* INCIDENTS */}
          {tab === 'incidents' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>🚨 Incidents in {space?.name}</h2>
              {notifications.filter(n => n.type === 'emergency' || n.type === 'warning').length === 0 ? (
                <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>No active incidents in this space.</p>
              ) : (
                notifications.filter(n => n.type === 'emergency' || n.type === 'warning').map(n => (
                  <div key={n.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '1rem', display: 'flex', gap: '0.75rem' }}>
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
        </main>
      </div>
    </div>
  );
}
