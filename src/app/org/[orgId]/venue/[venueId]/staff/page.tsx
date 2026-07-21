'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Activity, AlertTriangle, ArrowLeft, Bell, CheckCircle, ChevronDown, ChevronUp, Loader2, Send, Shield } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCrowdData, useNotifications, useVenueData } from '@/hooks/useRealtimeData';
import { createIncident } from '@/lib/firestore';
import { evaluateZoneSafety } from '@/lib/safety';
import { fmtPct, fmtCount, fmtDensityColor } from '@/lib/formatters';
import LiveRegion from '@/components/LiveRegion';
import Link from 'next/link';

const INCIDENT_TYPES = ['overcrowding', 'medical', 'security', 'weather', 'amenity_failure', 'other'] as const;

export default function StaffMobileView() {
  const { orgId, venueId } = useParams<{ orgId: string; venueId: string }>();
  const { user } = useAuth();
  const { venue }         = useVenueData(venueId);
  const { crowd }         = useCrowdData(venueId);
  const { notifications } = useNotifications(venueId);

  const [myZone,     setMyZone]     = useState('');
  const [showReport, setShowReport] = useState(false);
  const [incident,   setIncident]   = useState({ type: 'overcrowding' as typeof INCIDENT_TYPES[number], severity: 'medium' as 'low' | 'medium' | 'high' | 'critical', description: '' });
  const [submitted,  setSubmitted]  = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msgText,    setMsgText]    = useState('');
  const [msgSent,    setMsgSent]    = useState(false);
  const [emergency,  setEmergency]  = useState('');

  useEffect(() => { if (venue?.zones.length && !myZone) setMyZone(venue.zones[0].id); }, [venue]);
  useEffect(() => { const em = notifications.find(n => n.type === 'emergency' && !n.read); if (em) setEmergency(em.message); }, [notifications]);

  const zone       = venue?.zones.find(z => z.id === myZone);
  const zData      = crowd?.zones[myZone];
  const density    = zData?.density ?? zone?.density ?? 0;
  const count      = zData?.count   ?? zone?.currentCount ?? 0;
  const safety     = evaluateZoneSafety(zone!, count);
  const dColor     = fmtDensityColor(density);
  const emNotifs   = notifications.filter(n => n.type === 'emergency' && !n.read);

  const submitIncident = async () => {
    if (!incident.description || submitting) return;
    setSubmitting(true);
    try {
      await createIncident({ venueId, orgId, zoneId: myZone, type: incident.type, severity: incident.severity, description: incident.description, reportedBy: user?.uid ?? 'staff', reportedAt: Date.now(), status: 'open' });
      setSubmitted(true);
      setShowReport(false);
      setIncident(i => ({ ...i, description: '' }));
      setTimeout(() => setSubmitted(false), 4000);
    } finally { setSubmitting(false); }
  };

  const sendMsg = async () => {
    if (!msgText.trim()) return;
    await fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msgText, type: 'info', section: myZone, venueId }) });
    setMsgText('');
    setMsgSent(true);
    setTimeout(() => setMsgSent(false), 3000);
  };

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--text-1)', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif' }}>
      <LiveRegion message={emergency} level="assertive" />

      {/* Emergency banner */}
      {emNotifs.length > 0 && (
        <div role="alert" style={{ background: 'var(--danger-bg)', borderBottom: '2px solid var(--danger)', padding: '0.75rem 1rem' }}>
          <p style={{ color: 'var(--danger)', fontWeight: 700, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={15} /> {emNotifs[0].message}
          </p>
        </div>
      )}

      {/* Header */}
      <header style={{ padding: '0.875rem 1rem', background: 'var(--surface)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem' }}>
          <Link href={`/org/${orgId}`} style={{ color: 'var(--text-3)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8125rem' }}>
            <ArrowLeft size={13} />
          </Link>
          <Shield size={15} color="var(--brand-light)" />
          <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Staff</span>
          <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-3)' }}>{venue?.name}</span>
        </div>
        <select value={myZone} onChange={e => setMyZone(e.target.value)} aria-label="Select zone" className="input-dark" style={{ fontSize: '0.875rem' }}>
          {venue?.zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
        </select>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

        {/* Zone card */}
        {zone && (
          <div style={{ background: 'var(--surface)', border: `1px solid ${density > 0.8 ? 'var(--danger-border)' : density > 0.5 ? 'var(--warning-border)' : 'var(--border)'}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ height: 3, background: 'var(--surface-2)' }}>
              <div style={{ height: '100%', width: `${density * 100}%`, background: dColor, transition: 'width 1s ease' }} />
            </div>
            <div style={{ padding: '1.125rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>{zone.name}</h2>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.125rem' }}>Phase: {zone.phase}{zone.isStepFree ? ' · ♿' : ''}</p>
                </div>
                {safety && (
                  <span className={`chip chip-${safety.dimIcePhase === 'critical' ? 'red' : safety.dimIcePhase === 'warning' ? 'amber' : 'green'}`}>
                    DIM-ICE: {safety.dimIcePhase}
                  </span>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                {[
                  { val: fmtPct(density), label: 'Occupancy', color: dColor },
                  { val: fmtCount(count), label: 'Guests',    color: 'var(--text-1)' },
                  { val: zone.capacity > 0 ? fmtCount(zone.capacity - count) : '—', label: 'Available', color: 'var(--text-1)' },
                ].map(s => (
                  <div key={s.label} style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '0.75rem 0.5rem' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.val}</div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {safety?.staffReallocationNeeded && (
                <div style={{ marginTop: '0.875rem', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', borderRadius: 8, padding: '0.5rem 0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <AlertTriangle size={13} color="var(--danger)" />
                  <p style={{ fontSize: '0.8125rem', color: 'var(--danger)', fontWeight: 600 }}>Staff reallocation required</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Incident report accordion */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          <button onClick={() => setShowReport(v => !v)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.875rem 1rem', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-1)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
              <AlertTriangle size={15} color="var(--warning)" /> Report Incident
            </span>
            {showReport ? <ChevronUp size={15} color="var(--text-4)" /> : <ChevronDown size={15} color="var(--text-4)" />}
          </button>
          {showReport && (
            <div style={{ padding: '0 1rem 1rem', borderTop: '1px solid var(--border)' }}>
              <div style={{ paddingTop: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {/* Type pills */}
                <div>
                  <label className="label-xs" style={{ display: 'block', marginBottom: '0.375rem' }}>Type</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                    {INCIDENT_TYPES.map(t => (
                      <button key={t} onClick={() => setIncident(i => ({ ...i, type: t }))} style={{ padding: '0.25rem 0.625rem', borderRadius: 99, fontSize: '0.75rem', cursor: 'pointer', border: '1px solid', background: incident.type === t ? 'var(--brand-bg)' : 'transparent', borderColor: incident.type === t ? 'var(--brand)' : 'var(--border)', color: incident.type === t ? 'var(--brand-text)' : 'var(--text-3)' }}>{t}</button>
                    ))}
                  </div>
                </div>
                {/* Severity */}
                <div>
                  <label className="label-xs" style={{ display: 'block', marginBottom: '0.375rem' }}>Severity</label>
                  <div style={{ display: 'flex', gap: '0.375rem' }}>
                    {(['low', 'medium', 'high', 'critical'] as const).map(s => (
                      <button key={s} onClick={() => setIncident(i => ({ ...i, severity: s }))} style={{ flex: 1, padding: '0.375rem', borderRadius: 8, fontSize: '0.75rem', cursor: 'pointer', border: '1px solid', background: incident.severity === s ? `color-mix(in srgb, ${fmtDensityColor(s === 'low' ? 0.2 : s === 'medium' ? 0.55 : 0.9)} 12%, transparent)` : 'transparent', borderColor: incident.severity === s ? fmtDensityColor(s === 'low' ? 0.2 : s === 'medium' ? 0.55 : 0.9) : 'var(--border)', color: incident.severity === s ? fmtDensityColor(s === 'low' ? 0.2 : s === 'medium' ? 0.55 : 0.9) : 'var(--text-3)' }}>{s}</button>
                    ))}
                  </div>
                </div>
                <textarea placeholder="Describe the incident..." value={incident.description} onChange={e => setIncident(i => ({ ...i, description: e.target.value }))} rows={3} style={{ width: '100%', background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-1)', padding: '0.625rem', fontSize: '0.875rem', resize: 'none', outline: 'none' }} />
                <button onClick={submitIncident} disabled={!incident.description || submitting} className="btn-danger" style={{ justifyContent: 'center', opacity: !incident.description || submitting ? 0.5 : 1 }}>
                  {submitting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <AlertTriangle size={14} />}
                  Submit Report
                </button>
              </div>
            </div>
          )}
        </div>

        {submitted && (
          <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 10, padding: '0.75rem 1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <CheckCircle size={15} color="var(--success)" />
            <p style={{ fontSize: '0.875rem', color: 'var(--success)', fontWeight: 600 }}>Incident reported to control room</p>
          </div>
        )}

        {/* Message control */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '1rem' }}>
          <p style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.625rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <Bell size={13} color="var(--brand-light)" /> Message Control Room
          </p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input value={msgText} onChange={e => setMsgText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMsg()} placeholder="Quick update to control..." style={{ flex: 1, background: 'var(--surface-3)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-1)', padding: '0.5rem 0.75rem', fontSize: '0.875rem', outline: 'none' }} />
            <button onClick={sendMsg} disabled={!msgText.trim()} style={{ width: 38, height: 38, borderRadius: 8, background: msgSent ? 'var(--success-bg)' : 'var(--brand)', border: msgSent ? '1px solid var(--success-border)' : 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: !msgText.trim() ? 0.4 : 1 }}>
              {msgSent ? <CheckCircle size={14} color="var(--success)" /> : <Send size={14} color="#fff" />}
            </button>
          </div>
        </div>

        {/* All zones */}
        <div>
          <p className="label-xs" style={{ marginBottom: '0.5rem' }}>All zones</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {venue?.zones.map(z => {
              const zd  = crowd?.zones[z.id];
              const den = zd?.density ?? z.density;
              return (
                <button key={z.id} onClick={() => setMyZone(z.id)} style={{ background: z.id === myZone ? 'var(--brand-bg)' : 'var(--surface)', border: `1px solid ${z.id === myZone ? 'rgba(37,99,235,0.3)' : 'var(--border)'}`, borderRadius: 8, padding: '0.625rem 0.875rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', width: '100%' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 500, color: z.id === myZone ? 'var(--brand-text)' : 'var(--text-2)' }}>{z.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 48, height: 3, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${den * 100}%`, background: fmtDensityColor(den), borderRadius: 99 }} />
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: fmtDensityColor(den), width: 36, textAlign: 'right' }}>{fmtPct(den)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
