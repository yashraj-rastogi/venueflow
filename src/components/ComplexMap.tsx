'use client';
import { useEffect, useRef } from 'react';
import type { VenueComplex, VenueSpace, SpaceCrowdSlice } from '@/types';

interface ComplexMapProps {
  complex      : VenueComplex;
  spaces       : VenueSpace[];
  crowdData    : Record<string, SpaceCrowdSlice>;   // spaceId → crowd slice
  mode         : 'admin' | 'guest';
  mySpaceId   ?: string;                             // guest's current space
  onSpaceClick?: (spaceId: string) => void;
}

/**
 * ComplexMap — indoor building map using Leaflet.
 * Each VenueSpace is rendered as a Polygon colored by crowd density.
 *
 * Color scheme:
 *   - density < 0.50  → green  (#10B981)
 *   - density 0.50-0.75 → amber (#F59E0B)
 *   - density > 0.75  → red    (#EF4444)
 *   - isShared        → blue   (#6366F1) — always neutral regardless of density
 *   - mySpaceId       → pulse ring animation
 */
export default function ComplexMap({
  complex,
  spaces,
  crowdData,
  mode,
  mySpaceId,
  onSpaceClick,
}: ComplexMapProps) {
  const mapRef       = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletRef   = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const polygonsRef  = useRef<Map<string, any>>(new Map());

  function densityColor(spaceId: string, isShared: boolean): string {
    if (isShared) return '#6366F1';
    const d = crowdData[spaceId]?.density ?? 0;
    if (d > 0.75) return '#EF4444';
    if (d > 0.50) return '#F59E0B';
    return '#10B981';
  }

  // Initialize Leaflet on mount
  useEffect(() => {
    if (!mapRef.current || leafletRef.current) return;

    // Dynamic import — Leaflet must run client-only
    import('leaflet').then(L => {
      // Fix Leaflet marker icons in Next.js
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: '/leaflet/marker-icon-2x.png',
        iconUrl      : '/leaflet/marker-icon.png',
        shadowUrl    : '/leaflet/marker-shadow.png',
      });

      const map = L.map(mapRef.current!, {
        center        : [complex.lat ?? 28.6196, complex.lng ?? 77.2408],
        zoom          : 18,
        zoomControl   : true,
        scrollWheelZoom: true,
      });

      // Dark tile layer matching the Mission Control aesthetic
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO',
        maxZoom    : 22,
        subdomains : 'abcd',
      }).addTo(map);

      // Draw each space as a polygon
      spaces.forEach(space => {
        if (!space.coordinates?.length) return;

        const latlngs = space.coordinates.map(c => [c.lat, c.lng] as [number, number]);
        const color   = densityColor(space.id, space.isShared ?? false);
        const isMe    = space.id === mySpaceId;
        const density = crowdData[space.id]?.density ?? 0;

        const poly = L.polygon(latlngs, {
          color       : isMe ? '#fff' : color,
          fillColor   : color,
          fillOpacity : isMe ? 0.55 : 0.35,
          weight      : isMe ? 3 : 1.5,
          dashArray   : isMe ? '6 3' : undefined,
        }).addTo(map);

        // Tooltip
        const event = Object.values(crowdData).find((_, i) =>
          Object.keys(crowdData)[i] === space.id,
        );
        const eventName = (crowdData[space.id] as (SpaceCrowdSlice & { eventId?: string }))?.eventId ?? '';

        poly.bindTooltip(
          `<div style="font-family:Inter,sans-serif;font-size:0.78rem;font-weight:700;color:#fff">
            ${space.name}
            ${isMe ? '<br/><span style="color:#22c55e">📍 You are here</span>' : ''}
          </div>
          <div style="font-family:Inter,sans-serif;font-size:0.72rem;color:${color};margin-top:2px">
            ${Math.round(density * 100)}% capacity
          </div>`,
          { permanent: false, direction: 'top', className: 'leaflet-dark-tooltip' },
        );

        if (onSpaceClick) {
          poly.on('click', () => onSpaceClick(space.id));
          if (mode === 'admin') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (poly.getElement() as any)?.style?.setProperty('cursor', 'pointer');
          }
        }

        polygonsRef.current.set(space.id, poly);
      });

      leafletRef.current = map;

      // Fit bounds to all spaces
      const allCoords = spaces.flatMap(s => (s.coordinates ?? []).map(c => [c.lat, c.lng] as [number, number]));
      if (allCoords.length > 1) {
        map.fitBounds(L.latLngBounds(allCoords), { padding: [24, 24] });
      }
    });

    return () => {
      leafletRef.current?.remove();
      leafletRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live-update polygon colors when crowdData or mySpaceId changes
  useEffect(() => {
    polygonsRef.current.forEach((poly, spaceId) => {
      const space = spaces.find(s => s.id === spaceId);
      if (!space) return;

      const color = densityColor(spaceId, space.isShared ?? false);
      const isMe  = spaceId === mySpaceId;

      poly.setStyle({
        color      : isMe ? '#fff' : color,
        fillColor  : color,
        fillOpacity: isMe ? 0.55 : 0.35,
        weight     : isMe ? 3 : 1.5,
        dashArray  : isMe ? '6 3' : undefined,
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crowdData, mySpaceId]);

  return (
    <>
      {/* Leaflet CSS */}
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <style>{`
        .leaflet-dark-tooltip {
          background: rgba(15,17,26,0.92) !important;
          border: 1px solid rgba(255,255,255,0.12) !important;
          border-radius: 8px !important;
          box-shadow: 0 4px 16px rgba(0,0,0,0.5) !important;
          padding: 6px 10px !important;
        }
        .leaflet-dark-tooltip::before { display: none; }
      `}</style>
      <div
        ref={mapRef}
        style={{ width: '100%', height: '100%', borderRadius: 'inherit', background: '#0f111a' }}
        aria-label={`Indoor map of ${complex.name}`}
        role="img"
      />
    </>
  );
}
