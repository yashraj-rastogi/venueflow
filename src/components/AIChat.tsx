'use client';
import { useState, useRef, useEffect } from 'react';
import { Send, X, ChevronDown, ChevronUp, Bot, Mic, MicOff, Globe } from 'lucide-react';
import { analyzeQuery } from '@/lib/gemini';

interface Message { role: 'user' | 'ai'; text: string; ts: number; }

interface AIChatProps {
  venueName : string;
  avgDensity: number;
}

const SUPPORTED_LANGUAGES: Record<string, string> = {
  en: '🇺🇸 English',
  es: '🇪🇸 Español',
  pt: '🇧🇷 Português',
  fr: '🇫🇷 Français',
  hi: '🇮🇳 हिन्दी',
  ar: '🇸🇦 العربية',
};

const SUGGESTIONS_BY_LANG: Record<string, string[]> = {
  en: ['Where is the shortest restroom wait?', 'Which zone is least crowded?', 'Best time to grab food?'],
  es: ['¿Dónde hay menos espera en el baño?', '¿Qué zona tiene menos gente?', '¿Cuándo es mejor ir a comer?'],
  pt: ['Onde é a menor espera no banheiro?', 'Qual zona tem menos pessoas?', 'Quando é melhor comer?'],
  fr: ['Où attendre le moins aux toilettes?', 'Quelle zone est la moins bondée?', 'Quand aller manger?'],
  hi: ['सबसे कम प्रतीक्षा कहाँ है?', 'कौन सा क्षेत्र कम भीड़ वाला है?', 'खाने का सबसे अच्छा समय?'],
  ar: ['أين أقل وقت انتظار؟', 'أي منطقة أقل ازدحامًا؟', 'متى أفضل وقت للأكل؟'],
};

export default function AIChat({ venueName, avgDensity }: AIChatProps) {
  const [open,       setOpen]       = useState(false);
  const [messages,   setMessages]   = useState<Message[]>([]);
  const [input,      setInput]      = useState('');
  const [loading,    setLoading]    = useState(false);
  const [language,   setLanguage]   = useState('en');
  const [recording,  setRecording]  = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);

  const bottomRef     = useRef<HTMLDivElement>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks   = useRef<Blob[]>([]);

  // Reset greeting when language changes
  useEffect(() => {
    const greetings: Record<string, string> = {
      en: `Hi! I'm your AI venue assistant for ${venueName}. Ask me about crowd levels, best routes, or wait times.`,
      es: `¡Hola! Soy tu asistente de IA para ${venueName}. Pregúntame sobre multitudes, rutas o tiempos de espera.`,
      pt: `Olá! Sou seu assistente de IA para ${venueName}. Pergunte sobre filas, rotas ou tempos de espera.`,
      fr: `Bonjour! Je suis votre assistant IA pour ${venueName}. Demandez-moi sur les foules, itinéraires ou attentes.`,
      hi: `नमस्ते! मैं ${venueName} के लिए आपका AI सहायक हूँ। भीड़, रास्ते या प्रतीक्षा के बारे में पूछें।`,
      ar: `مرحباً! أنا مساعدك الذكي لـ ${venueName}. اسألني عن الحشود أو الطرق أو أوقات الانتظار.`,
    };
    setMessages([{ role: 'ai', text: greetings[language] ?? greetings.en, ts: Date.now() }]);
  }, [language, venueName]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  // ── Text send ──────────────────────────────────────────────────────────────
  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput('');
    const userMsg: Message = { role: 'user', text: q, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    const placeholderId = Date.now() + 1;
    setMessages(prev => [...prev, { role: 'ai', text: '...', ts: placeholderId }]);
    try {
      const reply = await analyzeQuery(q, venueName, avgDensity, language);
      setMessages(prev => prev.map(m => m.ts === placeholderId ? { ...m, text: reply } : m));
    } catch {
      setMessages(prev => prev.map(m => m.ts === placeholderId
        ? { ...m, text: "I'm having trouble right now. Try again in a moment." } : m));
    } finally {
      setLoading(false);
    }
  };

  // ── Voice recording ────────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      mediaRecorder.current = mr;
      audioChunks.current   = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob   = new Blob(audioChunks.current, { type: 'audio/webm' });
        const buffer = await blob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

        const placeholderId = Date.now();
        setMessages(prev => [...prev,
          { role: 'user', text: '🎤 Voice message', ts: placeholderId - 1 },
          { role: 'ai',   text: '...', ts: placeholderId },
        ]);
        setLoading(true);

        try {
          const res = await fetch('/api/chat/voice', {
            method : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body   : JSON.stringify({
              audioBase64: base64,
              mimeType   : 'audio/webm',
              language,
              venueName,
              density    : avgDensity,
            }),
          });
          const data = await res.json();
          const reply = data.ok ? data.response : "I couldn't process that audio. Please try again.";
          setMessages(prev => prev.map(m => m.ts === placeholderId ? { ...m, text: reply } : m));
        } catch {
          setMessages(prev => prev.map(m => m.ts === placeholderId
            ? { ...m, text: 'Voice processing failed. Please try typing instead.' } : m));
        } finally {
          setLoading(false);
        }
      };
      mr.start();
      setRecording(true);
    } catch {
      alert('Microphone access denied. Please allow microphone permissions.');
    }
  };

  const stopRecording = () => {
    mediaRecorder.current?.stop();
    setRecording(false);
  };

  const suggestions = SUGGESTIONS_BY_LANG[language] ?? SUGGESTIONS_BY_LANG.en;

  return (
    <div style={{ marginTop: '1rem' }}>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="btn-ghost"
        style={{ width: '100%', justifyContent: 'space-between', padding: '0.75rem 1rem', borderRadius: 12, border: '1px solid rgba(59,130,246,0.2)', background: 'rgba(59,130,246,0.06)' }}
        aria-expanded={open}
        aria-controls="ai-chat-panel"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Bot size={15} color="var(--blue-soft)" />
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--blue-soft)' }}>AI Venue Assistant</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-4)', fontWeight: 400 }}>— multilingual</span>
        </div>
        {open ? <ChevronUp size={14} color="var(--text-3)" /> : <ChevronDown size={14} color="var(--text-3)" />}
      </button>

      {/* Chat body */}
      {open && (
        <div id="ai-chat-panel" className="anim-fade-up" style={{ marginTop: '0.5rem', background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
          {/* Language selector bar */}
          <div style={{ borderBottom: '1px solid var(--border)', padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-4)' }}>Language</span>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowLangMenu(v => !v)}
                className="btn-ghost"
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.7rem', gap: '0.3rem' }}
                aria-haspopup="listbox"
                aria-expanded={showLangMenu}
                aria-label="Select language"
              >
                <Globe size={11} /> {SUPPORTED_LANGUAGES[language]}
              </button>
              {showLangMenu && (
                <div
                  role="listbox"
                  aria-label="Language options"
                  style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.25rem', zIndex: 50, minWidth: 160 }}
                >
                  {Object.entries(SUPPORTED_LANGUAGES).map(([code, label]) => (
                    <button
                      key={code}
                      role="option"
                      aria-selected={language === code}
                      onClick={() => { setLanguage(code); setShowLangMenu(false); }}
                      style={{ width: '100%', textAlign: 'left', padding: '0.4rem 0.6rem', background: language === code ? 'rgba(59,130,246,0.12)' : 'transparent', border: 'none', borderRadius: 7, fontSize: '0.75rem', color: language === code ? 'var(--blue-soft)' : 'var(--text-2)', cursor: 'pointer' }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Messages */}
          <div style={{ height: 220, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }} aria-live="polite" aria-label="Chat messages">
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '85%', padding: '0.5rem 0.875rem',
                  borderRadius: m.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                  background: m.role === 'user' ? 'linear-gradient(135deg, #3b82f6, #6366f1)' : 'var(--bg-3)',
                  border: m.role === 'ai' ? '1px solid var(--border)' : 'none',
                  fontSize: '0.8125rem', color: m.role === 'user' ? '#fff' : 'var(--text-2)', lineHeight: 1.55,
                  direction: language === 'ar' ? 'rtl' : 'ltr',
                }}>
                  {m.text === '...' ? (
                    <span style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                      {[0, 0.15, 0.3].map((d, i) => (
                        <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--text-4)', display: 'inline-block', animation: `pulse 1.2s ease-in-out ${d}s infinite` }} />
                      ))}
                    </span>
                  ) : m.text}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions (shown only on first message) */}
          {messages.length === 1 && (
            <div style={{ padding: '0 1rem 0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
              {suggestions.map(s => (
                <button key={s} onClick={() => setInput(s)} className="btn-ghost" style={{ fontSize: '0.7rem', padding: '0.25rem 0.6rem', borderRadius: 20 }}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input row */}
          <div style={{ borderTop: '1px solid var(--border)', padding: '0.625rem 0.875rem', display: 'flex', gap: '0.5rem' }}>
            <input
              className="input-dark"
              placeholder={language === 'ar' ? 'اكتب سؤالك...' : language === 'hi' ? 'प्रश्न टाइप करें...' : 'Ask about crowd levels, wait times...'}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              style={{ flex: 1, padding: '0.5rem 0.75rem', fontSize: '0.8rem', direction: language === 'ar' ? 'rtl' : 'ltr' }}
              aria-label="Type your question"
            />
            {/* Voice button */}
            <button
              onClick={recording ? stopRecording : startRecording}
              disabled={loading}
              className={recording ? 'btn-glow' : 'btn-ghost'}
              style={{ padding: '0.5rem 0.625rem', borderRadius: 9, opacity: loading ? 0.5 : 1, background: recording ? '#ef444420' : undefined, borderColor: recording ? '#ef4444' : undefined }}
              aria-label={recording ? 'Stop recording' : 'Start voice input'}
              aria-pressed={recording}
            >
              {recording ? <MicOff size={13} color="#ef4444" /> : <Mic size={13} />}
            </button>
            {/* Send button */}
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="btn-glow"
              style={{ padding: '0.5rem 0.875rem', borderRadius: 9, fontSize: '0.8rem', opacity: loading || !input.trim() ? 0.5 : 1 }}
              aria-label="Send message"
            >
              <Send size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
