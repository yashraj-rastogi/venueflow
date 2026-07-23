'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import {
  Activity, ArrowRight, BarChart3, Bell, Bot, CheckCircle,
  Globe, MapPin, QrCode, Shield, Users, Zap,
} from 'lucide-react';

/* ── Fake live counter that ticks up ────────────────────────────── */
function useCounter(start: number, interval = 4000) {
  const [val, setVal] = useState(start);
  useEffect(() => {
    const t = setInterval(() => setVal(v => v + Math.floor(Math.random() * 12 + 3)), interval);
    return () => clearInterval(t);
  }, [interval]);
  return val.toLocaleString();
}

const FEATURES = [
  { icon: BarChart3, title: 'Real-Time Crowd Density', desc: 'Zone-by-zone occupancy updated every 30 seconds from simulated IoT sensors — no hardware required to start.' },
  { icon: Shield,    title: 'DIM-ICE Safety System', desc: 'Automated crowd pressure scores trigger staff alerts before situations become dangerous.' },
  { icon: Bot,       title: 'AI Navigation Assistant', desc: 'Multilingual Gemini-powered chat helps guests find restrooms, food, and exits in 6 languages.' },
  { icon: Bell,      title: 'Instant Broadcast', desc: 'Push targeted messages to specific sections or the entire venue in one click.' },
  { icon: QrCode,    title: 'QR Guest Check-In', desc: 'Guests scan a QR code at the gate — no app download, no account. Works in any browser.' },
  { icon: Globe,     title: 'Partner REST API', desc: 'Third-party integrations via a documented REST API with Bearer token auth and rate limiting.' },
];

const STEPS = [
  { n: '01', title: 'Create your account', desc: 'Sign in with Google and name your organization. Takes 30 seconds.' },
  { n: '02', title: 'Add your venue', desc: 'Type your stadium name. Real coordinates, capacity, and zones are pre-loaded automatically.' },
  { n: '03', title: 'Go live', desc: 'Create an event, start the simulation, and share the QR code with your guests.' },
];

const LOGOS = ['NFL', 'MLS', 'NBA', 'Live Nation', 'AEG', 'Oak View'];

export default function HomePage() {
  const guestCount = useCounter(142_880);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text-1)' }}>

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        borderBottom: '1px solid var(--border)',
        background: 'rgba(9,9,11,0.90)',
        backdropFilter: 'blur(16px)',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.5rem', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={15} color="#fff" />
            </div>
            <span style={{ fontWeight: 700, fontSize: '0.9375rem', letterSpacing: '-0.01em' }}>VenueFlow</span>
          </div>

          {/* Links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            {['Features', 'How it works', 'Pricing'].map(l => (
              <a key={l} href={`#${l.toLowerCase().replace(/ /g, '-')}`} style={{ padding: '0.4rem 0.75rem', borderRadius: 7, fontSize: '0.875rem', color: 'var(--text-2)', textDecoration: 'none', transition: 'color 120ms' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-1)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-2)')}
              >
                {l}
              </a>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Link href="/checkin" className="btn-ghost" style={{ fontSize: '0.875rem', padding: '0.4rem 0.875rem', color: 'var(--brand-light)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <QrCode size={14} /> Guest Entry
            </Link>
            <Link href="/login" className="btn-ghost" style={{ fontSize: '0.875rem', padding: '0.4rem 0.875rem' }}>Sign in</Link>
            <Link href="/onboarding" className="btn-primary" style={{ fontSize: '0.875rem', padding: '0.4rem 0.875rem' }}>Get started free</Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '5rem 1.5rem 4rem', textAlign: 'center' }}>
        {/* Live indicator */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0.75rem', borderRadius: 99, background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: '1.75rem', fontSize: '0.8125rem', color: 'var(--text-2)' }}>
          <span className="live-dot" />
          <span><strong style={{ color: 'var(--text-1)' }}>{guestCount}</strong> guests tracked right now</span>
        </div>

        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.5rem)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: '1.25rem', maxWidth: 800, margin: '0 auto 1.25rem' }}>
          Crowd intelligence for<br />
          <span style={{ color: 'var(--brand-light)' }}>the world's biggest venues</span>
        </h1>

        <p style={{ fontSize: 'clamp(1rem, 2vw, 1.125rem)', color: 'var(--text-2)', maxWidth: 560, margin: '0 auto 2.5rem', lineHeight: 1.7 }}>
          Real-time occupancy monitoring, AI-powered guest navigation, and automated safety alerts — deployed in minutes, not months.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            href="/checkin"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'color-mix(in srgb, var(--brand-light) 12%, transparent)',
              border: '1px solid color-mix(in srgb, var(--brand-light) 35%, transparent)',
              color: 'var(--brand-light)',
              borderRadius: 10,
              fontSize: '0.9375rem',
              fontWeight: 600,
              padding: '0.625rem 1.5rem',
              textDecoration: 'none',
              transition: 'all 0.15s ease',
              boxShadow: '0 4px 14px color-mix(in srgb, var(--brand) 20%, transparent)',
            }}
          >
            <QrCode size={18} /> Continue as Guest (Scan QR)
          </Link>
          <Link href="/onboarding" className="btn-primary" style={{ fontSize: '0.9375rem', padding: '0.625rem 1.5rem', gap: '0.5rem' }}>
            Start free trial <ArrowRight size={16} />
          </Link>
          <Link href="/g/metlife-stadium" className="btn-ghost" style={{ fontSize: '0.9375rem', padding: '0.625rem 1.5rem' }}>
            View live demo
          </Link>
        </div>

        {/* Mini dashboard preview */}
        <div style={{ marginTop: '3.5rem', borderRadius: 16, border: '1px solid var(--border)', overflow: 'hidden', background: 'var(--surface)', maxWidth: 820, margin: '3.5rem auto 0' }}>
          {/* Fake browser chrome */}
          <div style={{ padding: '0.625rem 1rem', background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {['#dc2626', '#d97706', '#16a34a'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.8 }} />)}
            <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 6, padding: '0.2rem 0.75rem', marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--text-3)' }}>
              app.venueflow.io/org/nfl-demo/venue/metlife-stadium/admin
            </div>
          </div>
          {/* Mini stat grid */}
          <div style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
            {[
              { label: 'Total guests',   value: '74,218', color: 'var(--text-1)' },
              { label: 'Avg occupancy',  value: '89%',    color: 'var(--warning)' },
              { label: 'Critical zones', value: '2',      color: 'var(--danger)' },
              { label: 'Open incidents', value: '0',      color: 'var(--success)' },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '0.875rem', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '1.375rem', fontWeight: 700, color: s.color, letterSpacing: '-0.02em' }}>{s.value}</div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>{s.label}</div>
              </div>
            ))}
          </div>
          {/* Zone bars */}
          <div style={{ padding: '0 1.25rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[
              { name: 'Section 101–120', pct: 94, color: 'var(--danger)' },
              { name: 'Section 200–215', pct: 71, color: 'var(--warning)' },
              { name: 'Field Level',     pct: 58, color: 'var(--warning)' },
              { name: 'Upper Deck',      pct: 32, color: 'var(--success)' },
            ].map(z => (
              <div key={z.name} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ width: 150, fontSize: '0.75rem', color: 'var(--text-2)', flexShrink: 0 }}>{z.name}</span>
                <div style={{ flex: 1, height: 6, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${z.pct}%`, background: z.color, borderRadius: 99 }} />
                </div>
                <span style={{ width: 36, fontSize: '0.75rem', color: z.color, textAlign: 'right', flexShrink: 0 }}>{z.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Social proof ─────────────────────────────────────────────────── */}
      <section style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', padding: '1.5rem 1.5rem' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)', flexShrink: 0 }}>Designed for operators at</p>
          {LOGOS.map(l => (
            <span key={l} style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-4)' }}>{l}</span>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section id="features" style={{ maxWidth: 1100, margin: '0 auto', padding: '5rem 1.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <p className="label-xs" style={{ marginBottom: '0.75rem' }}>Features</p>
          <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 700, letterSpacing: '-0.03em' }}>
            Everything your ops team needs
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1px', background: 'var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} style={{ background: 'var(--surface)', padding: '1.75rem', transition: 'background var(--t-fast)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}
            >
              <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--brand-bg)', border: '1px solid rgba(37,99,235,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <Icon size={17} color="var(--brand-light)" />
              </div>
              <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-1)', marginBottom: '0.5rem' }}>{title}</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-2)', lineHeight: 1.6 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section id="how-it-works" style={{ borderTop: '1px solid var(--border)', padding: '5rem 1.5rem' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <p className="label-xs" style={{ marginBottom: '0.75rem' }}>How it works</p>
            <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 700, letterSpacing: '-0.03em' }}>Live in three steps</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
            {STEPS.map(({ n, title, desc }) => (
              <div key={n} style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--brand-light)', fontFamily: 'JetBrains Mono, monospace', flexShrink: 0, paddingTop: '0.125rem' }}>{n}</div>
                <div>
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-1)', marginBottom: '0.375rem' }}>{title}</h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-2)', lineHeight: 1.6 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing teaser ───────────────────────────────────────────────── */}
      <section id="pricing" style={{ borderTop: '1px solid var(--border)', padding: '5rem 1.5rem' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
          <p className="label-xs" style={{ marginBottom: '0.75rem' }}>Pricing</p>
          <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: '1rem' }}>Start free, scale when you're ready</h2>
          <p style={{ fontSize: '0.9375rem', color: 'var(--text-2)', marginBottom: '2rem', lineHeight: 1.7 }}>
            Free trial includes unlimited events, full simulation, and the guest PWA. No credit card required.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/onboarding" className="btn-primary" style={{ padding: '0.625rem 1.5rem', fontSize: '0.9375rem', gap: '0.5rem' }}>
              Start free trial <ArrowRight size={16} />
            </Link>
          </div>
          <p style={{ marginTop: '1rem', fontSize: '0.8125rem', color: 'var(--text-3)' }}>
            No credit card · Setup in 2 minutes · Cancel anytime
          </p>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '2rem 1.5rem' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={12} color="#fff" />
            </div>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-2)' }}>VenueFlow</span>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-4)' }}>© {new Date().getFullYear()} VenueFlow Inc. All rights reserved.</p>
          <div style={{ display: 'flex', gap: '1.25rem' }}>
            {['Privacy', 'Terms', 'Docs', 'Status'].map(l => (
              <a key={l} href="#" style={{ fontSize: '0.8125rem', color: 'var(--text-3)', textDecoration: 'none' }}>{l}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
