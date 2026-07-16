'use client';
/**
 * AccessibleNavigationModal.tsx — WCAG 2.1 Level AA compliant modal
 *
 * Features:
 *   - Focus trapping: Tab/Shift+Tab cycle stays within the modal
 *   - Focus restoration: returns focus to the trigger element on close
 *   - Escape key closes the modal
 *   - aria-modal, aria-labelledby, role="dialog" for screen readers
 *   - No scroll on body while modal is open
 */
import { useEffect, useRef, ReactNode, useCallback } from 'react';

const FOCUSABLE_SELECTORS =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface Props {
  isOpen  : boolean;
  onClose : () => void;
  /** Used as aria-labelledby text */
  title   : string;
  children: ReactNode;
}

export default function AccessibleNavigationModal({ isOpen, onClose, title, children }: Props) {
  const overlayRef  = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  // ── Focus management ───────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      // Save the element that triggered the modal
      prevFocusRef.current = document.activeElement as HTMLElement;
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
      // Focus first focusable element inside the modal
      requestAnimationFrame(() => {
        const focusable = overlayRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS);
        focusable?.[0]?.focus();
      });
    } else {
      // Restore body scroll and previous focus
      document.body.style.overflow = '';
      prevFocusRef.current?.focus();
    }
  }, [isOpen]);

  // Cleanup on unmount
  useEffect(() => () => { document.body.style.overflow = ''; }, []);

  // ── Keyboard trap ─────────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key !== 'Tab') return;

    const focusableEls = overlayRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS);
    if (!focusableEls || focusableEls.length === 0) return;

    const first = focusableEls[0];
    const last  = focusableEls[focusableEls.length - 1];

    if (e.shiftKey) {
      // Shift+Tab: wrap backward
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      // Tab: wrap forward
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position       : 'fixed',
          inset          : 0,
          zIndex         : 200,
          background     : 'rgba(8,12,24,0.80)',
          backdropFilter : 'blur(8px)',
        }}
      />

      {/* Modal dialog */}
      <div
        ref       ={overlayRef}
        role      ="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onKeyDown ={handleKeyDown}
        style={{
          position     : 'fixed',
          top          : '50%',
          left         : '50%',
          transform    : 'translate(-50%, -50%)',
          zIndex       : 201,
          width        : 'min(560px, calc(100vw - 2rem))',
          maxHeight    : 'calc(100vh - 4rem)',
          overflowY    : 'auto',
          background   : 'var(--bg-2)',
          border       : '1px solid var(--border-hi)',
          borderRadius : 20,
          boxShadow    : '0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,165,255,0.1) inset',
          padding      : '2rem',
          animation    : 'fadeUp 0.3s ease both',
        }}
      >
        {/* Title */}
        <h2
          id="modal-title"
          style={{
            fontSize    : '1.125rem',
            fontWeight  : 700,
            color       : 'var(--text-1)',
            marginBottom: '1.5rem',
            letterSpacing: '-0.02em',
          }}
        >
          {title}
        </h2>

        {/* Content */}
        {children}

        {/* Close button — always last focusable so Shift+Tab from first reaches it */}
        <button
          onClick   ={onClose}
          aria-label="Close navigation panel"
          style={{
            position  : 'absolute',
            top       : '1.25rem',
            right     : '1.25rem',
            background: 'transparent',
            border    : '1px solid var(--border)',
            borderRadius: 8,
            color     : 'var(--text-3)',
            cursor    : 'pointer',
            padding   : '0.375rem',
            display   : 'flex',
            alignItems: 'center',
            transition: 'all 0.2s',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </>
  );
}
