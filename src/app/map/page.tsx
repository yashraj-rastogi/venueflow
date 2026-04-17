'use client';
import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { SAMPLE_VENUES } from '@/lib/sampleData';
import { useCrowdData } from '@/hooks/useRealtimeData';

const VenueMap = dynamic(() => import('@/components/Map'), { 
  ssr: false, 
  loading: () => <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={32} className="anim-spin" color="var(--blue-soft)" /></div> 
});

const venue = SAMPLE_VENUES[0];

export default function StandaloneMapPage() {
  const { crowd } = useCrowdData(venue.id);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  // Expose setZone to window so Leaflet can call it
  if (typeof window !== 'undefined') {
    (window as any).selectZone = (id: string) => setSelectedZone(id);
  }

  const selectedData = selectedZone ? crowd.zones[selectedZone] : null;
  const selectedInfo = selectedZone ? venue.zones.find(z => z.id === selectedZone) : null;

  return (
    <div style={{ height: '100vh', width: '100vw', position: 'relative', overflow: 'hidden' }}>
      {/* Top Header */}
      <div style={{ position: 'absolute', top: 20, left: 20, right: 20, zIndex: 500, display: 'flex', justifyContent: 'space-between', pointerEvents: 'none' }}>
        <div className="card-hi" style={{ pointerEvents: 'auto', padding: '0.75rem 1.25rem', backdropFilter: 'blur(12px)', background: 'rgba(8,12,24,0.75)' }}>
          <h1 style={{ fontSize: '1rem', fontWeight: 800 }}>{venue.name} Live Map</h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>Real-time Crowd Density</p>
        </div>
        <Link href={`/venue/${venue.id}`} className="btn-ghost card-hi" style={{ pointerEvents: 'auto', textDecoration: 'none', background: 'rgba(8,12,24,0.75)' }}>
          Exit Map View
        </Link>
      </div>

      <VenueMap venue={venue} crowd={crowd} />

      {/* Sidebar Overlay */}
      {selectedZone && selectedInfo && selectedData && (
        <div className="anim-fade-in card-hi" style={{ 
          position: 'absolute', right: 20, top: 80, width: 300, zIndex: 500,
          background: 'rgba(12,16,33,0.9)', backdropFilter: 'blur(16px)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <div className="label-xs" style={{ color: 'var(--blue-glow)' }}>ZONE ID: {selectedInfo.id}</div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{selectedInfo.name}</h2>
            </div>
            <button onClick={() => setSelectedZone(null)} style={{ background: 'none', border: 'none', color: 'var(--text-4)', cursor: 'pointer' }}>×</button>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span className="label-xs">Density</span>
              <span className="mono" style={{ fontWeight: 600 }}>{(selectedData.density * 100).toFixed(0)}%</span>
            </div>
            <div className="progress-track" style={{ height: 8 }}>
              <div className="progress-fill" style={{ 
                width: `${selectedData.density * 100}%`,
                background: selectedData.density > 0.7 ? 'var(--red)' : selectedData.density > 0.3 ? 'var(--amber)' : 'var(--green)'
              }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div style={{ padding: '0.75rem', background: 'var(--bg-1)', borderRadius: 12 }}>
              <div className="label-xs">Active Count</div>
              <div className="stat-lg mono">{selectedData.count}</div>
            </div>
            <div style={{ padding: '0.75rem', background: 'var(--bg-1)', borderRadius: 12 }}>
              <div className="label-xs">Capacity</div>
              <div className="stat-lg mono">{selectedData.capacity.toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
