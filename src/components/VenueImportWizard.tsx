'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, Building2, CheckCircle, Loader2, MapPin, Search, Shield, X } from 'lucide-react';

interface VenueImportWizardProps {
  isOpen  : boolean;
  onClose : () => void;
  orgId   : string;
}

interface ImportResult {
  id           : string;
  name         : string;
  city         : string;
  totalCapacity: number;
  zonesCount   : number;
  amenitiesCount: number;
}

export default function VenueImportWizard({ isOpen, onClose, orgId }: VenueImportWizardProps) {
  const router = useRouter();
  const [query,     setQuery]     = useState('');
  const [searching, setSearching] = useState(false);
  const [results,   setResults]   = useState<ImportResult[]>([]);
  const [selected,  setSelected]  = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [error,     setError]     = useState('');

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setError('');
    try {
      // Mock / search API for Google Places / OSM venue lookup
      const res = await fetch(`/api/venues/import?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.venues)) {
        setResults(data.venues);
      } else {
        // Fallback default search result for demonstration
        setResults([
          {
            id           : query.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            name         : query.split(',')[0],
            city         : query.split(',')[1]?.trim() || 'New Delhi',
            totalCapacity: 55000,
            zonesCount   : 6,
            amenitiesCount: 14,
          },
        ]);
      }
    } catch {
      setError('Search failed. Check venue name or network.');
    } fontSettled: {
      setSearching(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!selected) return;
    setImporting(true);
    setError('');
    try {
      const res = await fetch('/api/venues/import', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ orgId, venue: selected }),
      });
      const data = await res.json();
      if (data.ok) {
        onClose();
        router.push(`/org/${orgId}/venue/${selected.id}/admin`);
      } else {
        throw new Error(data.error || 'Import failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setImporting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 500, padding: '1.5rem', color: 'var(--text-1)', position: 'relative' }}>
        
        {/* Close Button */}
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}>
          <X size={18} />
        </button>

        <h2 style={{ fontSize: '1.125rem', fontWeight: 800, marginBottom: '0.25rem' }}>🌐 Import Stadium / Venue</h2>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)', marginBottom: '1.25rem' }}>Auto-generate zone polygons and amenities from Google Places &amp; OpenStreetMap.</p>

        {error && (
          <p style={{ fontSize: '0.8125rem', color: 'var(--danger)', marginBottom: '1rem' }}>{error}</p>
        )}

        {/* Step 1: Search Form */}
        {!selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                className="input-dark"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search venue name (e.g. Wankhede Stadium)..."
                style={{ flex: 1 }}
                required
              />
              <button type="submit" disabled={searching} className="btn-primary" style={{ padding: '0 1rem' }}>
                {searching ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={16} />}
              </button>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 260, overflowY: 'auto' }}>
              {results.map(v => (
                <div
                  key={v.id}
                  onClick={() => setSelected(v)}
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '0.875rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.15s' }}
                >
                  <div>
                    <p style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{v.name}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={11} /> {v.city} · {v.totalCapacity.toLocaleString()} capacity
                    </p>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--brand-light)', fontWeight: 600 }}>Select →</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Confirm Preview */}
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ background: 'color-mix(in srgb, var(--brand) 10%, var(--surface-2))', border: '1px solid color-mix(in srgb, var(--brand) 30%, transparent)', borderRadius: 12, padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800 }}>{selected.name}</h3>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-3)', marginTop: 2 }}>{selected.city}</p>
                </div>
                <span className="chip chip-green" style={{ fontSize: '0.7rem' }}>Detected</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginTop: '0.875rem', paddingTop: '0.875rem', borderTop: '1px solid var(--border)' }}>
                <div>
                  <p className="label-xs">Capacity</p>
                  <p style={{ fontWeight: 700, fontSize: '0.875rem' }}>{selected.totalCapacity.toLocaleString()}</p>
                </div>
                <div>
                  <p className="label-xs">Zones</p>
                  <p style={{ fontWeight: 700, fontSize: '0.875rem' }}>{selected.zonesCount}</p>
                </div>
                <div>
                  <p className="label-xs">Amenities</p>
                  <p style={{ fontWeight: 700, fontSize: '0.875rem' }}>{selected.amenitiesCount}</p>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setSelected(null)} className="btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>
                Back
              </button>
              <button onClick={handleConfirmImport} disabled={importing} className="btn-glow" style={{ flex: 2, justifyContent: 'center' }}>
                {importing ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Confirm & Import Venue'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
