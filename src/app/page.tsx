'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Activity, Users, Clock, Zap, ArrowRight, ChevronRight, Shield, Map } from 'lucide-react';
import { getDensityColor, formatPercent } from '@/lib/utils';
import { fmtCount } from '@/lib/formatters';
import { useAllVenues } from '@/hooks/useRealtimeData';
import { ensureAllVenuesSeeded } from '@/lib/seedFirebase';

export default function HomePage() {
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState(new Date());
  const [hovered, setHovered] = useState<string | null>(null);
  const { venues } = useAllVenues();

  useEffect(() => {
    setMounted(true);
    const t = setInterval(() => setTime(new Date()), 1000);
    // Seed all venues to Firebase RTDB on first page load
    ensureAllVenuesSeeded();
    return () => clearInterval(t);
  }, []);

  const allDensities = venues.flatMap(v => v.zones.map(z => z.density));
  const avgDensity = allDensities.length ? allDensities.reduce((a, b) => a + b, 0) / allDensities.length : 0.67;
  const totalAttendees = venues.reduce((s, v) => s + v.zones.reduce((zs, z) => zs + z.currentCount, 0), 0) || 147820;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>

      {/* ── Radial glow backdrop ─────────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(59,130,246,0.12) 0%, transparent 70%)',
      }} />
      <div className="bg-grid" style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, opacity: 0.4 }} />

      {/* ── Top nav ─────────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(8,12,24,0.85)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 1.5rem', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 16px rgba(59,130,246,0.4)',
            }}>
              <Activity size={16} color="#fff" />
            </div>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.01em' }}>
              Venue<span style={{ color: 'var(--blue-soft)' }}>Flow</span>
            </span>
          </div>

          {/* Center: live ticker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <span className="live-badge"><span className="live-dot" />Live</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-3)', fontFamily: 'JetBrains Mono, monospace' }}>
              {mounted ? time.toLocaleTimeString() : '--:--:--'}
            </span>
          </div>

          {/* Right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Link href="/admin" style={{ textDecoration: 'none' }}>
              <button className="btn-ghost">
                <Shield size={14} /> Admin
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <header style={{ position: 'relative', zIndex: 1, padding: '5rem 1.5rem 4rem', textAlign: 'center' }}>
        {/* Eyebrow */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
          <div className="chip chip-blue">
            <Zap size={10} /> AI-Powered Intelligence
          </div>
        </div>

        <h1 style={{
          fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', fontWeight: 900,
          letterSpacing: '-0.04em', lineHeight: 1.05,
          color: 'var(--text-1)', marginBottom: '1.25rem',
        }}>
          The Control Room<br />
          <span style={{
            background: 'linear-gradient(135deg, #60a5fa 0%, #818cf8 50%, #a78bfa 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>for Every Venue</span>
        </h1>

        <p style={{ fontSize: '1.125rem', color: 'var(--text-2)', maxWidth: 560, margin: '0 auto 2.5rem', lineHeight: 1.65 }}>
          Real-time crowd intelligence, AI wait-time predictions, and smart navigation — all in one command center.
        </p>

        {/* Live global stats strip */}
        <div style={{
          display: 'inline-flex', gap: '0', borderRadius: 14,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid var(--border)',
          overflow: 'hidden', marginBottom: '0.5rem',
        }}>
          {[
            { label: 'Live Venues', value: venues.length.toString(), icon: Map },
            { label: 'Attendees', value: fmtCount(totalAttendees), icon: Users },
            { label: 'Avg Density', value: formatPercent(avgDensity), icon: Activity, color: getDensityColor(avgDensity) },
            { label: 'Avg Wait', value: '7m', icon: Clock, color: 'var(--green)' },
          ].map(({ label, value, icon: Icon, color }, i) => (
            <div key={label} style={{
              padding: '0.875rem 1.5rem',
              borderRight: i < 3 ? '1px solid var(--border)' : 'none',
              minWidth: 130,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                <Icon size={12} color={color ?? 'var(--text-4)'} />
                <span className="label-xs">{label}</span>
              </div>
              <div className="stat-lg mono" style={{ color: color ?? 'var(--text-1)' }}>{value}</div>
            </div>
          ))}
        </div>
      </header>

      {/* ── Venue Cards ─────────────────────────────────────────────────────── */}
      <main style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto', padding: '0 1.5rem 6rem' }}>
        <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>Active Venues</h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)', marginTop: 2 }}>Click any venue to open the live dashboard</p>
          </div>
          <span className="chip chip-blue">{venues.length} Live</span>
        </div>

        <div className="anim-stagger" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: '1.25rem',
        }}>
          {venues.map((venue, i) => {
            const density = venue.zones.reduce((s, z) => s + z.density, 0) / venue.zones.length;
            const densityColor = getDensityColor(density);
            const isHovered = hovered === venue.id;

            const gradients = [
              'linear-gradient(135deg, #1e3a6e 0%, #0d1225 100%)',
              'linear-gradient(135deg, #1a1a4e 0%, #0d1225 100%)',
              'linear-gradient(135deg, #1e2a4e 0%, #0d1225 100%)',
            ];

            return (
              <Link key={venue.id} href={`/venue/${venue.id}`} style={{ textDecoration: 'none' }}>
                <div
                  onMouseEnter={() => setHovered(venue.id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    background: 'var(--bg-2)',
                    border: `1px solid ${isHovered ? 'rgba(59,130,246,0.3)' : 'var(--border)'}`,
                    borderRadius: 18,
                    overflow: 'hidden',
                    transition: 'all 0.25s ease',
                    transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
                    boxShadow: isHovered ? '0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(59,130,246,0.1)' : '0 4px 20px rgba(0,0,0,0.2)',
                    cursor: 'pointer',
                  }}
                >
                  {/* Card header image area */}
                  <div style={{
                    height: 120,
                    background: gradients[i % 3],
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {/* Decorative rings */}
                    <div style={{
                      position: 'absolute', width: 200, height: 200,
                      borderRadius: '50%', border: `1px solid ${densityColor}22`,
                      top: '50%', left: '50%',
                      transform: 'translate(-50%, -50%)',
                    }} />
                    <div style={{
                      position: 'absolute', width: 140, height: 140,
                      borderRadius: '50%', border: `1px solid ${densityColor}33`,
                      top: '50%', left: '50%',
                      transform: 'translate(-50%, -50%)',
                    }} />
                    <div style={{
                      width: 60, height: 60, borderRadius: '50%',
                      background: `${densityColor}22`,
                      border: `2px solid ${densityColor}55`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: `0 0 24px ${densityColor}44`,
                    }}>
                      <Activity size={22} color={densityColor} />
                    </div>
                    {/* capacity badge */}
                    <div style={{ position: 'absolute', top: 12, left: 14 }}>
                      <div className="chip chip-blue" style={{ backdropFilter: 'blur(8px)', background: 'rgba(59,130,246,0.15)' }}>
                        <Users size={9} /> {(venue.capacity / 1000).toFixed(0)}k cap
                      </div>
                    </div>
                    <div style={{ position: 'absolute', top: 12, right: 14 }}>
                      <span className="live-badge"><span className="live-dot" />Live</span>
                    </div>
                  </div>

                  {/* Card body */}
                  <div style={{ padding: '1.125rem 1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
                      <div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.01em' }}>{venue.name}</h3>
                        <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)', marginTop: 2 }}>{venue.city}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div className="stat-lg mono" style={{ color: densityColor }}>{formatPercent(density)}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-4)', marginTop: 1 }}>avg density</div>
                      </div>
                    </div>

                    {/* Zone density bars */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                      {venue.zones.slice(0, 3).map(zone => {
                        const zColor = getDensityColor(zone.density);
                        return (
                          <div key={zone.id}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{zone.name}</span>
                              <span className="mono" style={{ fontSize: '0.75rem', color: zColor, fontWeight: 600 }}>{formatPercent(zone.density)}</span>
                            </div>
                            <div className="progress-track">
                              <div className="progress-fill" style={{ width: formatPercent(zone.density), background: `linear-gradient(90deg, ${zColor}88, ${zColor})` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Footer */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <span className={`chip ${density > 0.7 ? 'chip-red' : density > 0.4 ? 'chip-amber' : 'chip-green'}`}>
                          {density > 0.7 ? '⚠ High' : density > 0.4 ? 'Moderate' : 'Low'} Crowd
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--blue-soft)', fontSize: '0.8rem', fontWeight: 600 }}>
                        Open Dashboard <ChevronRight size={14} />
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* ── Feature strip ─────────────────────────────────────────────────── */}
        <div className="card" style={{ marginTop: '3rem', padding: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem' }}>
          {[
            { icon: Activity, color: '#3b82f6', title: 'Real-Time Density', body: 'Live crowd tracking across all zones with 30-second refresh cycles.' },
            { icon: Clock, color: '#10b981', title: 'AI Wait Predictions', body: 'Gemini-powered predictions for concession and restroom wait times.' },
            { icon: Map, color: '#f59e0b', title: 'Smart Navigation', body: 'Crowd-aware routing guides fans to the least congested amenities.' },
            { icon: Zap, color: '#a78bfa', title: 'Instant Alerts', body: 'Push notifications for high-density zones, gate delays, and emergencies.' },
          ].map(({ icon: Icon, color, title, body }) => (
            <div key={title} style={{ display: 'flex', gap: '0.875rem' }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: `${color}18`,
                border: `1px solid ${color}33`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={16} color={color} />
              </div>
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>{title}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-3)', lineHeight: 1.55 }}>{body}</div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
