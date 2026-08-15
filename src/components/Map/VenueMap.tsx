'use client';
import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Circle, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet-defaulticon-compatibility';
import { Venue, CrowdSnapshot } from '@/types';
import { getDensityColor, formatPercent, formatWaitTime } from '@/lib/utils';

// ─── Amenity icon factory ────────────────────────────────────────────────────
function makeAmenityIcon(type: string) {
  const emoji: Record<string, string> = {
    restroom: '🚻',
    concession: '🍔',
    merchandise: '🛍️',
    gate: '🚪',
    medical: '🏥',
    parking: '🅿️',
    elevator: '🛗',
  };
  return L.divIcon({
    html: `<div style="
      background:#1a213a;
      border:1.5px solid #b4c5ff55;
      border-radius:50%;
      width:28px;height:28px;
      display:flex;align-items:center;justify-content:center;
      font-size:13px;
      box-shadow:0 0 10px #2563eb44;
    ">${emoji[type] ?? '📍'}</div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

/** Fly the map to venue center and fit all zone circles whenever the venue changes */
function MapFitter({ lat, lng, radiusM }: { lat: number; lng: number; radiusM: number }) {
  const map = useMap();
  useEffect(() => {
    // Fit bounds that encompass all zones (outermost zone + zone radius)
    const bound = (radiusM + 60) / 111320; // rough degree equivalent
    map.fitBounds(
      [[lat - bound, lng - bound], [lat + bound, lng + bound]],
      { animate: true, padding: [20, 20] }
    );
  }, [lat, lng, radiusM, map]);
  return null;
}

interface Props {
  venue: Venue;
  crowd: CrowdSnapshot;
}

/**
 * Derive a zone's display center from its stored coordinate bounding-box average.
 * If no coordinates, fall back to radial position around venue center.
 */
function zoneCenter(
  zone: { coordinates?: { lat: number; lng: number }[] },
  fallbackLat: number,
  fallbackLng: number,
  index: number,
  total: number
): [number, number] {
  const coords = zone.coordinates;
  if (coords && coords.length > 0) {
    const lat = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
    const lng = coords.reduce((s, c) => s + c.lng, 0) / coords.length;
    // Sanity check: if the average is very close to venue center (< 5m) it's likely MetLife junk — fallback
    const dLat = Math.abs(lat - fallbackLat);
    const dLng = Math.abs(lng - fallbackLng);
    if (dLat > 0.00004 || dLng > 0.00004) {
      return [lat, lng];
    }
  }
  // Radial fallback — evenly space zones around the venue centre
  const angle = ((360 / total) * index - 90) * (Math.PI / 180);
  const r = 0.0007; // ~77m in degrees
  return [
    parseFloat((fallbackLat + r * Math.cos(angle)).toFixed(6)),
    parseFloat((fallbackLng + r * Math.sin(angle)).toFixed(6)),
  ];
}

export default function VenueMap({ venue, crowd }: Props) {
  const vLat = venue.lat;
  const vLng = venue.lng;

  // Estimate a good zone radius in metres based on capacity
  const zoneRadiusM = useMemo(() => {
    const cap = venue.capacity ?? 50000;
    if (cap > 80000) return 65;
    if (cap > 50000) return 55;
    if (cap > 20000) return 45;
    return 35;
  }, [venue.capacity]);

  // Outermost zone radius for fitBounds
  const outerRadiusM = zoneRadiusM + 80;

  return (
    <MapContainer
      center={[vLat, vLng]}
      zoom={15}
      style={{ height: '100%', width: '100%', borderRadius: '12px', background: '#0e1322' }}
      zoomControl={false}
      attributionControl={false}
    >
      {/* ─── CartoDB Dark Matter tiles ──────────────────────────────────────── */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org">OSM</a> &copy; <a href="https://carto.com">CARTO</a>'
        maxZoom={19}
        subdomains="abcd"
      />

      {/* ─── Auto-fit to venue footprint ────────────────────────────────────── */}
      <MapFitter lat={vLat} lng={vLng} radiusM={outerRadiusM} />

      {/* ─── Faint venue footprint indicator at centre ──────────────────────── */}
      <Circle
        center={[vLat, vLng]}
        radius={zoneRadiusM * 1.6}
        pathOptions={{ color: '#b4c5ff', fillColor: '#b4c5ff', fillOpacity: 0.04, weight: 1, opacity: 0.2, dashArray: '4 6' }}
      />

      {/* ─── Zone density circles (meter-based, zoom-aware) ─────────────────── */}
      {(venue.zones || []).map((zone, i) => {
        const zoneData = crowd?.zones?.[zone.id];
        const density  = zoneData?.density ?? zone.density ?? 0.3;
        const count    = zoneData?.count    ?? zone.currentCount ?? 0;
        const color    = getDensityColor(density);
        const [zLat, zLng] = zoneCenter(zone, vLat, vLng, i, (venue.zones || []).length);

        return (
          <Circle
            key={zone.id}
            center={[zLat, zLng]}
            radius={zoneRadiusM}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 0.18 + density * 0.18,
              weight: 2,
              opacity: 0.85,
            }}
          >
            <Tooltip permanent direction="center" className="leaflet-zone-label">
              <span style={{ color, fontWeight: 700, fontSize: 11, textShadow: '0 0 4px #000' }}>
                {(zone.name || 'Zone').split(' ')[0]}<br />{formatPercent(density)}
              </span>
            </Tooltip>
            <Popup>
              <div style={{ background: '#161b2b', color: '#dee1f7', padding: 10, borderRadius: 8, minWidth: 170 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{zone.name || 'Zone'}</div>
                <div style={{ color, fontSize: 22, fontWeight: 800 }}>{formatPercent(density)}</div>
                <div style={{ color: '#8d90a0', fontSize: 12, marginTop: 2 }}>
                  {count.toLocaleString()} / {(zone.capacity || 10000).toLocaleString()} guests
                </div>
                {zone.isStepFree && (
                  <div style={{ color: '#10B981', fontSize: 11, marginTop: 4 }}>♿ Step-free access</div>
                )}
              </div>
            </Popup>
          </Circle>
        );
      })}

      {/* ─── Amenity markers ──────────────────────────────────────────────────── */}
      {(venue.amenities || [])
        .filter(a => a.location && (Math.abs(a.location.lat - vLat) > 0.00001 || Math.abs(a.location.lng - vLng) > 0.00001))
        .map(amenity => (
          <Marker
            key={amenity.id}
            position={[amenity.location.lat, amenity.location.lng]}
            icon={makeAmenityIcon(amenity.type)}
          >
            <Popup>
              <div style={{ background: '#161b2b', color: '#dee1f7', padding: 10, borderRadius: 8, minWidth: 160 }}>
                <div style={{ fontSize: 11, color: '#8d90a0', textTransform: 'uppercase', letterSpacing: 1 }}>{amenity.type}</div>
                <div style={{ fontWeight: 700, marginBottom: 6, marginTop: 2 }}>{amenity.name}</div>
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
            </Popup>
          </Marker>
        ))}
    </MapContainer>
  );
}
