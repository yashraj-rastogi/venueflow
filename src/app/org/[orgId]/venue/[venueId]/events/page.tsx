'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import QRCode from 'qrcode';
import {
  Activity, ArrowLeft, Calendar, CheckCircle2, Clock, Copy, Download,
  DownloadCloud, Eye, History, Loader2, MapPin, Plus, QrCode, Radio,
  Shield, Sparkles, Ticket, Users, X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCrowdData, useVenueData } from '@/hooks/useRealtimeData';
import { getOrganization, getVenueEvents, subscribeToVenueEvents } from '@/lib/firestore';
import { Organization, Venue, VenueEvent } from '@/types';
import { fmtCount, fmtPct } from '@/lib/formatters';

const EVENT_TYPES = [
  { id: 'nfl', label: '🏈 NFL / Football' },
  { id: 'nba', label: '🏀 Basketball / Indoor' },
  { id: 'soccer', label: '⚽ Soccer / Football' },
  { id: 'concert', label: '🎤 Concert / Show' },
  { id: 'other', label: '🏆 General Sports & Events' },
];

export default function AdminEventsPage() {
  const { orgId, venueId } = useParams<{ orgId: string; venueId: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { venue } = useVenueData(venueId);
  const { crowd } = useCrowdData(venueId);

  const [org, setOrg] = useState<Organization | null>(null);
  const [events, setEvents] = useState<VenueEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');

  // Create Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<VenueEvent['type']>('nfl');
  const [dateStr, setDateStr] = useState('');
  const [expectedAttendance, setExpectedAttendance] = useState('50000');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Status Action state
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // QR Modal state
  const [qrModalEvent, setQrModalEvent] = useState<VenueEvent | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!orgId || !venueId) return;
    getOrganization(orgId).then(setOrg);
    const unsub = subscribeToVenueEvents(venueId, (evts) => {
      setEvents(evts);
      setLoading(false);
    });
    return () => unsub();
  }, [orgId, venueId]);

  // Generate QR Code data URL when zone or event changes
  useEffect(() => {
    if (!qrModalEvent || !venue) return;
    const targetZone = selectedZoneId || venue.zones[0]?.id || 'zone-a';

    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const checkinUrl = `${origin}/checkin/${venueId}?event=${qrModalEvent.id}&z=${targetZone}&s=${encodeURIComponent(targetZone)}`;

    QRCode.toDataURL(checkinUrl, { width: 320, margin: 2, color: { dark: '#080c18', light: '#ffffff' } })
      .then(setQrDataUrl)
      .catch(console.error);
  }, [qrModalEvent, selectedZoneId, venue, venueId]);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !dateStr) {
      setCreateError('Event title and date are required.');
      return;
    }

    setCreating(true);
    setCreateError('');

    try {
      const timestamp = new Date(dateStr).getTime();
      const res = await fetch('/api/events/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          venueId,
          name: name.trim(),
          type,
          date: timestamp,
          expectedAttendance: parseInt(expectedAttendance) || 50000,
          description: description.trim(),
          specialInstructions: instructions.trim(),
        }),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? 'Failed to create event');

      setShowCreateModal(false);
      setName('');
      setDescription('');
      setInstructions('');
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Event creation failed');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateStatus = async (eventId: string, newStatus: 'live' | 'ended') => {
    setUpdatingId(eventId);
    try {
      const liveTotal = crowd ? Object.values(crowd.zones).reduce((s, z) => s + z.count, 0) : 0;
      const res = await fetch('/api/events/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          status: newStatus,
          actualAttendance: newStatus === 'ended' ? liveTotal : undefined,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? 'Status update failed');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update event status');
    } finally {
      setUpdatingId(null);
    }
  };

  const liveCount = crowd ? Object.values(crowd.zones).reduce((s, z) => s + z.count, 0) : 0;
  const liveEvents = events.filter(e => e.status === 'live');
  const upcomingEvents = events.filter(e => e.status === 'upcoming');
  const pastEvents = events.filter(e => e.status === 'ended');

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--text-1)', fontFamily: 'Inter, sans-serif' }}>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)', padding: '1rem 1.5rem', position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link href={`/org/${orgId}/venue/${venueId}/admin`} className="btn-ghost" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8125rem' }}>
              <ArrowLeft size={14} /> Mission Control
            </Link>
            <div style={{ height: 20, width: 1, background: 'var(--border)' }} />
            <div>
              <h1 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-1)' }}>
                {venue?.name ?? 'Venue'} Events Dashboard
              </h1>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Central event scheduling & real-time attendance hub</p>
            </div>
          </div>

          <button onClick={() => setShowCreateModal(true)} className="btn-primary" style={{ fontSize: '0.84375rem', padding: '0.5rem 1rem' }}>
            <Plus size={15} /> Create New Event
          </button>
        </div>
      </header>

      {/* ── Main Body ───────────────────────────────────────────────────────── */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '1.5rem' }}>
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem' }}>
          <button
            onClick={() => setActiveTab('current')}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${activeTab === 'current' ? 'var(--brand)' : 'transparent'}`,
              color: activeTab === 'current' ? 'var(--brand-light)' : 'var(--text-3)',
              padding: '0.75rem 1rem',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Radio size={15} color={liveEvents.length > 0 ? 'var(--danger)' : undefined} />
            Live & Scheduled ({liveEvents.length + upcomingEvents.length})
          </button>

          <button
            onClick={() => setActiveTab('history')}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${activeTab === 'history' ? 'var(--brand)' : 'transparent'}`,
              color: activeTab === 'history' ? 'var(--brand-light)' : 'var(--text-3)',
              padding: '0.75rem 1rem',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <History size={15} /> Past Event History ({pastEvents.length})
          </button>
        </div>

        {/* ── TAB 1: Live & Scheduled Events ─────────────────────────────────── */}
        {activeTab === 'current' && (
          <div>
            {/* 🔴 LIVE EVENT SECTION */}
            {liveEvents.length > 0 && (
              <div style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--danger)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="live-dot" /> LIVE EVENT IN PROGRESS
                </h2>

                {liveEvents.map(evt => (
                  <div key={evt.id} style={{ background: 'var(--surface)', border: '1px solid var(--brand-border, rgba(59, 130, 246, 0.3))', borderRadius: 14, padding: '1.5rem', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span className="live-badge"><span className="live-dot" />LIVE NOW</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{evt.type}</span>
                        </div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-1)' }}>{evt.name}</h3>
                        {evt.description && <p style={{ fontSize: '0.84375rem', color: 'var(--text-3)', marginTop: 4 }}>{evt.description}</p>}
                      </div>

                      {/* Controls */}
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => setQrModalEvent(evt)}
                          className="btn-ghost"
                          style={{ fontSize: '0.8125rem', padding: '0.5rem 0.875rem' }}
                        >
                          <QrCode size={15} /> Entrance QR Codes
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(evt.id, 'ended')}
                          disabled={updatingId === evt.id}
                          className="btn-danger"
                          style={{ fontSize: '0.8125rem', padding: '0.5rem 0.875rem', background: 'var(--danger-bg, #ef444422)', color: 'var(--danger, #ef4444)', border: '1px solid var(--danger)' }}
                        >
                          {updatingId === evt.id ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : 'End Event 🏁'}
                        </button>
                      </div>
                    </div>

                    {/* Live attendance metrics grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginTop: '1.25rem', padding: '1rem', background: 'var(--surface-2)', borderRadius: 10 }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Live Checked-In Guests</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--brand-light)' }}>{fmtCount(liveCount)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Expected Attendance</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-1)' }}>{fmtCount(evt.expectedAttendance)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Current Turnout Ratio</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)' }}>
                          {fmtPct(evt.expectedAttendance ? liveCount / evt.expectedAttendance : 0)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 📅 UPCOMING / SCHEDULED EVENTS */}
            <div>
              <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-3)', marginBottom: '0.75rem' }}>
                Upcoming & Scheduled ({upcomingEvents.length})
              </h2>

              {upcomingEvents.length === 0 ? (
                <div style={{ background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 12, padding: '3rem 1.5rem', textAlign: 'center' }}>
                  <Calendar size={32} color="var(--text-3)" style={{ margin: '0 auto 0.75rem' }} />
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-1)', marginBottom: '0.25rem' }}>No Scheduled Events</h3>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)', marginBottom: '1.25rem' }}>Create an event to generate entrance QR codes and stream real-time guest check-ins.</p>
                  <button onClick={() => setShowCreateModal(true)} className="btn-primary">
                    <Plus size={15} /> Create First Event
                  </button>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
                  {upcomingEvents.map(evt => (
                    <div key={evt.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--brand-light)', background: 'color-mix(in srgb, var(--brand) 15%, transparent)', padding: '0.2rem 0.5rem', borderRadius: 6, fontWeight: 600, textTransform: 'uppercase' }}>
                            {evt.type}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={12} /> {new Date(evt.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-1)', marginBottom: '0.375rem' }}>{evt.name}</h3>
                        {evt.description && <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)', marginBottom: '0.75rem', lineHeight: 1.4 }}>{evt.description}</p>}

                        <div style={{ fontSize: '0.78125rem', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: '1rem' }}>
                          <Users size={14} color="var(--brand-light)" /> Expected: <strong>{fmtCount(evt.expectedAttendance)}</strong>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.875rem' }}>
                        <button
                          onClick={() => handleUpdateStatus(evt.id, 'live')}
                          disabled={updatingId === evt.id}
                          className="btn-primary"
                          style={{ flex: 1, justifyContent: 'center', fontSize: '0.8125rem', padding: '0.45rem' }}
                        >
                          {updatingId === evt.id ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : 'Go Live 🔴'}
                        </button>

                        <button
                          onClick={() => setQrModalEvent(evt)}
                          className="btn-ghost"
                          style={{ fontSize: '0.8125rem', padding: '0.45rem 0.75rem' }}
                          title="Generate Entrance QR Codes"
                        >
                          <QrCode size={15} /> QR Codes
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 2: Past Event History Table ─────────────────────────────────── */}
        {activeTab === 'history' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            {pastEvents.length === 0 ? (
              <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-3)' }}>
                <History size={32} style={{ margin: '0 auto 0.75rem' }} />
                <p style={{ fontSize: '0.9375rem' }}>No past event records yet.</p>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84375rem' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', color: 'var(--text-3)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <th style={{ padding: '0.875rem 1rem' }}>Event Title</th>
                    <th style={{ padding: '0.875rem 1rem' }}>Category</th>
                    <th style={{ padding: '0.875rem 1rem' }}>Date Held</th>
                    <th style={{ padding: '0.875rem 1rem' }}>Expected</th>
                    <th style={{ padding: '0.875rem 1rem' }}>Actual Checked-in</th>
                    <th style={{ padding: '0.875rem 1rem' }}>Turnout %</th>
                    <th style={{ padding: '0.875rem 1rem' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pastEvents.map(evt => {
                    const actual = evt.actualAttendance ?? 0;
                    const turnout = evt.expectedAttendance ? actual / evt.expectedAttendance : 0;
                    return (
                      <tr key={evt.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.875rem 1rem', fontWeight: 600, color: 'var(--text-1)' }}>{evt.name}</td>
                        <td style={{ padding: '0.875rem 1rem', color: 'var(--text-3)', textTransform: 'uppercase' }}>{evt.type}</td>
                        <td style={{ padding: '0.875rem 1rem', color: 'var(--text-3)' }}>{new Date(evt.date).toLocaleDateString()}</td>
                        <td style={{ padding: '0.875rem 1rem', color: 'var(--text-2)' }}>{fmtCount(evt.expectedAttendance)}</td>
                        <td style={{ padding: '0.875rem 1rem', fontWeight: 700, color: 'var(--brand-light)' }}>{fmtCount(actual)}</td>
                        <td style={{ padding: '0.875rem 1rem', fontWeight: 600, color: turnout > 0.8 ? 'var(--success)' : 'var(--warning)' }}>{fmtPct(turnout)}</td>
                        <td style={{ padding: '0.875rem 1rem' }}>
                          <span style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.06)', padding: '0.2rem 0.5rem', borderRadius: 4, color: 'var(--text-3)' }}>Ended</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>

      {/* ── MODAL 1: Create Event ────────────────────────────────────────────── */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div style={{ width: '100%', maxWidth: 500, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.6)' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--text-1)' }}>Schedule New Event</h3>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateEvent} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {createError && <p style={{ fontSize: '0.8125rem', color: 'var(--danger)' }}>{createError}</p>}

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-2)', marginBottom: 4 }}>Event Title *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Real Madrid vs Barcelona — Cup Final" className="input-dark" style={{ width: '100%' }} required />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-2)', marginBottom: 4 }}>Category</label>
                  <select value={type} onChange={e => setType(e.target.value as VenueEvent['type'])} className="input-dark" style={{ width: '100%' }}>
                    {EVENT_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-2)', marginBottom: 4 }}>Date & Start Time *</label>
                  <input type="datetime-local" value={dateStr} onChange={e => setDateStr(e.target.value)} className="input-dark" style={{ width: '100%' }} required />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-2)', marginBottom: 4 }}>Expected Attendance</label>
                <input type="number" value={expectedAttendance} onChange={e => setExpectedAttendance(e.target.value)} placeholder="50000" className="input-dark" style={{ width: '100%' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-2)', marginBottom: 4 }}>Special Instructions (for guests)</label>
                <input value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Clear bag policy in effect. Gates open at 5 PM." className="input-dark" style={{ width: '100%' }} />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
                <button type="submit" disabled={creating} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                  {creating ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: Entrance QR Code Generator ────────────────────────────── */}
      {qrModalEvent && venue && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div style={{ width: '100%', maxWidth: 440, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ textAlign: 'left' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-1)' }}>Entrance QR Code</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{qrModalEvent.name}</p>
              </div>
              <button onClick={() => setQrModalEvent(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}><X size={18} /></button>
            </div>

            {/* Select Zone */}
            <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: 4 }}>Select Zone / Gate for QR Code:</label>
              <select value={selectedZoneId} onChange={e => setSelectedZoneId(e.target.value)} className="input-dark" style={{ width: '100%', fontSize: '0.84375rem' }}>
                {venue.zones.map(z => <option key={z.id} value={z.id}>{z.name} (Cap: {z.capacity})</option>)}
              </select>
            </div>

            {/* QR Canvas render */}
            {qrDataUrl ? (
              <div style={{ background: '#ffffff', padding: '1rem', borderRadius: 12, display: 'inline-block', marginBottom: '1rem', border: '1px solid var(--border)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="Entrance QR Code" style={{ width: 220, height: 220, display: 'block' }} />
              </div>
            ) : (
              <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            )}

            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '1.25rem' }}>
              Print or display this QR code at <strong>{venue.zones.find(z => z.id === (selectedZoneId || venue.zones[0]?.id))?.name}</strong>. Scanning checks guests in automatically.
            </p>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <a
                href={qrDataUrl}
                download={`${venueId}-${qrModalEvent.id}-${selectedZoneId || 'gate'}.png`}
                className="btn-primary"
                style={{ flex: 1, justifyContent: 'center', fontSize: '0.8125rem', padding: '0.5rem' }}
              >
                <Download size={14} /> Download QR PNG
              </a>
              <button
                onClick={() => {
                  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
                  const url = `${origin}/checkin/${venueId}?event=${qrModalEvent.id}&z=${selectedZoneId || venue.zones[0]?.id}`;
                  navigator.clipboard.writeText(url);
                  alert('Check-in URL copied to clipboard!');
                }}
                className="btn-ghost"
                style={{ flex: 1, justifyContent: 'center', fontSize: '0.8125rem', padding: '0.5rem' }}
              >
                <Copy size={14} /> Copy Link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
