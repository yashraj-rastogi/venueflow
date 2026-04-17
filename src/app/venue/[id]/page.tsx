'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  Activity, Bell, Navigation, Coffee, LogOut, Users, Clock,
  TrendingUp, TrendingDown, Minus, Shield, Map, AlertTriangle,
  X, CheckCircle, Info, Zap, ChevronRight, BarChart3, Loader2
} from 'lucide-react';
import { SAMPLE_VENUES } from '@/lib/sampleData';
import { getDensityColor, formatPercent, formatCount, formatWaitTime, getTrendColor, timeAgo } from '@/lib/utils';
import { Notification } from '@/types';
import { useCrowdData, useNotifications } from '@/hooks/useRealtimeData';
import { optimizeRoute } from '@/lib/gemini';
const VenueMap = dynamic(() => import('@/components/Map'), { ssr: false, loading: () => <div style={{ flex: 1, background: 'var(--bg-2)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={24} color="var(--text-4)" style={{ animation: 'spin 1s linear infinite' }} /></div> });
const AIChat = dynamic(() => import('@/components/AIChat'), { ssr: false });

type Tab = 'overview' | 'amenities' | 'navigate';

export default function VenueDashboardPage() {
  const params = useParams();
  const venueId = params?.id as string;
  const venue = SAMPLE_VENUES.find(v => v.id === venueId);

  // ── Live Firebase data ───────────────────────────────────────────────────
  const { crowd, isLive, triggerUpdate } = useCrowdData(venueId);
  const { notifications, unreadCount } = useNotifications(venueId);

  // ── Local UI state ───────────────────────────────────────────────────────
  const [showNotifs, setShowNotifs] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState(new Date());
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  // ── Gemini directions state ──────────────────────────────────────────────
  const [navFrom, setNavFrom] = useState(venue?.sections[0]?.id ?? '');
  const [navTo, setNavTo] = useState(venue?.amenities[0]?.id ?? '');
  const [navMode, setNavMode] = useState<'fastest' | 'least_crowded'>('fastest');
  const [navResult, setNavResult] = useState<{ suggestion: string; crowdLevel: string; estimatedTime: number } | null>(null);
  const [navLoading, setNavLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
    const t1 = setInterval(() => setTime(new Date()), 1000);
    // Auto-trigger crowd update every 30s via API route
    const t2 = setInterval(() => triggerUpdate(), 30000);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, [triggerUpdate]);

  const handleGetDirections = async () => {
    if (!venue) return;
    setNavLoading(true);
    setNavResult(null);
    const fromLabel = venue.sections.find(s => s.id === navFrom)?.name ?? navFrom;
    const toLabel = venue.amenities.find(a => a.id === navTo)?.name ?? navTo;
    try {
      const res = await optimizeRoute(fromLabel, toLabel, crowd, navMode === 'least_crowded' ? 'least_crowded' : 'fastest');
      setNavResult(res);
    } catch {
      setNavResult({ suggestion: 'Head via main concourse', crowdLevel: 'medium', estimatedTime: 4 });
    } finally {
      setNavLoading(false);
    }
  };

  const unread = unreadCount;

  if (!venue) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-3)' }}>
          <Activity size={40} style={{ margin: '0 auto 1rem', opacity: 0.4 }} />
          <p style={{ marginBottom: '0.75rem' }}>Venue not found</p>
          <Link href="/" style={{ color: 'var(--blue-soft)', textDecoration: 'none', fontSize: '0.875rem' }}>← Back to venues</Link>
        </div>
      </div>
    );
  }

  const totalCount = Object.values(crowd.zones).reduce((s, z) => s + z.count, 0);
  const avgDensity = Object.values(crowd.zones).reduce((s, z) => s + z.density, 0) / Object.values(crowd.zones).length;
  const maxWait = Math.max(...venue.amenities.map(a => a.waitTime));
  const openAmenities = venue.amenities.filter(a => a.isOpen).length;

  const notifIcon: Record<string, React.ReactNode> = {
    warning:   <AlertTriangle size={14} color="var(--amber)" />,
    success:   <CheckCircle size={14} color="var(--green)" />,
    info:      <Info size={14} color="var(--blue-glow)" />,
    emergency: <AlertTriangle size={14} color="var(--red)" />,
  };

  const SIDEBAR_ITEMS = [
    { id: 'overview'  as Tab, label: 'Overview',   icon: BarChart3 },
    { id: 'amenities' as Tab, label: 'Amenities',  icon: Coffee },
    { id: 'navigate'  as Tab, label: 'Navigate',   icon: Navigation },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex' }}>
      {/* ── Radial glow ──────────────────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse 60% 40% at 10% 0%, rgba(59,130,246,0.08) 0%, transparent 60%)',
      }} />

      {/* ══════════════════════════════════════════════════════════════════════
          SIDEBAR
          ══════════════════════════════════════════════════════════════════════ */}
      <aside style={{
        width: 240, flexShrink: 0,
        background: 'rgba(13,18,37,0.95)',
        backdropFilter: 'blur(20px)',
        borderRight: '1px solid var(--border)',
        position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 40,
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Logo */}
        <div style={{ padding: '1.25rem 1rem', borderBottom: '1px solid var(--border)' }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 16px rgba(59,130,246,0.35)',
              flexShrink: 0,
            }}>
              <Activity size={16} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.01em' }}>
                Venue<span style={{ color: 'var(--blue-soft)' }}>Flow</span>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-4)', marginTop: 1 }}>Mission Control</div>
            </div>
          </Link>
        </div>

        {/* Venue chip */}
        <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-4)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Active Venue</div>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-1)', marginBottom: 3 }}>{venue.name}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{venue.city}</div>
          <div style={{ marginTop: '0.5rem' }}>
            <span className="live-badge"><span className="live-dot" />Live Updates</span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '0.75rem 0.75rem', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div className="label-xs" style={{ padding: '0.4rem 0.5rem', marginBottom: 4 }}>Navigation</div>
          {SIDEBAR_ITEMS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`nav-item ${activeTab === id ? 'active' : ''}`}>
              <Icon size={16} />
              {label}
              {id === 'amenities' && (
                <span style={{ marginLeft: 'auto', fontSize: '0.7rem', padding: '0.1rem 0.45rem', borderRadius: 99, background: 'var(--bg-4)', color: 'var(--text-3)' }}>
                  {openAmenities}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Quick stats in sidebar */}
        <div style={{ padding: '0.75rem 0.75rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ padding: '0.75rem', background: 'var(--bg-1)', borderRadius: 10, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-4)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Total Crowd</div>
            <div className="stat-lg mono" style={{ color: 'var(--text-1)' }}>{formatCount(totalCount)}</div>
            <div className="progress-track" style={{ marginTop: 8 }}>
              <div className="progress-fill" style={{
                width: formatPercent(totalCount / venue.capacity),
                background: `linear-gradient(90deg, var(--blue-glow), var(--indigo))`,
              }} />
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-4)', marginTop: 5 }}>{formatPercent(totalCount / venue.capacity)} of {(venue.capacity / 1000).toFixed(0)}k cap</div>
          </div>
        </div>

        {/* Bottom links */}
        <div style={{ padding: '0.5rem 0.75rem 1rem', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Link href="/admin" style={{ textDecoration: 'none' }}>
            <button className="nav-item"><Shield size={15} /> Admin Console</button>
          </Link>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <button className="nav-item"><LogOut size={15} /> Exit Venue</button>
          </Link>
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════════════════════
          MAIN CONTENT
          ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, marginLeft: 240, display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative', zIndex: 1 }}>

        {/* ── Top header bar ──────────────────────────────────────────────── */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 30,
          background: 'rgba(8,12,24,0.9)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--border)',
          padding: '0 1.75rem',
          height: 60,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.01em' }}>
                {venue.name}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: 2 }}>
                <span className="live-badge" style={{ fontSize: '0.65rem', padding: '0.15rem 0.5rem' }}>
                  <span className="live-dot" style={{ width: 5, height: 5 }} />Live
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-4)', fontFamily: 'JetBrains Mono, monospace' }}>
                  {mounted ? time.toLocaleTimeString() : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Header right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            {/* Avg density indicator */}
            <div style={{
              padding: '0.375rem 0.875rem',
              background: `${getDensityColor(avgDensity)}15`,
              border: `1px solid ${getDensityColor(avgDensity)}30`,
              borderRadius: 8,
              display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: getDensityColor(avgDensity) }} />
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: getDensityColor(avgDensity), fontFamily: 'JetBrains Mono, monospace' }}>
                {formatPercent(avgDensity)}
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>avg density</span>
            </div>

            {/* Notifications */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => { setShowNotifs(!showNotifs); setUnread(0); }}
                style={{
                  padding: '0.5rem', borderRadius: 9,
                  background: showNotifs ? 'var(--bg-4)' : 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--text-2)',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center',
                  position: 'relative',
                  transition: 'all 0.2s',
                }}
              >
                <Bell size={17} />
                {unread > 0 && (
                  <span style={{
                    position: 'absolute', top: -3, right: -3,
                    width: 16, height: 16, borderRadius: '50%',
                    background: 'var(--red)', color: '#fff',
                    fontSize: '0.6rem', fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '2px solid var(--bg)',
                  }}>{unread}</span>
                )}
              </button>

              {/* Notification panel */}
              {showNotifs && (
                <div className="anim-fade-up card-hi" style={{
                  position: 'absolute', top: 'calc(100% + 10px)', right: 0,
                  width: 340, zIndex: 100,
                  padding: '1rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
                    <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-1)' }}>Notifications</h3>
                    <button onClick={() => setShowNotifs(false)} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 2 }}>
                      <X size={15} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {notifications.slice(0, 5).map(n => (
                      <div key={n.id} className={`notif-${n.type}`} style={{ padding: '0.75rem', borderRadius: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                          {notifIcon[n.type]}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-1)', marginBottom: 2 }}>{n.title}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', lineHeight: 1.45 }}>{n.message}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-4)', marginTop: 4 }}>{timeAgo(n.timestamp)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── KPI Strip ──────────────────────────────────────────────────────── */}
        <div className="anim-stagger" style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '1px', background: 'var(--border)',
          borderBottom: '1px solid var(--border)',
        }}>
          {[
            { label: 'Total Crowd', value: formatCount(totalCount), sub: `of ${(venue.capacity / 1000).toFixed(0)}k cap`, color: 'var(--blue-soft)', icon: Users },
            { label: 'Avg Density', value: formatPercent(avgDensity), sub: avgDensity > 0.7 ? '⚠ High — alerts active' : 'Within normal range', color: getDensityColor(avgDensity), icon: Activity },
            { label: 'Active Alerts', value: unread.toString(), sub: `${notifications.length} total notifications`, color: unread > 0 ? 'var(--amber)' : 'var(--green)', icon: Bell },
            { label: 'Max Wait Time', value: `${maxWait}m`, sub: `${openAmenities}/${venue.amenities.length} amenities open`, color: maxWait > 10 ? 'var(--amber)' : 'var(--green)', icon: Clock },
          ].map(({ label, value, sub, color, icon: Icon }) => (
            <div key={label} style={{
              padding: '1.25rem 1.5rem',
              background: 'rgba(13,18,37,0.6)',
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="label-xs">{label}</span>
                <Icon size={14} color={color} />
              </div>
              <div className="stat-xl mono" style={{ color }}>{value}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-4)' }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            OVERVIEW TAB
            ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <main className="anim-fade-in" style={{ flex: 1, padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Zone density grid */}
            <div className="card-hi" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Map size={14} color="var(--blue-glow)" />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-1)' }}>Zone Density</h2>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Live crowd distribution across all zones</p>
                  </div>
                </div>
                {/* Legend */}
                <div style={{ display: 'flex', gap: '1rem' }}>
                  {[['var(--green)', 'Low'], ['var(--amber)', 'Medium'], ['var(--red)', 'High']].map(([c, l]) => (
                    <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: 'var(--text-3)' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: c as string, boxShadow: `0 0 6px ${c as string}` }} />
                      {l}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.875rem' }}>
                {venue.zones.map(zone => {
                  const zd = crowd.zones[zone.id] || { density: zone.density, count: zone.currentCount, capacity: zone.capacity };
                  const color = getDensityColor(zd.density);
                  const isSelected = selectedZone === zone.id;
                  return (
                    <div
                      key={zone.id}
                      className="zone-card"
                      onClick={() => setSelectedZone(isSelected ? null : zone.id)}
                      style={{
                        borderColor: isSelected ? `${color}50` : 'var(--border)',
                        background: isSelected ? `${color}08` : 'var(--bg-2)',
                      }}
                    >
                      {/* Zone header */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                        <div>
                          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-1)' }}>{zone.name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-4)', marginTop: 2 }}>
                            {formatCount(zd.count)} / {formatCount(zd.capacity)} people
                          </div>
                        </div>
                        <div className="mono" style={{ fontSize: '1.25rem', fontWeight: 800, color, lineHeight: 1 }}>
                          {formatPercent(zd.density)}
                        </div>
                      </div>

                      {/* Big progress bar */}
                      <div style={{ height: 7, background: 'var(--bg-5)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 99,
                          width: formatPercent(zd.density),
                          background: `linear-gradient(90deg, ${color}77, ${color})`,
                          boxShadow: `0 0 8px ${color}88`,
                          transition: 'width 1s ease',
                        }} />
                      </div>

                      {/* Zone health chip */}
                      <div style={{ marginTop: '0.625rem' }}>
                        <span className={`chip ${zd.density > 0.7 ? 'chip-red' : zd.density > 0.4 ? 'chip-amber' : 'chip-green'}`}>
                          {zd.density > 0.7 ? '⚠ High' : zd.density > 0.4 ? 'Moderate' : '✓ Clear'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent notifications */}
            <div className="card-hi" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Bell size={14} color="var(--amber)" />
                  </div>
                  <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-1)' }}>Recent Alerts</h2>
                </div>
                <span className="chip chip-amber">{notifications.filter(n => !n.read).length} new</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {notifications.map(n => (
                  <div key={n.id} className={`notif-${n.type}`} style={{ padding: '0.875rem 1rem', borderRadius: 10, display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <div style={{ marginTop: 1 }}>{notifIcon[n.type]}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 3 }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-1)' }}>{n.title}</span>
                        {!n.read && <span className="chip chip-blue" style={{ fontSize: '0.6rem', padding: '0.1rem 0.4rem' }}>New</span>}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-3)', lineHeight: 1.5 }}>{n.message}</div>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-4)', flexShrink: 0 }}>{timeAgo(n.timestamp)}</div>
                  </div>
                ))}
              </div>
            </div>
          </main>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            AMENITIES TAB
            ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'amenities' && (
          <main className="anim-fade-in" style={{ flex: 1, padding: '1.75rem' }}>
            <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.02em', marginBottom: 3 }}>Wait Times</h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)' }}>Live queue estimates for all venue amenities</p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <span className="chip chip-green">{openAmenities} Open</span>
                <span className="chip chip-red">{venue.amenities.length - openAmenities} Closed</span>
              </div>
            </div>

            <div className="anim-stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {venue.amenities.map(amenity => {
                const trendColor = getTrendColor(amenity.trend);
                const TrendIcon = amenity.trend === 'increasing' ? TrendingUp : amenity.trend === 'decreasing' ? TrendingDown : Minus;
                const typeColors: Record<string, string> = {
                  restroom: '#3b82f6', concession: '#f59e0b', merchandise: '#a78bfa', gate: '#10b981', medical: '#ef4444',
                };
                const typeColor = typeColors[amenity.type] ?? '#8d90a0';
                const typeEmoji: Record<string, string> = {
                  restroom: '🚻', concession: '🍔', merchandise: '🛍️', gate: '🚪', medical: '🏥',
                };

                return (
                  <div key={amenity.id} className="card-hi" style={{ padding: '1.25rem', transition: 'all 0.2s ease' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <div style={{
                          width: 40, height: 40, borderRadius: 11,
                          background: `${typeColor}15`,
                          border: `1px solid ${typeColor}30`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 18,
                        }}>{typeEmoji[amenity.type] ?? '📍'}</div>
                        <div>
                          <div style={{ fontSize: '0.6875rem', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600, marginBottom: 2 }}>
                            {amenity.type}
                          </div>
                          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-1)' }}>{amenity.name}</div>
                        </div>
                      </div>
                      <span className={`chip ${amenity.isOpen ? 'chip-green' : 'chip-red'}`}>
                        {amenity.isOpen ? '● Open' : '● Closed'}
                      </span>
                    </div>

                    {/* Wait time big display */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
                      <div>
                        <div className={`stat-lg mono`} style={{ color: amenity.waitTime > 10 ? 'var(--red)' : amenity.waitTime > 5 ? 'var(--amber)' : 'var(--green)' }}>
                          {formatWaitTime(amenity.waitTime)}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-4)', marginTop: 3 }}>current wait time</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: trendColor, fontSize: '0.875rem', fontWeight: 600 }}>
                          <TrendIcon size={14} />
                          {formatWaitTime(amenity.predictedWaitTime)}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-4)', marginTop: 1 }}>in 15 minutes</div>
                      </div>
                    </div>

                    {/* Wait bar */}
                    <div className="progress-track">
                      <div className="progress-fill" style={{
                        width: `${Math.min(100, (amenity.waitTime / 20) * 100)}%`,
                        background: amenity.waitTime > 10 ? 'var(--red)' : amenity.waitTime > 5 ? 'var(--amber)' : 'var(--green)',
                      }} />
                    </div>

                    <div style={{ fontSize: '0.72rem', color: 'var(--text-4)', marginTop: '0.625rem' }}>
                      Section {amenity.section.replace('s', '')}
                    </div>
                  </div>
                );
              })}
            </div>
          </main>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            NAVIGATE TAB
            ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'navigate' && (
          <main className="anim-fade-in" style={{ flex: 1, padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <h2 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--text-1)', letterSpacing: '-0.02em', marginBottom: 3 }}>Live Venue Map</h2>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)' }}>Real-time density overlaid on CartoDB dark tiles. Click zones and amenities for details.</p>
            </div>

            <div style={{ display: 'flex', gap: '1.25rem', flex: 1, minHeight: 500 }}>
              {/* Map */}
              <div className="card-hi" style={{ flex: 1, overflow: 'hidden', minHeight: 460, borderRadius: 16 }}>
                <VenueMap venue={venue} crowd={crowd} />
              </div>

              {/* Right panel */}
              <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
                {/* AI Directions */}
                <div className="card-hi" style={{ padding: '1.25rem' }}>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-1)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Zap size={14} color="var(--blue-glow)" /> AI Directions
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '0.875rem' }}>
                    <div>
                      <div className="label-xs" style={{ marginBottom: 6 }}>From</div>
                      <select className="input-dark" value={navFrom} onChange={e => setNavFrom(e.target.value)}>
                        {venue.sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <div className="label-xs" style={{ marginBottom: 6 }}>Destination</div>
                      <select className="input-dark" value={navTo} onChange={e => setNavTo(e.target.value)}>
                        {venue.amenities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <div className="label-xs" style={{ marginBottom: 6 }}>Mode</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        {([['fastest', '⚡ Fastest'], ['least_crowded', '🌿 Less Crowded']] as const).map(([val, label]) => (
                          <button
                            key={val}
                            onClick={() => setNavMode(val)}
                            className={navMode === val ? 'btn-glow' : 'btn-ghost'}
                            style={{ justifyContent: 'center', fontSize: '0.72rem', padding: '0.4rem', borderRadius: 9 }}
                          >{label}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleGetDirections}
                    disabled={navLoading}
                    className="btn-glow"
                    style={{ width: '100%', justifyContent: 'center', borderRadius: 10, opacity: navLoading ? 0.7 : 1 }}
                  >
                    {navLoading
                      ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Thinking...</>
                      : <><Navigation size={14} /> Get Directions</>}
                  </button>

                  {/* AI Result Card */}
                  {navResult && (
                    <div className="anim-fade-up" style={{ marginTop: '0.875rem', padding: '0.875rem', background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--blue-glow)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>AI Route</span>
                        <div style={{ display: 'flex', gap: '0.375rem' }}>
                          <span className={`chip ${navResult.crowdLevel === 'high' ? 'chip-red' : navResult.crowdLevel === 'medium' ? 'chip-amber' : 'chip-green'}`} style={{ fontSize: '0.65rem' }}>
                            {navResult.crowdLevel} crowd
                          </span>
                          <span className="chip chip-blue" style={{ fontSize: '0.65rem' }}>~{navResult.estimatedTime}m</span>
                        </div>
                      </div>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-2)', lineHeight: 1.6 }}>{navResult.suggestion}</p>
                    </div>
                  )}
                </div>

                {/* Density legend */}
                <div className="card-hi" style={{ padding: '1.125rem' }}>
                  <div className="label-xs" style={{ marginBottom: '0.875rem' }}>Density Legend</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                    {[
                      { color: 'var(--green)', label: 'Low density', sub: '< 30% capacity' },
                      { color: 'var(--amber)', label: 'Moderate', sub: '30–70% capacity' },
                      { color: 'var(--red)',   label: 'High density', sub: '> 70% — avoid' },
                    ].map(({ color, label, sub }) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, boxShadow: `0 0 8px ${color}`, flexShrink: 0 }} />
                        <div>
                          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-1)' }}>{label}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-4)' }}>{sub}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Chat */}
                <AIChat
                  venueName={venue.name}
                  avgDensity={Object.values(crowd.zones).reduce((s, z) => s + z.density, 0) / Object.values(crowd.zones).length}
                />
              </div>
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
