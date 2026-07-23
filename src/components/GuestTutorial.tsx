'use client';
import { useState, useEffect } from 'react';
import { Activity, ArrowRight, Bot, CheckCircle2, ChevronRight, Compass, MapPin, Navigation, ShieldCheck, Sparkles, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  venueName?: string;
  eventName?: string;
}

const SLIDES = [
  {
    icon: Activity,
    badge: 'Step 1 of 4',
    title: 'Welcome to VenueFlow',
    subtitle: 'Your real-time smart companion inside the venue.',
    description: 'Avoid long concession lines, find the shortest restroom queues, and receive instant emergency or transit updates during your event.',
    highlights: [
      '⚡ Live crowd density heatmap',
      '🍔 Real-time wait time predictions',
      '🤖 AI Assistant for instant venue navigation',
    ],
    color: '#3B82F6',
  },
  {
    icon: Compass,
    badge: 'Step 2 of 4',
    title: 'Live Zone Heatmap',
    subtitle: 'See crowd density across every stand and gate.',
    description: 'Zones are color-coded in real time. Green means low crowd density, amber is moderate, and red signals heavy congestion.',
    highlights: [
      '🟢 Green (<30%): Clear & fast moving',
      '🟡 Amber (30–70%): Moderate crowd',
      '🔴 Red (>70%): High density — consider alternative gates',
    ],
    color: '#10B981',
  },
  {
    icon: Bot,
    badge: 'Step 3 of 4',
    title: 'Instant AI Assistant',
    subtitle: 'Ask questions in plain English or your native language.',
    description: 'Tap the AI Chat tab anytime to ask: "Where is the nearest restroom with shortest wait?" or "Which gate is best for egress?"',
    highlights: [
      '💬 Multilingual support (English, Spanish, French, Hindi, etc.)',
      '♿ Step-free & accessible navigation routes',
      '🍔 Live updates on food court wait times',
    ],
    color: '#8B5CF6',
  },
  {
    icon: ShieldCheck,
    badge: 'Step 4 of 4',
    title: 'Checked In & Ready',
    subtitle: 'You are now connected to the central venue network.',
    description: 'Your check-in helps venue operators monitor crowd flow safety and ensure smooth exit routes when the event finishes.',
    highlights: [
      '🎫 Linked to your current event',
      '🛡️ Anonymous & privacy-first crowd tracking',
      '🚀 Tap below to open your live venue dashboard!',
    ],
    color: '#F59E0B',
  },
];

export default function GuestTutorial({ isOpen, onClose, onComplete, venueName, eventName }: Props) {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setCurrentSlide(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const slide = SLIDES[currentSlide];
  const isLast = currentSlide === SLIDES.length - 1;

  const handleNext = () => {
    if (isLast) {
      localStorage.setItem('vf_tutorial_seen', 'true');
      onComplete();
    } else {
      setCurrentSlide(prev => prev + 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('vf_tutorial_seen', 'true');
    onComplete();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      background: 'rgba(8, 12, 24, 0.92)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.25rem',
      fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 480,
        background: 'var(--surface, #111726)',
        border: '1px solid var(--border, rgba(255,255,255,0.12))',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header bar */}
        <div style={{
          padding: '1.25rem 1.5rem 0.75rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            color: slide.color,
            background: `color-mix(in srgb, ${slide.color} 15%, transparent)`,
            padding: '0.25rem 0.625rem',
            borderRadius: 20,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>
            {slide.badge}
          </span>
          <button
            onClick={handleSkip}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-3, #8d90a0)',
              fontSize: '0.8125rem',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            Skip <X size={14} />
          </button>
        </div>

        {/* Content body */}
        <div style={{ padding: '1.25rem 1.5rem 1.5rem', flex: 1 }}>
          {/* Main Icon */}
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: `color-mix(in srgb, ${slide.color} 18%, transparent)`,
            border: `1px solid ${slide.color}44`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '1.25rem',
          }}>
            <slide.icon size={28} color={slide.color} />
          </div>

          <h2 style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-1, #f3f4f6)', marginBottom: '0.375rem', lineHeight: 1.25 }}>
            {slide.title}
          </h2>

          <p style={{ fontSize: '0.875rem', fontWeight: 500, color: slide.color, marginBottom: '0.875rem' }}>
            {slide.subtitle}
          </p>

          <p style={{ fontSize: '0.84375rem', color: 'var(--text-3, #9ca3af)', lineHeight: 1.5, marginBottom: '1.25rem' }}>
            {slide.description}
          </p>

          {/* Context pill if venue/event is present */}
          {(venueName || eventName) && currentSlide === 0 && (
            <div style={{
              background: 'var(--surface-2, #182035)',
              border: '1px solid var(--border, rgba(255,255,255,0.08))',
              borderRadius: 10,
              padding: '0.625rem 0.875rem',
              marginBottom: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <MapPin size={14} color="var(--brand-light, #60a5fa)" />
              <div style={{ fontSize: '0.78125rem' }}>
                <span style={{ color: 'var(--text-2, #d1d5db)' }}>{venueName ?? 'Venue'}</span>
                {eventName && <span style={{ color: 'var(--text-3, #9ca3af)' }}> — {eventName}</span>}
              </div>
            </div>
          )}

          {/* Highlights checklist */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
            {slide.highlights.map((item, idx) => (
              <div key={idx} style={{
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: 8,
                padding: '0.5rem 0.75rem',
                fontSize: '0.8125rem',
                color: 'var(--text-2, #e5e7eb)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer controls */}
        <div style={{
          padding: '1rem 1.5rem 1.5rem',
          borderTop: '1px solid var(--border, rgba(255,255,255,0.08))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          {/* Progress dots */}
          <div style={{ display: 'flex', gap: 6 }}>
            {SLIDES.map((_, idx) => (
              <div
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                style={{
                  width: currentSlide === idx ? 20 : 6,
                  height: 6,
                  borderRadius: 3,
                  background: currentSlide === idx ? slide.color : 'rgba(255, 255, 255, 0.18)',
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                }}
              />
            ))}
          </div>

          {/* Next / Finish button */}
          <button
            onClick={handleNext}
            style={{
              background: slide.color,
              color: '#ffffff',
              border: 'none',
              borderRadius: 10,
              padding: '0.625rem 1.25rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: `0 4px 14px color-mix(in srgb, ${slide.color} 40%, transparent)`,
              transition: 'transform 0.15s ease',
            }}
            onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.97)')}
            onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            {isLast ? 'Enter Venue' : 'Next'}
            {isLast ? <CheckCircle2 size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
