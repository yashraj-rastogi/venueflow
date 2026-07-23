'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Activity, AlertTriangle, ArrowRight, Eye, Globe, Loader2,
  LogOut, MapPin, Plus, Shield, Trash2, Users, Wifi, X, CheckCircle,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getOrganization, getOrgVenues, getOpenIncidents } from '@/lib/firestore';
import { Organization, Venue, Incident } from '@/types';
import { fmtCount, fmtPct, fmtDensityColor } from '@/lib/formatters';
import { SAMPLE_VENUES } from '@/lib/sampleData';
import { signOut } from '@/lib/firebase';

export default function OrgDashboard() {
  const { orgId }  = useParams<{ orgId: string }>();
  const router     = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [org,       setOrg]       = useState<Organization | null>(null);
  const [venues,    setVenues]    = useState<Venue[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading,   setLoading]   = useState(true);

  // Add venue modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newVenueName, setNewVenueName] = useState('');
  const [newVenueCity, setNewVenueCity] = useState('');
  const [newMapsUrl,   setNewMapsUrl]   = useState('');
  const [customApiKey, setCustomApiKey] = useState('');
  const [importing,    setImporting]    = useState(false);
  const [importMsg,    setImportMsg]    = useState('');
  const [importError,  setImportError]  = useState('');

  // Delete venue state
  const [deletingId,   setDeletingId]   = useState<string | null>(null);
  const [deleteError,  setDeleteError]  = useState('');

  useEffect(() => { if (!authLoading && !user) router.push('/login'); }, [user, authLoading, router]);

  const loadVenues = async () => {
    if (!orgId) return;
    try {
      const [o, v] = await Promise.all([getOrganization(orgId), getOrgVenues(orgId)]);
      setOrg(o);
      // Demo single stadium fallback if no venues created in org
      setVenues(v.length > 0 ? v : [SAMPLE_VENUES[0]]);
    } catch {
      setVenues([SAMPLE_VENUES[0]]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVenue = async (venueId: string, venueName: string) => {
    if (!confirm(`Delete "${venueName}"?\nThis will permanently remove all crowd data, wait times, and notifications.\n\nThis action cannot be undone.`)) return;
    setDeletingId(venueId);
    setDeleteError('');
    try {
      const res = await fetch('/api/venues/delete', {
        method : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ orgId, venueId }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? 'Delete failed');
      // Optimistically remove from local state
      setVenues(prev => prev.filter(v => v.id !== venueId));
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete venue');
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    loadVenues();
  }, [orgId]);

  const handleImportVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVenueName.trim()) { setImportError('Venue name is required'); return; }

    setImporting(true);
    setImportError('');
    setImportMsg('');

    try {
      const res = await fetch('/api/venues/import', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({
          orgId,
          name   : newVenueName.trim(),
          city   : newVenueCity.trim(),
          mapsUrl: newMapsUrl.trim(),
          apiKey : customApiKey.trim(),
        }),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? 'Import failed');

      setImportMsg(data.message ?? 'Venue added successfully!');

      // Reset inputs & refresh venue list
      setTimeout(() => {
        setShowAddModal(false);
        setNewVenueName('');
        setNewVenueCity('');
        setNewMapsUrl('');
        setImportMsg('');
        setLoading(true);
        loadVenues();
      }, 1500);

    } catch (err) {
      setImportError(String(err));
    } finally {
      setImporting(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={20} color="var(--brand-light)" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  const totalCapacity = venues.reduce((s, v) => s + v.capacity, 0);
  const liveCount     = venues.filter(v => v.zones.some(z => z.density > 0.1)).length;
  const openIncidents = incidents.filter(i => i.status === 'open').length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text-1)' }}>

      {/* ── Top Nav ─────────────────────────────────────────────────────────── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 40, height: 56, background: 'rgba(9,9,11,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 1.5rem', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity size={13} color="#fff" />
          </div>
          <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>VenueFlow</span>
          <span style={{ color: 'var(--border-hi)', margin: '0 0.25rem' }}>/</span>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-2)' }}>{org?.name ?? 'Your Organization'}</span>
        </div>
        <button onClick={() => signOut().then(() => router.push('/'))} className="btn-ghost" style={{ padding: '0.375rem 0.625rem', gap: '0.375rem' }}>
          <LogOut size={13} /> Sign out
        </button>
      </nav>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.375rem', fontWeight: 700, letterSpacing: '-0.025em', marginBottom: '0.25rem' }}>{org?.name ?? 'Your Venues'}</h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-3)' }}>{venues.length} venue{venues.length !== 1 ? 's' : ''} · {fmtCount(totalCapacity)} total capacity</p>
          </div>
          <button onClick={() => setShowAddModal(true)} className="btn-primary" style={{ gap: '0.375rem', fontSize: '0.875rem' }}>
            <Plus size={14} /> Add venue with Google Maps
          </button>
        </div>

        {/* ── Stats row ───────────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.75rem' }}>
          {[
            { label: 'Total venues',   value: venues.length,          icon: MapPin,        color: 'var(--brand-light)' },
            { label: 'Live now',       value: liveCount,              icon: Wifi,          color: 'var(--success)' },
            { label: 'Total capacity', value: fmtCount(totalCapacity), icon: Users,         color: 'var(--text-2)' },
            { label: 'Open incidents', value: openIncidents,          icon: AlertTriangle, color: openIncidents > 0 ? 'var(--danger)' : 'var(--text-2)' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: `color-mix(in srgb, ${s.color} 12%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <s.icon size={15} color={s.color} />
              </div>
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-1)', lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Venue grid ──────────────────────────────────────────────────────── */}
        <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-3)', marginBottom: '0.875rem', letterSpacing: '-0.01em' }}>Venues</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.875rem' }}>
          {venues.map(venue => {
            const avgDensity    = venue.zones.reduce((s, z) => s + z.density, 0) / Math.max(venue.zones.length, 1);
            const totalCount    = venue.zones.reduce((s, z) => s + z.currentCount, 0);
            const criticalZones = venue.zones.filter(z => z.density > 0.85).length;
            const dColor        = fmtDensityColor(avgDensity);
            const isLive        = avgDensity > 0.05;
            return (
              <div key={venue.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                {/* Top density bar */}
                <div style={{ height: 2, background: 'var(--surface-2)' }}>
                  <div style={{ height: '100%', width: `${avgDensity * 100}%`, background: dColor, transition: 'width 0.8s ease' }} />
                </div>
                <div style={{ padding: '1.125rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.875rem' }}>
                    <div>
                      <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-1)', marginBottom: '0.2rem' }}>{venue.name}</h3>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)' }}><MapPin size={10} style={{ display: 'inline', marginRight: 3 }} />{venue.city}</p>
                    </div>
                    {isLive ? <span className="live-badge"><span className="live-dot" />Live</span> : <span className="chip">Idle</span>}
                  </div>

                  {/* Inline zone strip */}
                  <div style={{ display: 'flex', gap: '2px', marginBottom: '0.875rem' }}>
                    {venue.zones.slice(0, 12).map(zone => (
                      <div key={zone.id} title={`${zone.name}: ${fmtPct(zone.density)}`} style={{ flex: 1, height: 5, borderRadius: 2, background: zone.density > 0.8 ? 'var(--danger)' : zone.density > 0.5 ? 'var(--warning)' : zone.density > 0.08 ? 'var(--success)' : 'var(--border)' }} />
                    ))}
                  </div>

                  {/* Stats */}
                  <div style={{ display: 'flex', gap: '1.25rem', marginBottom: '1rem' }}>
                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-1)' }}>{fmtCount(totalCount)}</div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--text-3)' }}>Guests</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: dColor }}>{fmtPct(avgDensity)}</div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--text-3)' }}>Occupancy</div>
                    </div>
                    {criticalZones > 0 && (
                      <div>
                        <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--danger)' }}>{criticalZones}</div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-3)' }}>Critical</div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Link href={`/org/${orgId}/venue/${venue.id}/admin`} className="btn-primary" style={{ flex: 1, justifyContent: 'center', fontSize: '0.8125rem', padding: '0.4375rem' }}>
                      <Shield size={13} /> Admin
                    </Link>
                    <Link href={`/g/${venue.id}`} className="btn-ghost" style={{ flex: 1, justifyContent: 'center', fontSize: '0.8125rem', padding: '0.4375rem' }}>
                      <Eye size={13} /> Guest view
                    </Link>
                    {venue.id !== 'metlife-stadium' && (
                      <button
                        onClick={() => handleDeleteVenue(venue.id, venue.name)}
                        disabled={deletingId === venue.id}
                        title="Delete venue"
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--border)',
                          borderRadius: 7,
                          padding: '0.4375rem 0.625rem',
                          cursor: deletingId === venue.id ? 'not-allowed' : 'pointer',
                          color: deletingId === venue.id ? 'var(--text-4)' : 'var(--danger)',
                          display: 'flex',
                          alignItems: 'center',
                          opacity: deletingId === venue.id ? 0.5 : 1,
                          transition: 'all 0.15s',
                        }}
                      >
                        {deletingId === venue.id
                          ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                          : <Trash2 size={13} />}
                      </button>
                    )}
                  </div>
                  {deleteError && deletingId === null && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '0.5rem' }}>{deleteError}</p>
                  )}
                </div>
              </div>
            );
          })}

          {/* Add venue card button */}
          <div onClick={() => setShowAddModal(true)} style={{ background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 12, padding: '1.125rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', minHeight: 180, opacity: 0.7, cursor: 'pointer', transition: 'opacity 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
          >
            <Plus size={20} color="var(--brand-light)" />
            <span style={{ fontSize: '0.875rem', color: 'var(--text-1)', fontWeight: 500 }}>Add Real Stadium / Venue</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Import via Google Maps URL or Location</span>
          </div>
        </div>
      </main>

      {/* ── Add Venue Modal ─────────────────────────────────────────────────── */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, maxWidth: 480, width: '100%', padding: '1.75rem', position: 'relative' }}>
            <button onClick={() => setShowAddModal(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}>
              <X size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
              <Globe size={18} color="var(--brand-light)" />
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700 }}>Add Real World Venue</h2>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Enter the stadium name or paste a Google Maps location URL. We'll fetch real-world coordinates and set up map zones automatically.
            </p>

            <form onSubmit={handleImportVenue} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label className="label-xs" style={{ display: 'block', marginBottom: '0.375rem' }}>Stadium / Venue Name *</label>
                <input className="input-dark" placeholder="e.g. Wembley Stadium or Madison Square Garden" value={newVenueName} onChange={e => setNewVenueName(e.target.value)} autoFocus required />
              </div>

              <div>
                <label className="label-xs" style={{ display: 'block', marginBottom: '0.375rem' }}>Google Maps Location URL (optional)</label>
                <input className="input-dark" placeholder="https://www.google.com/maps/place/..." value={newMapsUrl} onChange={e => setNewMapsUrl(e.target.value)} />
                <p style={{ fontSize: '0.7rem', color: 'var(--text-4)', marginTop: '0.25rem' }}>Paste any Google Maps pin/share link to extract real coordinates (@lat,lng).</p>
              </div>

              <div>
                <label className="label-xs" style={{ display: 'block', marginBottom: '0.375rem' }}>City / Location (optional)</label>
                <input className="input-dark" placeholder="e.g. London, UK or New York, NY" value={newVenueCity} onChange={e => setNewVenueCity(e.target.value)} />
              </div>

              <div>
                <label className="label-xs" style={{ display: 'block', marginBottom: '0.375rem' }}>Google Places API Key (optional override)</label>
                <input className="input-dark" type="password" placeholder="AIzaSy..." value={customApiKey} onChange={e => setCustomApiKey(e.target.value)} />
                <p style={{ fontSize: '0.7rem', color: 'var(--text-4)', marginTop: '0.25rem' }}>Optional: If provided, fetches Place Details & photos directly from Google Places API.</p>
              </div>

              {importMsg && (
                <div style={{ padding: '0.625rem 0.875rem', borderRadius: 8, background: 'var(--success-bg)', border: '1px solid var(--success-border)', fontSize: '0.8125rem', color: 'var(--success)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <CheckCircle size={14} /> {importMsg}
                </div>
              )}

              {importError && (
                <div style={{ padding: '0.625rem 0.875rem', borderRadius: 8, background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', fontSize: '0.8125rem', color: 'var(--danger)' }}>
                  {importError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
                <button type="submit" disabled={importing || !newVenueName.trim()} className="btn-primary" style={{ flex: 1, justifyContent: 'center', opacity: !newVenueName.trim() ? 0.5 : 1 }}>
                  {importing ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <><MapPin size={15} /> Add Venue</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
