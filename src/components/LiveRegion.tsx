'use client';
/**
 * LiveRegion.tsx — WCAG 2.1 dynamic aria-live announcer for screen readers
 *
 * Usage:
 *   <LiveRegion message="Zone A is now at critical density" level="assertive" />
 *   <LiveRegion message="Wait time updated: 3 minutes" level="polite" />
 *
 * Rendering strategy: The div is always in the DOM (visually hidden) but only
 * receives content when message changes. This ensures screen readers pick up
 * the announcement even if the same message repeats.
 */
import { useEffect, useRef, useState } from 'react';

interface Props {
  message: string;
  /** "polite" for non-urgent updates; "assertive" for life-safety / critical alerts */
  level?  : 'polite' | 'assertive';
  /** Unique id for this live region (required if multiple regions exist on page) */
  id?     : string;
}

export default function LiveRegion({ message, level = 'polite', id }: Props) {
  const [announced, setAnnounced] = useState('');
  const prev = useRef('');

  // Temporarily clear then re-set to force screen reader to re-announce
  // even if the same message string repeats (e.g. same zone goes critical twice)
  useEffect(() => {
    if (message && message !== prev.current) {
      prev.current = message;
      // Brief clear forces screen reader to treat next set as a new announcement
      setAnnounced('');
      const timer = setTimeout(() => setAnnounced(message), 100);
      return () => clearTimeout(timer);
    }
  }, [message]);

  return (
    <div
      id          ={id}
      role        ="status"
      aria-live   ={level}
      aria-atomic ="true"
      aria-relevant="additions text"
      style={{
        position : 'absolute',
        left     : -9999,
        top      : 'auto',
        width    : 1,
        height   : 1,
        overflow : 'hidden',
        clip     : 'rect(0,0,0,0)',
        whiteSpace: 'nowrap',
        border   : 0,
      }}
    >
      {announced}
    </div>
  );
}
