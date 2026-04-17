'use client';
import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet-defaulticon-compatibility';
import { Venue, CrowdSnapshot } from '@/types';
import { getDensityColor, formatPercent, formatWaitTime } from '@/lib/utils';

// ─── Custom icon factory ───────────────────────────────────────────────────
function makeAmenityIcon(type: string) {
  const emoji: Record<string, string> = {
    restroom: '🚻',
    concession: '🍔',
    merchandise: '🛍️',
    gate: '🚪',
    medical: '🏥',
    parking: '🅿️',
  };
  return L.divIcon({
    html: `<div style="
      background:#1a213a;
      border:1.5px solid #b4c5ff44;
      border-radius:50%;
      width:30px;height:30px;
      display:flex;align-items:center;justify-content:center;
      font-size:14px;
      box-shadow:0 0 8px #2563eb55;
    ">${emoji[type] ?? '📍'}</div>`,
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -18],
  });
}

interface Props {
  venue: Venue;
  crowd: CrowdSnapshot;
}

export default function VenueMap({ venue, crowd }: Props) {
  const center: [number, number] = [venue.lat, venue.lng];

  return (
    <MapContainer
      center={center}
      zoom={15}
      style={{ height: '100%', width: '100%', borderRadius: '12px', background: '#0e1322' }}
      zoomControl={false}
      attributionControl={false}
    >
      {/* ─── CartoDB Dark Matter tiles — free, no key required ────────────── */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org">OSM</a> &copy; <a href="https://carto.com">CARTO</a>'
        maxZoom={19}
        subdomains="abcd"
      />

      {/* ─── Zone density circles ──────────────────────────────────────────── */}
      {venue.zones.map(zone => {
        const zoneData = crowd.zones[zone.id];
        const density = zoneData?.density ?? zone.density;
        const count = zoneData?.count ?? zone.currentCount;
        const color = getDensityColor(density);
        // centre of zone bounding box
        const coords = zone.coordinates;
        if (!coords || coords.length === 0) return null;
        const lat = coords.reduce((s, c) => s + c.lat, 0) / coords.length;
        const lng = coords.reduce((s, c) => s + c.lng, 0) / coords.length;

        return (
          <CircleMarker
            key={zone.id}
            center={[lat, lng]}
            radius={26}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 0.22,
              weight: 2,
              opacity: 0.85,
            }}
          >
            <Tooltip permanent direction="center" className="leaflet-zone-label">
              <span style={{ color, fontWeight: 700, fontSize: 11 }}>
                {zone.name.split(' ')[0]}<br />{formatPercent(density)}
              </span>
            </Tooltip>
            <Popup>
              <div style={{ background: '#161b2b', color: '#dee1f7', padding: 10, borderRadius: 8, minWidth: 160 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{zone.name}</div>
                <div style={{ color, fontSize: 22, fontWeight: 800 }}>{formatPercent(density)}</div>
                <div style={{ color: '#8d90a0', fontSize: 12, marginTop: 2 }}>
                  {count.toLocaleString()} / {zone.capacity.toLocaleString()} people
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}

      {/* ─── Amenity markers ──────────────────────────────────────────────── */}
      {venue.amenities.filter(a => a.location).map(amenity => (
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
