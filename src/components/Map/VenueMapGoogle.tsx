'use client';
import { useEffect, useMemo } from 'react';
import {
  APIProvider,
  Map,
  useMap,
  Circle as GMCircle,
  AdvancedMarker,
  InfoWindow,
} from '@vis.gl/react-google-maps';
import { Venue, CrowdSnapshot } from '@/types';
import { getDensityColor, formatPercent, formatWaitTime } from '@/lib/utils';
import { useState } from 'react';

const GMAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

// ─── MapID for cloud-based styling (dark mode via Google Cloud Console) ──────
// Using mapId='DEMO_MAP_ID' works without a Cloud project map ID; for production
// create a dark-styled map at console.cloud.google.com/google/maps-apis/studio
const MAP_ID = 'DEMO_MAP_ID';

type LatLng = { lat: number; lng: number };

// ─── Amenity emoji mapping ────────────────────────────────────────────────────
const AMENITY_EMOJI: Record<string, string> = {
  restroom: '🚻', concession: '🍔', merchandise: '🛍️',
  gate: '🚪', medical: '🏥', parking: '🅿️', elevator: '🛗',
};

// ─── Derive zone center from stored bounding-box, or fall back to radial ──────
function zoneCenter(
  zone: { coordinates?: LatLng[] },
  vLat: number, vLng: number,
  index: number, total: number,
): LatLng {
  const coords = zone.coordinates;
  if (coords && coords.length > 0) {
    const lat = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
    const lng = coords.reduce((s, c) => s + c.lng, 0) / coords.length;
    const dLat = Math.abs(lat - vLat);
    const dLng = Math.abs(lng - vLng);
    if (dLat > 0.00004 || dLng > 0.00004) return { lat, lng };
  }
  const angle = ((360 / total) * index - 90) * (Math.PI / 180);
  const r = 0.0007;
  return {
    lat: parseFloat((vLat + r * Math.cos(angle)).toFixed(6)),
    lng: parseFloat((vLng + r * Math.sin(angle)).toFixed(6)),
  };
}

// ─── Inner component (must be inside APIProvider) ────────────────────────────
function VenueMapInner({ venue, crowd }: { venue: Venue; crowd: CrowdSnapshot }) {
  const map = useMap();
  const [activeZone, setActiveZone] = useState<string | null>(null);
  const [activeAmenity, setActiveAmenity] = useState<string | null>(null);

  const vLat = venue.lat;
  const vLng = venue.lng;

  // Fly map to venue on mount / venue change
  useEffect(() => {
    if (!map) return;
    map.panTo({ lat: vLat, lng: vLng });
    map.setZoom(16);
  }, [map, vLat, vLng]);

  // Capacity-aware zone radius in metres
  const zoneRadiusM = useMemo(() => {
    const cap = venue.capacity ?? 50000;
    if (cap > 80000) return 65;
    if (cap > 50000) return 55;
    if (cap > 20000) return 45;
    return 35;
  }, [venue.capacity]);

  return (
    <>
      {/* ── Faint venue footprint ring ─────────────────────────────────────── */}
      <GMCircle
        center={{ lat: vLat, lng: vLng }}
        radius={zoneRadiusM * 1.65}
        strokeColor="#b4c5ff"
        strokeOpacity={0.15}
        strokeWeight={1}
        fillOpacity={0}
      />

      {/* ── Zone density circles ───────────────────────────────────────────── */}
      {venue.zones.map((zone, i) => {
        const zoneData = crowd.zones[zone.id];
        const density  = zoneData?.density ?? zone.density ?? 0;
        const count    = zoneData?.count ?? zone.currentCount ?? 0;
        const color    = getDensityColor(density);
        const center   = zoneCenter(zone, vLat, vLng, i, venue.zones.length);
        const isActive = activeZone === zone.id;

        return (
          <div key={zone.id}>
            <GMCircle
              center={center}
              radius={zoneRadiusM}
              strokeColor={color}
              strokeOpacity={0.9}
              strokeWeight={isActive ? 3 : 2}
              fillColor={color}
              fillOpacity={0.18 + density * 0.2}
              onClick={() => setActiveZone(isActive ? null : zone.id)}
              clickable
            />
            {isActive && (
              <InfoWindow position={center} onCloseClick={() => setActiveZone(null)}>
                <div style={{ background: '#161b2b', color: '#dee1f7', padding: '10px 12px', borderRadius: 8, minWidth: 160, fontFamily: 'Inter, sans-serif' }}>
                  <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>{zone.name}</div>
                  <div style={{ color, fontSize: 22, fontWeight: 800 }}>{formatPercent(density)}</div>
                  <div style={{ color: '#8d90a0', fontSize: 12, marginTop: 2 }}>
                    {count.toLocaleString()} / {zone.capacity.toLocaleString()} guests
                  </div>
                  {zone.isStepFree && (
                    <div style={{ color: '#10B981', fontSize: 11, marginTop: 5 }}>♿ Step-free access</div>
                  )}
                </div>
              </InfoWindow>
            )}
          </div>
        );
      })}

      {/* ── Amenity markers ───────────────────────────────────────────────── */}
      {venue.amenities
        .filter(a => a.location &&
          (Math.abs(a.location.lat - vLat) > 0.00001 || Math.abs(a.location.lng - vLng) > 0.00001))
        .map(amenity => {
          const isActive = activeAmenity === amenity.id;
          return (
            <div key={amenity.id}>
              <AdvancedMarker
                position={amenity.location}
                title={amenity.name}
                onClick={() => setActiveAmenity(isActive ? null : amenity.id)}
              >
                <div style={{
                  background: '#1a213a',
                  border: '1.5px solid #b4c5ff55',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '13px',
                  boxShadow: '0 0 10px #2563eb44',
                  cursor: 'pointer',
                }}>
                  {AMENITY_EMOJI[amenity.type] ?? '📍'}
                </div>
              </AdvancedMarker>
              {isActive && (
                <InfoWindow position={amenity.location} onCloseClick={() => setActiveAmenity(null)}>
                  <div style={{ background: '#161b2b', color: '#dee1f7', padding: '10px 12px', borderRadius: 8, minWidth: 155, fontFamily: 'Inter, sans-serif' }}>
                    <div style={{ fontSize: 10, color: '#8d90a0', textTransform: 'uppercase', letterSpacing: 1 }}>{amenity.type}</div>
                    <div style={{ fontWeight: 700, marginBottom: 6, marginTop: 2, fontSize: 13 }}>{amenity.name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: amenity.isOpen ? '#10B981' : '#EF4444', fontSize: 12, fontWeight: 600 }}>
                        {amenity.isOpen ? 'Open' : 'Closed'}
                      </span>
                      <span style={{ color: '#b4c5ff', fontSize: 18, fontWeight: 800 }}>
                        {formatWaitTime(amenity.waitTime)}
                      </span>
                    </div>
                    <div style={{ color: '#8d90a0', fontSize: 11, marginTop: 2 }}>current wait</div>
                  </div>
                </InfoWindow>
              )}
            </div>
          );
        })}
    </>
  );
}

// ─── Public component — wraps with APIProvider ────────────────────────────────
interface Props {
  venue: Venue;
  crowd: CrowdSnapshot;
}

export default function VenueMap({ venue, crowd }: Props) {
  if (!GMAPS_KEY) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8d90a0', fontSize: 13, background: '#0e1322', borderRadius: 12 }}>
        ⚠️ NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not set
      </div>
    );
  }

  return (
    <APIProvider apiKey={GMAPS_KEY}>
      <Map
        defaultCenter={{ lat: venue.lat, lng: venue.lng }}
        defaultZoom={16}
        mapId={MAP_ID}
        style={{ width: '100%', height: '100%', borderRadius: 12 }}
        gestureHandling="greedy"
        disableDefaultUI={false}
        zoomControl
        mapTypeControl={false}
        streetViewControl={false}
        fullscreenControl={false}
        colorScheme="DARK"
      >
        <VenueMapInner venue={venue} crowd={crowd} />
      </Map>
    </APIProvider>
  );
}
