'use client';
import { Suspense, useEffect, useState, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Activity, AlertTriangle, Bot, CheckCircle, Clock, Loader2, LogOut, MapPin, Navigation, Sparkles, Wifi, WifiOff } from 'lucide-react';
import { useCrowdData, useNotifications, useVenueData } from '@/hooks/useRealtimeData';
import { analyzeQuery } from '@/lib/gemini';
import { subscribeToLiveEvent } from '@/lib/firestore';
import { VenueEvent } from '@/types';
import { fmtCount, fmtPct, fmtDensityColor } from '@/lib/formatters';
import LiveRegion from '@/components/LiveRegion';
import GuestTutorial from '@/components/GuestTutorial';
import AIChat from '@/components/AIChat';
import dynamic from 'next/dynamic';

const VenueMap = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div style={{ height: 240, borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: '0.8125rem' }}>
      Loading interactive map...
    </div>
  ),
});

type Tab = 'live' | 'amenities' | 'chat';
type ChatMsg = { role: 'user' | 'ai'; text: string };

const LANGS: Record<string, { label: string; placeholder: string; greeting: string }> = {
  en: { label: '🇺🇸 EN', placeholder: 'Ask about the venue...', greeting: 'Hi! How can I help you today?' },
  es: { label: '🇪🇸 ES', placeholder: 'Pregunta sobre el estadio...', greeting: '¡Hola! ¿Cómo puedo ayudarte?' },
  pt: { label: '🇧🇷 PT', placeholder: 'Pergunte sobre o estádio...', greeting: 'Olá! Como posso ajudar?' },
  fr: { label: '🇫🇷 FR', placeholder: 'Posez une question...', greeting: 'Bonjour! Comment puis-je vous aider?' },
  hi: { label: '🇮🇳 HI', placeholder: 'स्टेडियम के बारे में पूछें...', greeting: 'नमस्ते! मैं कैसे मदद करूँ?' },
  ar: { label: '🇸🇦 AR', placeholder: '...اسأل عن الملعب', greeting: '!मرحبا! كيف يمكنني مساعدتك' },
};

const AMENITY_ICONS: Record<string, string> = { restroom: '🚻', concession: '🍕', merchandise: '👕', gate: '🚪', elevator: '🛗' };

const QUICK_ASKS: Record<string, string[]> = {
  en: ['Nearest restroom?', 'Least crowded zone?', '♿ Wheelchair access'],
  es: ['¿Baño más cercano?', '¿Zona menos concurrida?', '♿ Acceso silla de ruedas'],
};

function GuestPWAContent() {
  const { venueId }    = useParams<{ venueId: string }>();
  const searchParams   = useSearchParams();
  const router         = useRouter();

  const { venue }       = useVenueData(venueId);
  const { crowd }       = useCrowdData(venueId);
  const { notifications } = useNotifications(venueId);

  const [lang,          setLang]          = useState(searchParams?.get('lang') ?? 'en');
  const [tab,           setTab]           = useState<Tab>('live');
  const [chatInput,     setChatInput]     = useState('');
  const [messages,      setMessages]      = useState<ChatMsg[]>([]);
  const [chatLoading,   setChatLoading]   = useState(false);
  const [recording,     setRecording]     = useState(false);
  const [online,        setOnline]        = useState(true);
  const [emergency,     setEmergency]     = useState('');
  const [lastUpdate,    setLastUpdate]    = useState(Date.now());
  const [activeEvent,   setActiveEvent]   = useState<VenueEvent | null>(null);
  const [userCheckIn,   setUserCheckIn]   = useState<{ zoneId: string; section?: string; isStepFree?: boolean } | null>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showTutorial,  setShowTutorial]  = useState(false);
  const [leaving,       setLeaving]       = useState(false);

  const handleLeaveVenue = async () => {
    if (!confirm(`Are you leaving ${venue?.name ?? 'the venue'}?\n\nThis will update real-time egress numbers.`)) return;

    setLeaving(true);
    const sessionId = searchParams?.get('session') ?? undefined;
    const currentZone = userCheckIn?.zoneId ?? searchParams?.get('zone') ?? 'zone-n';

    try {
      await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venueId, zoneId: currentZone, sessionId }),
      });
    } catch (err) {
      console.warn('Checkout failed:', err);
    } finally {
      router.push('/checkin');
    }
  };
  const [selectedZone,  setSelectedZone]  = useState('');
  const [stepFreePref,  setStepFreePref]  = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const mediaRef   = useRef<MediaRecorder | null>(null);
  const chunksRef  = useRef<Blob[]>([]);

  const langConf = LANGS[lang] ?? LANGS.en;
  const zonesList = crowd?.zones ? Object.values(crowd.zones) : [];
  const avgDensity = zonesList.length > 0 ? zonesList.reduce((s, z) => s + (z?.density ?? 0), 0) / zonesList.length : 0;
  const totalCount = crowd?.totalCount ?? (zonesList.length > 0 ? zonesList.reduce((s, z) => s + (z?.count ?? 0), 0) : 0);

  useEffect(() => { setMessages([{ role: 'ai', text: langConf.greeting }]); }, [lang]);
  useEffect(() => { setLastUpdate(Date.now()); }, [crowd]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (venueId) return subscribeToLiveEvent(venueId, setActiveEvent); }, [venueId]);

  useEffect(() => {
    if (!venueId) return;
    const urlZone = searchParams?.get('zone');
    const saved   = localStorage.getItem(`vf_checkin_${venueId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setUserCheckIn(parsed);
        if (parsed.zoneId) setSelectedZone(parsed.zoneId);
      } catch {}
    } else if (urlZone) {
      const init = { zoneId: urlZone };
      setUserCheckIn(init);
      setSelectedZone(urlZone);
    }
  }, [venueId, searchParams]);

  useEffect(() => {
    const em = notifications.find(n => n.type === 'emergency' && !n.read);
    if (em) setEmergency(em.message);
    const on  = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [notifications]);

  const handleJoinEvent = () => {
    if (!selectedZone || !venueId) return;
    const checkInData = { zoneId: selectedZone, isStepFree: stepFreePref };
    setUserCheckIn(checkInData);
    localStorage.setItem(`vf_checkin_${venueId}`, JSON.stringify(checkInData));
    fetch('/api/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ venueId, zoneId: selectedZone, language: lang })
    });
    setShowJoinModal(false);
  };

  const sendMessage = async (text = chatInput) => {
    const q = text.trim();
    if (!q || chatLoading) return;
    setChatInput('');
    setMessages(prev => [...prev, { role: 'user', text: q }, { role: 'ai', text: '…' }]);
    setChatLoading(true);
    try {
      const reply = await analyzeQuery(q, venue?.name ?? venueId, avgDensity, lang);
      setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { role: 'ai', text: reply } : m));
    } catch {
      setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { role: 'ai', text: "I'm having trouble connecting. Please try again." } : m));
    } finally { setChatLoading(false); }
  };

  const startVoice = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRef.current  = mr;
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob   = new Blob(chunksRef.current, { type: 'audio/webm' });
        const buf    = await blob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
        const res    = await fetch('/api/chat/voice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ audioBase64: base64, language: lang, venueName: venue?.name, density: avgDensity }) });
        const data   = await res.json();
        setMessages(prev => [...prev, { role: 'user', text: '🎤 Voice message' }, { role: 'ai', text: data.ok ? data.response : "Couldn't process audio." }]);
        setRecording(false);
      };
      mr.start();
      setRecording(true);
    } catch { alert('Microphone access denied.'); }
  };

  const densityLabel = avgDensity > 0.8 ? 'Very busy' : avgDensity > 0.5 ? 'Moderate' : 'Light traffic';
  const openAmenities = venue?.amenities.filter(a => a.isOpen) ?? [];

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--text-1)', display: 'flex', flexDirection: 'column', maxWidth: 430, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      <LiveRegion message={emergency} level="assertive" />

      {/* Emergency banner */}
      {emergency && (
        <div role="alert" style={{ background: 'var(--danger-bg)', borderBottom: '1px solid var(--danger-border)', padding: '0.75rem 1rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
          <AlertTriangle size={15} color="var(--danger)" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: '0.8125rem', color: 'var(--danger)', fontWeight: 600 }}>{emergency}</p>
        </div>
      )}

      {/* Active Live Event Banner */}
      {activeEvent && (
        <div style={{ background: 'var(--brand-bg)', borderBottom: '1px solid var(--brand-border)', padding: '0.625rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span className="live-badge" style={{ fontSize: '0.65rem', padding: '0.15rem 0.375rem' }}><span className="live-dot" />LIVE EVENT</span>
              <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: 'var(--brand-light)' }}>{activeEvent.name}</span>
            </div>
            {userCheckIn ? (
              <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginTop: 2 }}>
                📍 Checked in: <strong>{venue?.zones.find(z => z.id === userCheckIn.zoneId)?.name ?? userCheckIn.zoneId}</strong>
                {userCheckIn.isStepFree && <span style={{ color: 'var(--success)', marginLeft: 6 }}>♿ Step-Free</span>}
              </p>
            ) : (
              <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginTop: 2 }}>Select your seat section to view custom line times</p>
            )}
          </div>
          <button onClick={() => setShowJoinModal(true)} className="btn-primary" style={{ fontSize: '0.7rem', padding: '0.25rem 0.625rem', height: 'auto' }}>
            {userCheckIn ? 'Change Seat' : '🎟️ Join Event'}
          </button>
        </div>
      )}

      {/* Header */}
      <header style={{ padding: '0.875rem 1rem', background: 'var(--surface)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={13} color="#fff" />
            </div>
            <span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{venue?.name ?? 'VenueFlow'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
            <button
              onClick={() => setShowTutorial(true)}
              title="View Tutorial"
              style={{
                background: 'color-mix(in srgb, var(--brand-light) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--brand-light) 25%, transparent)',
                color: 'var(--brand-light)',
                borderRadius: 7,
                fontSize: '0.72rem',
                fontWeight: 600,
                padding: '0.2rem 0.5rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Sparkles size={11} /> Guide
            </button>
            <button
              onClick={handleLeaveVenue}
              disabled={leaving}
              title="Leave Venue & Check out"
              style={{
                background: 'color-mix(in srgb, var(--danger) 12%, transparent)',
                border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
                color: 'var(--danger)',
                borderRadius: 7,
                fontSize: '0.72rem',
                fontWeight: 600,
                padding: '0.2rem 0.5rem',
                cursor: leaving ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {leaving ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <LogOut size={11} />} Leave
            </button>
            {!online && <WifiOff size={13} color="var(--danger)" aria-label="Offline" />}
            <select value={lang} onChange={e => setLang(e.target.value)} aria-label="Language" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-2)', borderRadius: 7, fontSize: '0.75rem', padding: '0.2rem 0.5rem', cursor: 'pointer' }}>
              {Object.entries(LANGS).map(([code, { label }]) => <option key={code} value={code}>{label}</option>)}
            </select>
          </div>
        </div>
        {/* Density status */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
          <span style={{ fontSize: '0.875rem', color: fmtDensityColor(avgDensity), fontWeight: 600 }}>{densityLabel}</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-4)' }}>{new Date(lastUpdate).toLocaleTimeString()}</span>
        </div>
        <div style={{ height: 3, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${avgDensity * 100}%`, background: fmtDensityColor(avgDensity), transition: 'width 1s ease', borderRadius: 99 }} />
        </div>
      </header>

      {/* Tab bar */}
      <nav role="tablist" style={{ display: 'flex', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
        {([['live', 'Live Map', Wifi], ['amenities', 'Wait Times', Clock], ['chat', 'Ask AI', Bot]] as const).map(([id, label, Icon]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', padding: '0.75rem 0.5rem', border: 'none', cursor: 'pointer', background: 'transparent', fontSize: '0.7rem', fontWeight: tab === id ? 600 : 400, color: tab === id ? 'var(--brand-light)' : 'var(--text-3)', borderBottom: `2px solid ${tab === id ? 'var(--brand)' : 'transparent'}`, transition: 'all 0.15s' }}>
            <Icon size={17} />
            {label}
          </button>
        ))}
      </nav>

      {/* Join Event Modal */}
      {showJoinModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: '1.5rem', width: '100%', maxWidth: 380, color: 'var(--text-1)' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 800, marginBottom: '0.25rem' }}>🎟️ Join Event Check-In</h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)', marginBottom: '1.25rem' }}>
              Select your seat section in <strong>{venue?.name}</strong> to get custom wait times and step-free directions.
            </p>
            
            {activeEvent && (
              <div style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '0.75rem 1rem', marginBottom: '1.25rem' }}>
                <p style={{ fontSize: '0.875rem', fontWeight: 700 }}>{activeEvent.name}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 2 }}>{new Date(activeEvent.date).toLocaleDateString()} · {activeEvent.type.toUpperCase()}</p>
              </div>
            )}

            <div style={{ marginBottom: '1.25rem' }}>
              <label className="label-xs" style={{ display: 'block', marginBottom: '0.5rem' }}>Select your seating zone</label>
              <select value={selectedZone} onChange={e => setSelectedZone(e.target.value)} className="input-dark" style={{ width: '100%' }}>
                <option value="">-- Choose your zone --</option>
                {venue?.zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="checkbox" id="stepFree" checked={stepFreePref} onChange={e => setStepFreePref(e.target.checked)} style={{ cursor: 'pointer' }} />
              <label htmlFor="stepFree" style={{ fontSize: '0.8125rem', color: 'var(--text-2)', cursor: 'pointer' }}>
                ♿ Prefer step-free / elevator access routes
              </label>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setShowJoinModal(false)} className="btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
              <button onClick={handleJoinEvent} disabled={!selectedZone} className="btn-primary" style={{ flex: 1, justifyContent: 'center', opacity: !selectedZone ? 0.5 : 1 }}>
                Confirm &amp; Join
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>

        {/* LIVE MAP */}
        {tab === 'live' && (
          <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {venue && (
              <div style={{ height: 260, width: '100%', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
                <VenueMap venue={venue} crowd={crowd ?? { timestamp: Date.now(), venueId: venue.id, totalCount, zones: {} }} />
              </div>
            )}
            <p style={{ fontSize: '0.6875rem', fontWeight: 500, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.125rem' }}>
              {fmtCount(totalCount)} guests · {venue?.zones.length ?? 0} zones
            </p>
            {venue?.zones.map(zone => {
              const zData   = crowd?.zones[zone.id];
              const density = zData?.density ?? zone.density;
              const count   = zData?.count   ?? zone.currentCount;
              const dColor  = fmtDensityColor(density);
              return (
                <div key={zone.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: dColor, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.3rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{zone.name}</span>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: dColor, marginLeft: '0.5rem', flexShrink: 0 }}>{fmtPct(density)}</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${density * 100}%`, background: dColor, transition: 'width 1s ease', borderRadius: 99 }} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.3rem' }}>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--text-3)' }}>{fmtCount(count)} guests</span>
                      {zone.isStepFree && <span style={{ fontSize: '0.6875rem', color: 'var(--success)' }}>♿ Accessible</span>}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Notifications */}
            {notifications.filter(n => !n.read && n.type !== 'emergency').slice(0, 2).map(n => (
              <div key={n.id} className={`notif-${n.type}`} style={{ borderRadius: 10, padding: '0.75rem', display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                <CheckCircle size={14} color={n.type === 'warning' ? 'var(--warning)' : 'var(--brand)'} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{n.title}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.125rem' }}>{n.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* WAIT TIMES */}
        {tab === 'amenities' && (
          <div style={{ padding: '1rem' }}>
            <p style={{ fontSize: '0.6875rem', fontWeight: 500, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>Wait times near you</p>
            {(['restroom', 'concession', 'gate', 'merchandise', 'elevator'] as const).map(type => {
              const items = openAmenities.filter(a => a.type === type);
              if (!items.length) return null;
              return (
                <div key={type} style={{ marginBottom: '1rem' }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-4)', fontWeight: 500, marginBottom: '0.375rem' }}>{AMENITY_ICONS[type]} {type.charAt(0).toUpperCase() + type.slice(1)}s</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                    {items.sort((a, b) => a.waitTime - b.waitTime).map(a => (
                      <div key={a.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9, padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <p style={{ fontWeight: 500, fontSize: '0.875rem' }}>{a.name}</p>
                          <p style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginTop: '0.125rem' }}>Section {a.section}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: a.waitTime > 10 ? 'var(--danger)' : a.waitTime > 5 ? 'var(--warning)' : 'var(--success)' }}>{a.waitTime === 0 ? 'No wait' : `${a.waitTime}m`}</p>
                          <p style={{ fontSize: '0.65rem', color: a.trend === 'increasing' ? 'var(--danger)' : a.trend === 'decreasing' ? 'var(--success)' : 'var(--text-3)' }}>{a.trend === 'increasing' ? '↑ rising' : a.trend === 'decreasing' ? '↓ falling' : '→ stable'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* AI CHAT — wired to /api/chat via analyzeQuery */}
        {tab === 'chat' && (
          <AIChat venueName={venue?.name ?? venueId} avgDensity={avgDensity} />
        )}
      </div>

      {/* Tutorial Modal */}
      <GuestTutorial
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
        onComplete={() => setShowTutorial(false)}
        venueName={venue?.name}
        eventName={activeEvent?.name}
      />

      {/* Footer */}
      <footer style={{ padding: '0.5rem', background: 'var(--surface)', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
        <p style={{ fontSize: '0.65rem', color: 'var(--text-4)' }}>Powered by <strong style={{ color: 'var(--text-3)' }}>VenueFlow</strong></p>
      </footer>
    </div>
  );
}

export default function GuestPWA() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={24} color="var(--brand-light)" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    }>
      <GuestPWAContent />
    </Suspense>
  );
}
