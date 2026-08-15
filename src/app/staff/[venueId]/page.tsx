'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Activity, AlertTriangle, CheckCircle, Loader2, Send, Shield, Users, Wifi } from 'lucide-react';
import { useCrowdData, useNotifications, useVenueData } from '@/hooks/useRealtimeData';
import { fmtCount, fmtPct, fmtDensityColor } from '@/lib/formatters';

/**
 * /staff/[venueId]
 *
 * Mobile-first dashboard for on-duty security and operations staff.
 * Designed for one-handed operation on mobile devices on the concourse floor.
 */
export default function StaffMobilePage() {
  const { venueId } = useParams<{ venueId: string }>();

  const { venue }         = useVenueData(venueId);
  const { crowd }         = useCrowdData(venueId);
  const { notifications } = useNotifications(venueId);

  const [onDuty,    setOnDuty]    = useState(true);
  const [msg,       setMsg]       = useState('');
  const [sending,   setSending]   = useState(false);
  const [broadcastOk, setBroadcastOk] = useState(false);

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msg.trim()) return;
    setSending(true);
    try {
      const res = await fetch('/api/notify', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ venueId, message: msg, type: 'info', title: 'Staff Broadcast' }),
      });
      if ((await res.json()).ok) {
        setMsg('');
        setBroadcastOk(true);
        setTimeout(() => setBroadcastOk(false), 2500);
      }
    } finally {
      setSending(false);
    }
  };

  const incidents = notifications.filter(n => n.type === 'emergency' || n.type === 'warning');

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--text-1)', fontFamily: 'Inter, sans-serif', maxWidth: 430, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header */}
      <header style={{ padding: '0.875rem 1rem', background: 'var(--surface)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={13} color="#fff" />
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: '0.875rem' }}>{venue?.name ?? venueId}</p>
            <p style={{ fontSize: '0.65rem', color: 'var(--text-4)' }}>Staff Duty Dashboard</p>
          </div>
        </div>

        <button
          onClick={() => setOnDuty(p => !p)}
          className={onDuty ? 'chip chip-green' : 'chip'}
          style={{ fontSize: '0.7rem', padding: '0.2rem 0.6rem', cursor: 'pointer' }}
        >
          {onDuty ? '🟢 On Duty' : '⚪ Off Duty'}
        </button>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
        
        {/* Quick Broadcast Input */}
        <form onSubmit={handleBroadcast} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '0.75rem', display: 'flex', gap: '0.5rem' }}>
          <input
            className="input-dark"
            value={msg}
            onChange={e => setMsg(e.target.value)}
            placeholder="Quick alert to concourse..."
            style={{ flex: 1, fontSize: '0.8125rem' }}
          />
          <button type="submit" disabled={sending || !msg.trim()} className="btn-glow" style={{ padding: '0 0.875rem' }}>
            {sending ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
          </button>
        </form>

        {broadcastOk && (
          <p style={{ fontSize: '0.75rem', color: 'var(--success)', textAlign: 'center' }}>✓ Alert broadcast sent to concourse screens</p>
        )}

        {/* Incidents Section */}
        <div>
          <p style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
            Active Incidents ({incidents.length})
          </p>
          {incidents.length === 0 ? (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.875rem', textAlign: 'center' }}>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)' }}>No active incidents. Zone clear.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {incidents.map(inc => (
                <div key={inc.id} style={{ background: 'color-mix(in srgb, var(--danger) 10%, var(--surface))', border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)', borderRadius: 10, padding: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <AlertTriangle size={15} color="var(--danger)" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, fontSize: '0.8125rem', color: 'var(--danger)' }}>{inc.title}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-2)', marginTop: 2 }}>{inc.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Zone Status Cards */}
        <div>
          <p style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
            Zone Telemetry
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.625rem' }}>
            {venue?.zones.map(zone => {
              const zData = crowd?.zones[zone.id];
              const density = zData?.density ?? zone.density;
              const count = zData?.count ?? zone.currentCount;
              const dColor = fmtDensityColor(density);

              return (
                <div key={zone.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.8125rem' }}>{zone.name}</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: dColor }}>{fmtPct(density)}</span>
                  </div>
                  <div className="progress-track" style={{ height: 4, marginBottom: '0.375rem' }}>
                    <div className="progress-fill" style={{ width: `${density * 100}%`, background: dColor }} />
                  </div>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--text-3)' }}>{fmtCount(count)} guests</span>
                </div>
              );
            })}
          </div>
        </div>

      </main>

      <footer style={{ padding: '0.5rem', background: 'var(--surface)', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
        <p style={{ fontSize: '0.65rem', color: 'var(--text-4)' }}>VenueFlow Mobile Staff View · Secure Link</p>
      </footer>
    </div>
  );
}
