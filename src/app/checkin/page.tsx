'use client';
/**
 * /checkin — Guest Venue Selector & QR Entrance Hub
 *
 * Allows guests to pick their venue, search by name/city, or paste/scan a venue QR code.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Activity, ArrowRight, Camera, CheckCircle2, Compass,
  Globe, Loader2, MapPin, QrCode, Search, Sparkles, Users,
} from 'lucide-react';
import { listenToPath } from '@/lib/firebase';
import { SAMPLE_VENUES, SAMPLE_COMPLEX, SAMPLE_SPACES, SAMPLE_SPACE_EVENTS } from '@/lib/sampleData';
import { Venue } from '@/types';

export default function GuestVenueSelectorPage() {
  const router = useRouter();

  const [venues, setVenues] = useState<Venue[]>(SAMPLE_VENUES);
  const [search, setSearch] = useState('');
  const [qrInput, setQrInput] = useState('');
  const [activeTab, setActiveTab] = useState<'select' | 'scan'>('select');
  const [loading, setLoading] = useState(true);

  // Fetch all venues from server API and subscribe to RTDB updates dynamically
  useEffect(() => {
    let isMounted = true;

    // 1. Fetch from server API
    fetch('/api/venues')
      .then(r => r.json())
      .then(res => {
        if (res.ok && Array.isArray(res.venues) && isMounted) {
          setVenues(res.venues);
          setLoading(false);
        }
      })
      .catch(() => {});

    // 2. Listen to RTDB venues
    const unsub = listenToPath<Record<string, Partial<Venue>>>('venues', (data) => {
      if (data && typeof data === 'object' && isMounted) {
        setVenues(prev => {
          const mergedMap = new Map<string, Venue>();
          SAMPLE_VENUES.forEach(v => mergedMap.set(v.id, v));
          prev.forEach(v => mergedMap.set(v.id, v));

          Object.entries(data).forEach(([id, v]) => {
            const existing = mergedMap.get(id);
            mergedMap.set(id, {
              id,
              name: v.name || existing?.name || id,
              city: v.city || existing?.city || 'Location',
              capacity: v.capacity || existing?.capacity || 50000,
              lat: v.lat ?? existing?.lat ?? 0,
              lng: v.lng ?? existing?.lng ?? 0,
              zones: (v.zones ? (Array.isArray(v.zones) ? v.zones : Object.values(v.zones)) : existing?.zones) || [],
              amenities: (v.amenities ? (Array.isArray(v.amenities) ? v.amenities : Object.values(v.amenities)) : existing?.amenities) || [],
              sections: (v.sections ? (Array.isArray(v.sections) ? v.sections : Object.values(v.sections)) : existing?.sections) || [],
              imageUrl: v.imageUrl || existing?.imageUrl,
            } as Venue);
          });

          return Array.from(mergedMap.values());
        });
      }
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
      unsub();
    };
  }, []);

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrInput.trim()) return;

    let target = qrInput.trim();

    // Handle full QR URLs like http://localhost:3000/checkin/bharat-mandap/space/hall-a-floor1?event=evt-ai-track
    if (target.includes('/checkin/')) {
      const parts = target.split('/checkin/');
      if (parts[1]) {
        router.push(`/checkin/${parts[1]}`);
        return;
      }
    } else if (target.includes('/g/')) {
      const parts = target.split('/g/');
      if (parts[1]) {
        router.push(`/g/${parts[1]}`);
        return;
      }
    } else if (target.includes('/location-update')) {
      const parts = target.split('/location-update');
      if (parts[1]) {
        router.push(`/location-update${parts[1]}`);
        return;
      }
    }

    // Clean slug
    target = target.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
    router.push(`/checkin/${target}`);
  };

  const filteredVenues = venues.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.city.toLowerCase().includes(search.toLowerCase())
  );

  const complexMatchesSearch =
    SAMPLE_COMPLEX.name.toLowerCase().includes(search.toLowerCase()) ||
    SAMPLE_COMPLEX.city.toLowerCase().includes(search.toLowerCase()) ||
    SAMPLE_SPACES.some(s => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--text-1)', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)', padding: '1rem 1.5rem', position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: 'var(--text-1)' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={16} color="#fff" />
            </div>
            <span style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.02em' }}>VenueFlow</span>
          </Link>

          <span className="chip" style={{ background: 'color-mix(in srgb, var(--brand-light) 12%, transparent)', color: 'var(--brand-light)', borderColor: 'color-mix(in srgb, var(--brand-light) 30%, transparent)' }}>
            🎟️ Guest Check-In Portal
          </span>
        </div>
      </header>

      {/* Main Body */}
      <main style={{ maxWidth: 760, margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-1)', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
            Enter Your Stadium, Arena, or Event Complex
          </h1>
          <p style={{ fontSize: '0.9375rem', color: 'var(--text-3)' }}>
            Select your venue below or scan your entrance QR code to launch live crowd map and tutorial.
          </p>
        </div>

        {/* Tab switch: Select Venue vs Scan QR */}
        <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 4, marginBottom: '1.5rem' }}>
          <button
            onClick={() => setActiveTab('select')}
            style={{
              flex: 1,
              padding: '0.625rem',
              borderRadius: 8,
              border: 'none',
              background: activeTab === 'select' ? 'var(--brand)' : 'transparent',
              color: activeTab === 'select' ? '#fff' : 'var(--text-3)',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
            }}
          >
            <Compass size={16} /> Choose Venue & Complex
          </button>

          <button
            onClick={() => setActiveTab('scan')}
            style={{
              flex: 1,
              padding: '0.625rem',
              borderRadius: 8,
              border: 'none',
              background: activeTab === 'scan' ? 'var(--brand)' : 'transparent',
              color: activeTab === 'scan' ? '#fff' : 'var(--text-3)',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.15s ease',
            }}
          >
            <QrCode size={16} /> Enter QR / Link
          </button>
        </div>

        {/* TAB 1: Select Venue */}
        {activeTab === 'select' && (
          <div>
            {/* Search Input */}
            <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
              <Search size={16} color="var(--text-3)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search venue by name, city, hall, or event..."
                className="input-dark"
                style={{ width: '100%', paddingLeft: 40 }}
              />
            </div>

            {/* 1. Multi-Event Convention Complex Section */}
            {complexMatchesSearch && (
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
                  <span className="live-badge"><span className="live-dot" />MULTI-EVENT COMPLEX (v2)</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-4)' }}>Concurrent event spaces</span>
                </div>

                <div style={{ background: 'var(--surface)', border: '1px solid color-mix(in srgb, var(--brand) 35%, var(--border))', borderRadius: 16, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: 'var(--shadow)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div>
                      <h2 style={{ fontSize: '1.125rem', fontWeight: 800, color: 'var(--text-1)' }}>{SAMPLE_COMPLEX.name}</h2>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)', marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <MapPin size={13} /> {SAMPLE_COMPLEX.city} · {SAMPLE_COMPLEX.totalCapacity.toLocaleString()} total capacity · {SAMPLE_COMPLEX.floors} floors
                      </p>
                    </div>
                    <Link
                      href={`/complex/${SAMPLE_COMPLEX.id}`}
                      className="btn-ghost"
                      style={{ fontSize: '0.75rem', padding: '0.3rem 0.625rem', borderRadius: 8, color: 'var(--brand-light)' }}
                    >
                      🏢 Facility Admin
                    </Link>
                  </div>

                  {/* Spaces / Halls List */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                    {SAMPLE_SPACES.filter(s => !s.isShared).map(space => {
                      const evt = SAMPLE_SPACE_EVENTS.find(e => e.spaceId === space.id);
                      return (
                        <div
                          key={space.id}
                          onClick={() => router.push(`/checkin/${SAMPLE_COMPLEX.id}/space/${space.id}${evt ? `?event=${evt.id}` : ''}`)}
                          style={{
                            background: 'var(--surface-2)',
                            border: '1px solid var(--border)',
                            borderRadius: 12,
                            padding: '0.875rem 1rem',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.borderColor = 'var(--brand-light)';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = 'var(--border)';
                            e.currentTarget.style.transform = 'translateY(0)';
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                              <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-4)', textTransform: 'uppercase' }}>
                                {space.floor === 0 ? 'Ground Floor' : `Floor ${space.floor}`}
                              </span>
                              <span className="chip chip-green" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
                                {space.capacity} cap
                              </span>
                            </div>
                            <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-1)', marginBottom: '0.25rem' }}>{space.name}</h3>
                            {evt && (
                              <p style={{ fontSize: '0.75rem', color: 'var(--brand-light)', fontWeight: 500, lineHeight: 1.3, marginBottom: '0.5rem' }}>
                                🎤 {evt.name}
                              </p>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Gate Check-in</span>
                            <span style={{ color: 'var(--brand-light)', display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.75rem', fontWeight: 600 }}>
                              Enter <ArrowRight size={13} />
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 2. Stadium & Single Venue Section */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
                <span className="live-badge"><span className="live-dot" />STADIUMS & ARENAS</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-4)' }}>Single-event venues</span>
              </div>

              {loading ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-3)' }}>
                  <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 0.5rem' }} />
                  <p style={{ fontSize: '0.875rem' }}>Loading active venues…</p>
                </div>
              ) : filteredVenues.length === 0 && !complexMatchesSearch ? (
                <div style={{ background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: 14, padding: '2.5rem 1.5rem', textAlign: 'center', color: 'var(--text-3)' }}>
                  <MapPin size={28} style={{ margin: '0 auto 0.5rem' }} />
                  <p>No venues found matching "{search}".</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                  {filteredVenues.map(v => (
                    <div
                      key={v.id}
                      onClick={() => router.push(`/checkin/${v.id}`)}
                      style={{
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 14,
                        padding: '1.125rem 1.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = 'var(--brand-light)';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                          width: 44,
                          height: 44,
                          borderRadius: 12,
                          background: 'color-mix(in srgb, var(--brand) 15%, transparent)',
                          border: '1px solid color-mix(in srgb, var(--brand) 30%, transparent)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <MapPin size={20} color="var(--brand-light)" />
                        </div>

                        <div>
                          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-1)', marginBottom: 2 }}>{v.name}</h3>
                          <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span>📍 {v.city}</span>
                            <span>👥 {v.capacity ? v.capacity.toLocaleString() : '50,000'} capacity</span>
                          </p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--brand-light)', fontWeight: 600, fontSize: '0.875rem' }}>
                        Check-in <ArrowRight size={15} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Scan / Paste QR Code Link */}
        {activeTab === 'scan' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '2rem 1.5rem', textAlign: 'center' }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: 'color-mix(in srgb, var(--brand-light) 15%, transparent)',
              border: '1px solid color-mix(in srgb, var(--brand-light) 30%, transparent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
            }}>
              <QrCode size={28} color="var(--brand-light)" />
            </div>

            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-1)', marginBottom: '0.375rem' }}>
              Paste QR Link or Venue ID
            </h3>
            <p style={{ fontSize: '0.84375rem', color: 'var(--text-3)', maxWidth: 360, margin: '0 auto 1.5rem' }}>
              If you scanned a printed QR code or received a link from venue staff, paste it below to enter.
            </p>

            <form onSubmit={handleScanSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', maxWidth: 440, margin: '0 auto' }}>
              <input
                value={qrInput}
                onChange={e => setQrInput(e.target.value)}
                placeholder="e.g. metlife-stadium or paste QR URL..."
                className="input-dark"
                style={{ width: '100%', fontSize: '0.875rem' }}
              />

              <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '0.75rem', fontSize: '0.9375rem' }}>
                <Sparkles size={16} /> Enter Venue Check-In
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
