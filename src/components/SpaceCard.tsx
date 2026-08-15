'use client';
import { MapPin, Users, Zap, Building2 } from 'lucide-react';
import type { VenueSpace, SpaceCrowdSlice, SpaceEvent } from '@/types';
import { fmtCount, fmtPct, fmtDensityColor } from '@/lib/formatters';

interface SpaceCardProps {
  space    : VenueSpace;
  crowd   ?: SpaceCrowdSlice | null;
  event   ?: SpaceEvent | null;
  mode     : 'admin' | 'guest';
  onClick ?: () => void;
  isActive?: boolean;           // highlights the guest's current space
}

export default function SpaceCard({ space, crowd, event, mode, onClick, isActive }: SpaceCardProps) {
  const density  = crowd?.density ?? 0;
  const count    = crowd?.count   ?? 0;
  const capacity = crowd?.capacity ?? space.capacity;
  const status   = crowd?.status  ?? 'normal';
  const dColor   = fmtDensityColor(density);

  const statusChipClass =
    status === 'congested' ? 'chip chip-red'   :
    status === 'warning'   ? 'chip chip-amber' :
    space.isShared         ? 'chip chip-blue'  : 'chip chip-green';

  const statusLabel =
    status === 'congested' ? 'Very Busy' :
    status === 'warning'   ? 'Busy'      :
    space.isShared         ? 'Shared'    : 'Available';

  return (
    <button
      onClick={onClick}
      style={{
        width         : '100%',
        textAlign     : 'left',
        background    : isActive
          ? 'color-mix(in srgb, var(--brand) 8%, var(--surface))'
          : 'var(--surface)',
        border        : `1px solid ${isActive ? 'var(--brand)' : 'var(--border)'}`,
        borderRadius  : 14,
        padding       : '1rem 1.125rem',
        cursor        : onClick ? 'pointer' : 'default',
        transition    : 'all 0.18s ease',
        boxShadow     : isActive ? '0 0 0 2px color-mix(in srgb, var(--brand) 20%, transparent)' : 'none',
      }}
      aria-label={`${space.name} — ${statusLabel}`}
    >
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.625rem' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-1)', marginBottom: '0.125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {space.name}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {/* Floor badge */}
            <span className="chip chip-blue" style={{ fontSize: '0.65rem', padding: '0.1rem 0.375rem' }}>
              <MapPin size={9} style={{ marginRight: 2 }} />
              {space.floor === 0 ? 'Ground' : `Floor ${space.floor}`}
            </span>
            {/* Shared ribbon */}
            {space.isShared && (
              <span className="chip" style={{ fontSize: '0.65rem', padding: '0.1rem 0.375rem', background: 'color-mix(in srgb, var(--brand-light) 12%, transparent)', color: 'var(--brand-light)', borderColor: 'color-mix(in srgb, var(--brand-light) 25%, transparent)' }}>
                <Building2 size={9} style={{ marginRight: 2 }} />SHARED
              </span>
            )}
            {/* Accessibility */}
            {space.isStepFree && (
              <span style={{ fontSize: '0.65rem', color: 'var(--success)' }}>♿</span>
            )}
            {/* Active event */}
            {isActive && (
              <span className="live-badge" style={{ fontSize: '0.65rem', padding: '0.1rem 0.375rem' }}>
                <span className="live-dot" />YOU ARE HERE
              </span>
            )}
          </div>
        </div>
        {/* Status chip */}
        <span className={statusChipClass} style={{ fontSize: '0.7rem', flexShrink: 0, marginLeft: '0.5rem' }}>
          {statusLabel}
        </span>
      </div>

      {/* Crowd bar */}
      <div style={{ marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
            <Users size={11} style={{ marginRight: 3, verticalAlign: 'middle' }} />
            {fmtCount(count)} / {fmtCount(capacity)}
          </span>
          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: dColor }}>{fmtPct(density)}</span>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${density * 100}%`, background: dColor, transition: 'width 0.8s ease' }}
          />
        </div>
      </div>

      {/* Event name (if live) */}
      {event && (
        <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <span className="live-badge" style={{ fontSize: '0.6rem', padding: '0.1rem 0.3rem' }}>
            <span className="live-dot" />LIVE
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-2)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {event.name}
          </span>
        </div>
      )}

      {/* CTA */}
      {mode === 'admin' && onClick && (
        <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--brand-light)', fontWeight: 600 }}>
            <Zap size={11} style={{ marginRight: 3 }} />Manage →
          </span>
        </div>
      )}
      {mode === 'guest' && onClick && !isActive && (
        <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--brand-light)', fontWeight: 600 }}>
            <MapPin size={11} style={{ marginRight: 3 }} />Navigate →
          </span>
        </div>
      )}
    </button>
  );
}
