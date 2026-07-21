'use client';
import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Activity, AlertTriangle, Bot, CheckCircle, Clock, Loader2, MapPin, Mic, MicOff, Navigation, Wifi, WifiOff } from 'lucide-react';
import { useCrowdData, useNotifications, useVenueData } from '@/hooks/useRealtimeData';
import { analyzeQuery } from '@/lib/gemini';
import { fmtCount, fmtPct, fmtDensityColor } from '@/lib/formatters';
import LiveRegion from '@/components/LiveRegion';
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
  ar: { label: '🇸🇦 AR', placeholder: '...اسأل عن الملعب', greeting: '!مرحبا! كيف يمكنني مساعدتك' },
};

const AMENITY_ICONS: Record<string, string> = { restroom: '🚻', concession: '🍕', merchandise: '👕', gate: '🚪', elevator: '🛗' };

const QUICK_ASKS: Record<string, string[]> = {
  en: ['Nearest restroom?', 'Least crowded zone?', '♿ Wheelchair access'],
  es: ['¿Baño más cercano?', '¿Zona menos concurrida?', '♿ Acceso silla de ruedas'],
};

export default function GuestPWA() {
  const { venueId }    = useParams<{ venueId: string }>();
  const searchParams   = useSearchParams();

  const { venue }       = useVenueData(venueId);
  const { crowd }       = useCrowdData(venueId);
  const { notifications } = useNotifications(venueId);

  const [lang,        setLang]        = useState(searchParams?.get('lang') ?? 'en');
  const [tab,         setTab]         = useState<Tab>('live');
  const [chatInput,   setChatInput]   = useState('');
  const [messages,    setMessages]    = useState<ChatMsg[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [recording,   setRecording]   = useState(false);
  const [online,      setOnline]      = useState(true);
  const [emergency,   setEmergency]   = useState('');
  const [lastUpdate,  setLastUpdate]  = useState(Date.now());
  const chatEndRef = useRef<HTMLDivElement>(null);
  const mediaRef   = useRef<MediaRecorder | null>(null);
  const chunksRef  = useRef<Blob[]>([]);

  const langConf = LANGS[lang] ?? LANGS.en;
  const avgDensity = crowd ? Object.values(crowd.zones).reduce((s, z) => s + z.density, 0) / Math.max(Object.values(crowd.zones).length, 1) : 0;
  const totalCount = crowd ? Object.values(crowd.zones).reduce((s, z) => s + z.count, 0) : 0;

  useEffect(() => { setMessages([{ role: 'ai', text: langConf.greeting }]); }, [lang]);
  useEffect(() => { setLastUpdate(Date.now()); }, [crowd]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => {
    const em = notifications.find(n => n.type === 'emergency' && !n.read);
    if (em) setEmergency(em.message);
    const on  = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [notifications]);

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

      {/* Header */}
      <header style={{ padding: '0.875rem 1rem', background: 'var(--surface)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={13} color="#fff" />
            </div>
            <span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{venue?.name ?? 'VenueFlow'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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

        {/* AI CHAT */}
        {tab === 'chat' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {messages.map((m, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{ maxWidth: '80%', padding: '0.625rem 0.875rem', borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px', background: m.role === 'user' ? 'var(--brand)' : 'var(--surface-2)', border: m.role === 'ai' ? '1px solid var(--border)' : 'none', fontSize: '0.875rem', color: m.role === 'user' ? '#fff' : 'var(--text-2)', lineHeight: 1.5, direction: lang === 'ar' ? 'rtl' : 'ltr' }}>
                    {m.text === '…' ? (
                      <span style={{ display: 'flex', gap: 3 }}>{[0, 0.2, 0.4].map((d, j) => <span key={j} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--text-3)', display: 'inline-block', animation: `live-pulse 1s ease-in-out ${d}s infinite` }} />)}</span>
                    ) : m.text}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Quick asks */}
            {messages.length <= 2 && (
              <div style={{ padding: '0 1rem 0.5rem', display: 'flex', gap: '0.375rem', overflowX: 'auto' }}>
                {(QUICK_ASKS[lang] ?? QUICK_ASKS.en).map(s => (
                  <button key={s} onClick={() => sendMessage(s)} style={{ whiteSpace: 'nowrap', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 99, padding: '0.3rem 0.75rem', fontSize: '0.75rem', color: 'var(--text-3)', cursor: 'pointer', flexShrink: 0 }}>{s}</button>
                ))}
              </div>
            )}

            {/* Input */}
            <div style={{ padding: '0.75rem', borderTop: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', gap: '0.5rem' }}>
              <input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} placeholder={langConf.placeholder} aria-label="Ask about the venue" style={{ flex: 1, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 22, padding: '0.5rem 1rem', fontSize: '0.875rem', color: 'var(--text-1)', outline: 'none', direction: lang === 'ar' ? 'rtl' : 'ltr' }} />
              <button onClick={recording ? () => mediaRef.current?.stop() : startVoice} disabled={chatLoading} aria-label={recording ? 'Stop recording' : 'Voice input'} aria-pressed={recording} style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid var(--border)', cursor: 'pointer', background: recording ? 'var(--danger-bg)' : 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {recording ? <MicOff size={15} color="var(--danger)" /> : <Mic size={15} color="var(--text-3)" />}
              </button>
              <button onClick={() => sendMessage()} disabled={!chatInput.trim() || chatLoading} aria-label="Send" style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', cursor: 'pointer', background: chatInput.trim() && !chatLoading ? 'var(--brand)' : 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s' }}>
                <Navigation size={15} color={chatInput.trim() ? '#fff' : 'var(--text-4)'} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer style={{ padding: '0.5rem', background: 'var(--surface)', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
        <p style={{ fontSize: '0.65rem', color: 'var(--text-4)' }}>Powered by <strong style={{ color: 'var(--text-3)' }}>VenueFlow</strong></p>
      </footer>
    </div>
  );
}
