'use client';
import { useState, useRef, useEffect } from 'react';
import { Zap, Send, X, ChevronDown, ChevronUp, Bot } from 'lucide-react';
import { analyzeQuery } from '@/lib/gemini';

interface Message { role: 'user' | 'ai'; text: string; ts: number; }

interface AIChatProps {
  venueName: string;
  avgDensity: number;
}

export default function AIChat({ venueName, avgDensity }: AIChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: `Hi! I'm your AI venue assistant for ${venueName}. Ask me about crowd levels, best routes, or wait times.`, ts: Date.now() }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput('');

    const userMsg: Message = { role: 'user', text: q, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    // Typing placeholder
    const placeholderId = Date.now() + 1;
    setMessages(prev => [...prev, { role: 'ai', text: '...', ts: placeholderId }]);

    try {
      const reply = await analyzeQuery(q, venueName, avgDensity);
      setMessages(prev => prev.map(m => m.ts === placeholderId ? { ...m, text: reply } : m));
    } catch {
      setMessages(prev => prev.map(m => m.ts === placeholderId
        ? { ...m, text: "I'm having trouble right now. Try again in a moment." }
        : m));
    } finally {
      setLoading(false);
    }
  };

  const SUGGESTIONS = ['Where should I go for the shortest restroom wait?', 'Which zone is least crowded right now?', 'Best time to grab food?'];

  return (
    <div style={{ marginTop: '1rem' }}>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="btn-ghost"
        style={{ width: '100%', justifyContent: 'space-between', padding: '0.75rem 1rem', borderRadius: 12, border: '1px solid rgba(59,130,246,0.2)', background: 'rgba(59,130,246,0.06)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Bot size={15} color="var(--blue-soft)" />
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--blue-soft)' }}>AI Venue Assistant</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-4)', fontWeight: 400 }}>— ask anything</span>
        </div>
        {open ? <ChevronUp size={14} color="var(--text-3)" /> : <ChevronDown size={14} color="var(--text-3)" />}
      </button>

      {/* Chat body */}
      {open && (
        <div className="anim-fade-up" style={{
          marginTop: '0.5rem',
          background: 'var(--bg-1)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          overflow: 'hidden',
        }}>
          {/* Messages */}
          <div style={{ height: 220, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '85%',
                  padding: '0.5rem 0.875rem',
                  borderRadius: m.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                  background: m.role === 'user'
                    ? 'linear-gradient(135deg, #3b82f6, #6366f1)'
                    : 'var(--bg-3)',
                  border: m.role === 'ai' ? '1px solid var(--border)' : 'none',
                  fontSize: '0.8125rem',
                  color: m.role === 'user' ? '#fff' : 'var(--text-2)',
                  lineHeight: 1.55,
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

          {/* Suggestions */}
          {messages.length === 1 && (
            <div style={{ padding: '0 1rem 0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => { setInput(s); }} className="btn-ghost" style={{ fontSize: '0.7rem', padding: '0.25rem 0.6rem', borderRadius: 20 }}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ borderTop: '1px solid var(--border)', padding: '0.625rem 0.875rem', display: 'flex', gap: '0.5rem' }}>
            <input
              className="input-dark"
              placeholder="Ask about crowd levels, wait times, routes..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              style={{ flex: 1, padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="btn-glow"
              style={{ padding: '0.5rem 0.875rem', borderRadius: 9, fontSize: '0.8rem', opacity: loading || !input.trim() ? 0.5 : 1 }}
            >
              <Send size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
