import { NextRequest, NextResponse } from 'next/server';
import { createVenueInOrg } from '@/lib/firestore';
import { adminCreateVenueInOrg, writePath } from '@/lib/firebaseAdmin';
import { SAMPLE_NOTIFICATIONS, SAMPLE_VENUES } from '@/lib/sampleData';
import { Venue, Zone, Amenity, Section } from '@/types';
import { ensureVenueSeeded } from '@/lib/seedFirebase';

/**
 * POST /api/venues/import
 *
 * Imports a venue into an organization using Google Maps Places API & real-world location URL parsing.
 *
 * Body: { orgId: string, name: string, city?: string, mapsUrl?: string, apiKey?: string }
 */

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/** Extract lat,lng coordinates from various Google Maps URLs, short links, or raw coordinate strings */
async function extractCoordsFromUrl(url: string): Promise<{ lat: number; lng: number } | null> {
  if (!url) return null;
  let targetUrl = url.trim();

  // Format 0: Raw lat, lng string like "26.8124, 80.9984" or "26.8124,80.9984"
  const rawMatch = targetUrl.match(/^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/);
  if (rawMatch) {
    return { lat: parseFloat(rawMatch[1]), lng: parseFloat(rawMatch[2]) };
  }

  // Follow short URL redirect if maps.app.goo.gl or goo.gl/maps
  if (targetUrl.includes('maps.app.goo.gl') || targetUrl.includes('goo.gl/maps')) {
    try {
      const res = await fetch(targetUrl, { method: 'GET', redirect: 'follow' });
      if (res.url) targetUrl = res.url;
    } catch {
      // Proceed with original string if redirect fetch fails
    }
  }

  // Format 1: /@26.8124,80.9984,17z
  const atMatch = targetUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  }

  // Format 2: !3d26.8124!4d80.9984 (Google Maps pin/place embed format)
  const bangMatch = targetUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (bangMatch) {
    return { lat: parseFloat(bangMatch[1]), lng: parseFloat(bangMatch[2]) };
  }

  // Format 3: ?q=26.8124,80.9984 or &ll=26.8124,80.9984 or ?query=26.8124,80.9984
  const qMatch = targetUrl.match(/[?&](?:q|ll|query)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch) {
    return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
  }

  return null;
}

/** Extract Place ID from Google Maps URLs */
function extractPlaceIdFromUrl(url: string): string | null {
  if (!url) return null;
  const placeMatch = url.match(/place\/[^/]+\/([^/]+)/);
  if (placeMatch) return decodeURIComponent(placeMatch[1]);

  const ftidMatch = url.match(/[?&]ftid=([^&]+)/);
  if (ftidMatch) return decodeURIComponent(ftidMatch[1]);

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      orgId   : string;
      name    : string;
      city   ?: string;
      mapsUrl?: string;
      apiKey ?: string;
    };

    const { orgId, name, city = '', mapsUrl = '', apiKey: customApiKey } = body;

    if (!orgId || !name) {
      return NextResponse.json({ ok: false, error: 'orgId and name are required' }, { status: 400 });
    }

    const apiKey = customApiKey || process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

    let lat        = 0;
    let lng        = 0;
    let realCity   = city;
    let capacity   = 65000;
    let photoUrl   = '';
    let address    = city;
    let placeId    = extractPlaceIdFromUrl(mapsUrl) || '';
    let enriched   = false;

    // ── 1. Parse coordinates from Google Maps URL or raw input ──────────────
    const urlCoords = await extractCoordsFromUrl(mapsUrl);
    if (urlCoords) {
      lat = urlCoords.lat;
      lng = urlCoords.lng;
      enriched = true;
    }

    // ── 2. Call Google Places API if key available ──────────────────────────
    if (apiKey) {
      try {
        if (!placeId) {
          const searchQuery = `${name} ${city}`.trim() || mapsUrl;
          const searchRes   = await fetch(
            `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${apiKey}`
          );
          const searchData  = await searchRes.json();

          if (searchData.results && searchData.results.length > 0) {
            const first = searchData.results[0];
            placeId = first.place_id;
            if (!lat && !lng && first.geometry?.location) {
              lat = first.geometry.location.lat;
              lng = first.geometry.location.lng;
            }
            if (first.formatted_address) {
              address = first.formatted_address;
            }
          }
        }

        if (placeId) {
          const detailsRes  = await fetch(
            `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,geometry,photos,formatted_address,vicinity,rating,types&key=${apiKey}`
          );
          const detailsData = await detailsRes.json();

          if (detailsData.result) {
            const res = detailsData.result;
            if (res.geometry?.location) {
              lat = res.geometry.location.lat;
              lng = res.geometry.location.lng;
            }
            if (res.formatted_address) {
              address = res.formatted_address;
              const parts = res.formatted_address.split(',');
              if (parts.length >= 2) {
                realCity = `${parts[parts.length - 3]?.trim() ?? ''}, ${parts[parts.length - 2]?.trim() ?? ''}`.replace(/^, /, '');
              }
            }
            if (res.photos && res.photos.length > 0) {
              photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${res.photos[0].photo_reference}&key=${apiKey}`;
            }
            enriched = true;
          }
        }
      } catch (apiErr) {
        console.warn('[VenueImport] Google Places API fetch failed:', apiErr);
      }
    }

    // ── 3. Free OpenStreetMap Nominatim Geocoding Fallback ──────────────────
    if (!lat && !lng) {
      try {
        const queryTerm = `${name} ${city}`.trim() || mapsUrl;
        if (queryTerm) {
          const nomRes = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryTerm)}&limit=1`,
            { headers: { 'User-Agent': 'VenueFlow-Stadium-Importer/1.0' } }
          );
          const nomData = await nomRes.json();
          if (Array.isArray(nomData) && nomData.length > 0) {
            lat = parseFloat(nomData[0].lat);
            lng = parseFloat(nomData[0].lon);
            if (nomData[0].display_name) {
              address = nomData[0].display_name;
              const parts = address.split(',');
              if (parts.length >= 2) {
                realCity = `${parts[1]?.trim() ?? ''}, ${parts[parts.length - 1]?.trim() ?? ''}`;
              }
            }
            enriched = true;
            console.info(`[VenueImport] Nominatim geocoded "${queryTerm}" to (${lat}, ${lng}) ✓`);
          }
        }
      } catch (nomErr) {
        console.warn('[VenueImport] Nominatim geocoding failed:', nomErr);
      }
    }

    // Default fallback coordinates if none found (center of US or default)
    if (!lat && !lng) {
      lat = 40.8135;
      lng = -74.0745;
    }

    const venueId  = slugify(name);
    const demoBase = SAMPLE_VENUES[0]; // MetLife template for zone names/capacity/sections only

    /**
     * Convert metre offset to degree shift at venue latitude
     */
    const metresToDeg = (m: number, isLat = true) =>
      isLat ? m / 111320 : m / (111320 * Math.cos((lat * Math.PI) / 180));

    // ── 4. Real-World Amenity Enrichment via Google Places Nearby Search ──────
    let fetchedAmenities: Amenity[] = [];
    if (apiKey && lat && lng) {
      try {
        const nearbyUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=350&keyword=gate|entrance|food|restroom|store&key=${apiKey}`;
        const nearbyRes = await fetch(nearbyUrl);
        const nearbyData = await nearbyRes.json();

        if (nearbyData.results && Array.isArray(nearbyData.results) && nearbyData.results.length > 0) {
          fetchedAmenities = nearbyData.results.slice(0, 10).map((place: {
            place_id: string;
            name: string;
            types?: string[];
            geometry?: { location?: { lat: number; lng: number } };
          }, idx: number) => {
            const types = place.types ?? [];
            let aType: Amenity['type'] = 'concession';
            if (place.name.toLowerCase().includes('gate') || place.name.toLowerCase().includes('entrance') || types.includes('subway_station')) {
              aType = 'gate';
            } else if (place.name.toLowerCase().includes('restroom') || place.name.toLowerCase().includes('toilet')) {
              aType = 'restroom';
            } else if (types.includes('store') || place.name.toLowerCase().includes('shop') || place.name.toLowerCase().includes('store')) {
              aType = 'merchandise';
            }

            return {
              id: `amenity-${place.place_id || idx}`,
              type: aType,
              name: place.name,
              location: {
                lat: parseFloat(place.geometry?.location?.lat?.toFixed(6) ?? lat.toFixed(6)),
                lng: parseFloat(place.geometry?.location?.lng?.toFixed(6) ?? lng.toFixed(6)),
              },
              section: 'General Concourse',
              waitTime: 0,
              predictedWaitTime: 0,
              trend: 'stable' as const,
              isOpen: true,
            };
          });
        }
      } catch (err) {
        console.warn('[VenueImport] Nearby Places search failed:', err);
      }
    }

    // Default fallback amenity positioning if Places API returned fewer items
    const amenityRingM = Math.round((capacity > 80000 ? 75 : capacity > 50000 ? 60 : 45) * 1.45);
    const amenityOffsets = [
      { dLatM:  amenityRingM,  dLngM:  0             }, // Gate A — North
      { dLatM: -amenityRingM,  dLngM:  0             }, // Gate B — South
      { dLatM:  0,             dLngM:  amenityRingM   }, // East Concession
      { dLatM:  0,             dLngM: -amenityRingM   }, // West Concession
      { dLatM:  Math.round(amenityRingM * 0.7), dLngM:  Math.round(amenityRingM * 0.7) }, // NE Restroom
      { dLatM: -Math.round(amenityRingM * 0.7), dLngM: -Math.round(amenityRingM * 0.7) }, // SW Restroom
      { dLatM:  Math.round(amenityRingM * 0.3), dLngM: -Math.round(amenityRingM * 0.6) }, // Team Store
    ];

    const shiftedAmenities: Amenity[] = fetchedAmenities.length >= 4
      ? fetchedAmenities
      : demoBase.amenities.map((a, i) => {
          const off = amenityOffsets[i] ?? { dLatM: 0, dLngM: 0 };
          return {
            ...a,
            location: {
              lat: parseFloat((lat + metresToDeg(off.dLatM, true)).toFixed(6)),
              lng: parseFloat((lat ? lng + metresToDeg(off.dLngM, false) : lng).toFixed(6)),
            },
          };
        });

    // ── 5. OpenStreetMap Overpass Real Grandstand Geometry Lookup ───────────
    let osmZones: Zone[] = [];
    try {
      const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(`[out:json][timeout:5];way["building"="grandstand"](around:350,${lat},${lng});out geom;`)}`;
      const overpassRes = await fetch(overpassUrl, { headers: { 'User-Agent': 'VenueFlow/1.0' } });
      const overpassData = await overpassRes.json();

      if (overpassData.elements && Array.isArray(overpassData.elements) && overpassData.elements.length >= 2) {
        osmZones = overpassData.elements.slice(0, 6).map((el: { id: number; tags?: { name?: string }; geometry?: { lat: number; lon: number }[] }, idx: number) => {
          const rawGeom = el.geometry ?? [];
          const coords = rawGeom.map(pt => ({ lat: parseFloat(pt.lat.toFixed(6)), lng: parseFloat(pt.lon.toFixed(6)) }));
          return {
            id: `zone-osm-${el.id || idx}`,
            name: el.tags?.name || `Stand ${String.fromCharCode(65 + idx)}`,
            capacity: Math.round(capacity / Math.max(overpassData.elements.length, 1)),
            currentCount: 0,
            density: 0,
            coordinates: coords,
            areaM2: 1500,
            egressWidthM: 10,
            isStepFree: idx % 2 === 0,
            phase: 'circulation' as const,
          };
        });
      }
    } catch (osmErr) {
      console.warn('[VenueImport] OSM Overpass grandstand lookup fallback:', osmErr);
    }

    // Capacity-scaled radial layout fallback if OSM does not have grandstands mapped
    const zoneRingM = capacity > 80000 ? 75
                    : capacity > 50000 ? 60
                    : capacity > 20000 ? 45
                    : 35;
    const dr = zoneRingM * 0.55;

    const shiftedZones: Zone[] = osmZones.length >= 2 ? osmZones : demoBase.zones.map((z, i) => {
      const totalZones = demoBase.zones.length;
      const angleDeg   = (360 / totalZones) * i - 90;
      const angleRad   = angleDeg * (Math.PI / 180);

      const centerLat = lat + metresToDeg(zoneRingM * Math.cos(angleRad), true);
      const centerLng = lng + metresToDeg(zoneRingM * Math.sin(angleRad), false);

      return {
        ...z,
        coordinates: [
          { lat: parseFloat((centerLat + metresToDeg(dr, true)).toFixed(6)),  lng: parseFloat((centerLng - metresToDeg(dr, false)).toFixed(6)) },
          { lat: parseFloat((centerLat + metresToDeg(dr, true)).toFixed(6)),  lng: parseFloat((centerLng + metresToDeg(dr, false)).toFixed(6)) },
          { lat: parseFloat((centerLat - metresToDeg(dr, true)).toFixed(6)),  lng: parseFloat((centerLng + metresToDeg(dr, false)).toFixed(6)) },
          { lat: parseFloat((centerLat - metresToDeg(dr, true)).toFixed(6)),  lng: parseFloat((centerLng - metresToDeg(dr, false)).toFixed(6)) },
        ],
      };
    });

    const fullVenue: Venue = {
      id       : venueId,
      name     : name.trim(),
      city     : realCity || city || address || 'Real Location',
      lat      : parseFloat(lat.toFixed(6)),
      lng      : parseFloat(lng.toFixed(6)),
      capacity,
      imageUrl : photoUrl || demoBase.imageUrl,
      zones    : shiftedZones,
      sections : demoBase.sections,
      amenities: shiftedAmenities,
      riskProfile: {
        climateRisks           : ['local_weather_monitoring'],
        transitVulnerabilities : ['main_access_road'],
        heatThresholdF         : 95,
      },
    };

    const { id: _, ...venueData } = fullVenue;

    // Use Admin Firestore SDK to write to Firestore with admin privileges
    try {
      await adminCreateVenueInOrg(orgId, venueId, venueData as unknown as Record<string, unknown>);
    } catch (adminErr) {
      console.warn('[VenueImport] Admin SDK write failed, fallback to client write:', adminErr);
      await createVenueInOrg(orgId, venueData);
    }

    // Seed RTDB with venue & crowd data directly via Admin SDK and client fallback
    try {
      const zonesObj: Record<string, object> = {};
      for (const z of shiftedZones) {
        zonesObj[z.id] = { name: z.name, capacity: z.capacity, coordinates: z.coordinates };
      }
      const amenitiesObj: Record<string, object> = {};
      for (const a of shiftedAmenities) {
        amenitiesObj[a.id] = { name: a.name, type: a.type, location: a.location, section: a.section, capacity: a.capacity ?? null };
      }
      const sectionsObj: Record<string, object> = {};
      for (const s of demoBase.sections) {
        sectionsObj[s.id] = { name: s.name, level: s.level, zones: s.zones };
      }

      await writePath(`venues/${venueId}`, {
        name: name.trim(),
        city: realCity || city || address || 'Real Location',
        capacity,
        lat: parseFloat(lat.toFixed(6)),
        lng: parseFloat(lng.toFixed(6)),
        imageUrl: photoUrl || demoBase.imageUrl,
        zones: zonesObj,
        amenities: amenitiesObj,
        sections: sectionsObj,
      });

      const crowdZones: Record<string, object> = {};
      for (const z of shiftedZones) {
        // Start at 0 guests — let the admin trigger a simulation or staff check-ins populate this
        crowdZones[z.id] = { density: 0, count: 0, capacity: z.capacity };
      }
      await writePath(`crowd_data/${venueId}`, {
        timestamp: Date.now(),
        venueId,
        totalCount: 0,
        zones: crowdZones,
      });

      const waitObj: Record<string, object> = {};
      for (const a of shiftedAmenities) {
        // All amenities start with 0 wait time and open status
        waitObj[a.id] = { waitTime: 0, predictedWaitTime: 0, trend: 'stable', isOpen: true };
      }
      await writePath(`wait_times/${venueId}`, waitObj);
    } catch (rtdbErr) {
      console.warn('[VenueImport] Server RTDB seed failed:', rtdbErr);
    }

    await ensureVenueSeeded(venueId, fullVenue).catch(e =>
      console.warn('[VenueImport] Client RTDB seed failed (non-fatal):', e)
    );

    return NextResponse.json({
      ok      : true,
      venueId,
      enriched,
      message : enriched
        ? `Venue "${name}" imported with real-world Google Maps location at (${lat}, ${lng}).`
        : `Venue "${name}" created at coordinates (${lat}, ${lng}).`,
      venue   : { id: venueId, ...venueData },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
