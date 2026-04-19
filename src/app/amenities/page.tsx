'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Loader2, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { fmtWait } from '@/lib/formatters';
import { useWaitTimes, useVenueData } from '@/hooks/useRealtimeData';
import { ensureVenueSeeded } from '@/lib/seedFirebase';

const DEFAULT_VENUE_ID = 'metlife-stadium';

export default function AmenitiesPage() {
  const { venue } = useVenueData(DEFAULT_VENUE_ID);
  const { amenities: liveAmenities, loading } = useWaitTimes(DEFAULT_VENUE_ID);

  useEffect(() => { ensureVenueSeeded(DEFAULT_VENUE_ID); }, []);

  const [filter, setFilter] = useState<'all' | 'restroom' | 'concession' | 'merchandise' | 'gate'>('all');
  const [sortBy, setSortBy] = useState<'Wait Time' | 'Name'>('Wait Time');

  const filtered = liveAmenities
    .filter(a => filter === 'all' || a.type === filter)
    .sort((a, b) => {
      if (sortBy === 'Wait Time') return b.waitTime - a.waitTime; // Longest wait first
      return a.name.localeCompare(b.name);
    });

  const typeEmoji: Record<string, string> = {
    restroom: '🚻', concession: '🍔', merchandise: '🛍️', gate: '🚪', medical: '🏥',
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} color="var(--blue-soft)" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', padding: '2rem' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Amenities & Wait Times</h1>
          <p style={{ color: 'var(--text-3)' }}>Live predictions for {venue.name}</p>
        </div>
        <Link href={`/venue/${venue.id}`} className="btn-ghost" style={{ textDecoration: 'none' }}>
          Back to Dashboard
        </Link>
      </header>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['all', 'restroom', 'concession', 'merchandise', 'gate'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={filter === f ? 'btn-glow' : 'btn-ghost'}
              style={{ padding: '0.5rem 1rem', borderRadius: 20 }}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <select 
          className="input-dark" 
          value={sortBy} 
          onChange={e => setSortBy(e.target.value as any)}
          style={{ width: 140 }}
        >
          <option>Wait Time</option>
          <option>Name</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
        {filtered.map(amenity => {
          const TrendIcon = amenity.trend === 'increasing' ? TrendingUp : amenity.trend === 'decreasing' ? TrendingDown : Minus;
          const trendColor = amenity.trend === 'increasing' ? 'var(--red)' : amenity.trend === 'decreasing' ? 'var(--green)' : 'var(--text-3)';

          return (
            <div key={amenity.id} className="card-hi anim-fade-up" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <div style={{ fontSize: 24 }}>{typeEmoji[amenity.type] ?? '📍'}</div>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{amenity.type}</div>
                    <div style={{ fontWeight: 600 }}>{amenity.name}</div>
                  </div>
                </div>
                <span className={`chip ${amenity.isOpen ? 'chip-green' : 'chip-red'}`}>
                  {amenity.isOpen ? 'Open' : 'Closed'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '1rem', background: 'var(--bg-1)', borderRadius: 12 }}>
                <div>
                  <div className="label-xs">Current Wait</div>
                  <div className="stat-lg mono" style={{ color: amenity.waitTime > 10 ? 'var(--red)' : amenity.waitTime > 5 ? 'var(--amber)' : 'var(--green)' }}>
                    {fmtWait(amenity.waitTime)}
                  </div>
                </div>
                <div>
                  <div className="label-xs">Predict 15m</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.25rem', fontWeight: 600, color: trendColor }}>
                    <TrendIcon size={16} />
                    <span className="mono">{fmtWait(amenity.predictedWaitTime)}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
