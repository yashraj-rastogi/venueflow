import { NextRequest, NextResponse } from 'next/server';
import { createVenueInOrg } from '@/lib/firestore';
import { adminCreateVenueInOrg } from '@/lib/firebaseAdmin';
import { SAMPLE_VENUES } from '@/lib/sampleData';
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

/** Extract @lat,lng coordinates from Google Maps URLs */
function extractCoordsFromUrl(url: string): { lat: number; lng: number } | null {
  if (!url) return null;

  // Format 1: /@40.8135,-74.0745,17z
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  }

  // Format 2: ?q=40.8135,-74.0745 or &ll=40.8135,-74.0745
  const qMatch = url.match(/[?&](?:q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
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

    // ── 1. Try regex parsing coordinates from Google Maps URL ──────────────
    const urlCoords = extractCoordsFromUrl(mapsUrl);
    if (urlCoords) {
      lat = urlCoords.lat;
      lng = urlCoords.lng;
      enriched = true;
    }

    // ── 2. Call Google Places API if key available ──────────────────────────
    if (apiKey) {
      try {
        // Step A: If we don't have a placeId, search for place by text query
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

        // Step B: Fetch Place Details using Place ID
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
              // Extract city/state from formatted address
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

    // Default fallback coordinates if none found (center of US or default)
    if (!lat && !lng) {
      lat = 40.8135;
      lng = -74.0745;
    }

    const venueId   = slugify(name);
    const demoBase  = SAMPLE_VENUES[0]; // MetLife template

    // Calculate coordinate shift relative to MetLife demo template
    const dLat = lat - demoBase.lat;
    const dLng = lng - demoBase.lng;

    // Generate real-world map zones offset to venue's lat/lng
    const shiftedZones: Zone[] = demoBase.zones.map(z => ({
      ...z,
      coordinates: z.coordinates.map(c => ({
        lat: parseFloat((c.lat + dLat).toFixed(6)),
        lng: parseFloat((c.lng + dLng).toFixed(6)),
      })),
    }));

    // Generate amenities offset to venue's lat/lng
    const shiftedAmenities: Amenity[] = demoBase.amenities.map(a => ({
      ...a,
      location: {
        lat: parseFloat((a.location.lat + dLat).toFixed(6)),
        lng: parseFloat((a.location.lng + dLng).toFixed(6)),
      },
    }));

    const venueData: Omit<Venue, 'id'> = {
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
    } as unknown as Omit<Venue, 'id'>;

    // Use Admin Firestore SDK to write to Firestore with admin privileges
    try {
      await adminCreateVenueInOrg(orgId, venueId, venueData as unknown as Record<string, unknown>);
    } catch (adminErr) {
      console.warn('[VenueImport] Admin SDK write failed, fallback to client write:', adminErr);
      await createVenueInOrg(orgId, venueData);
    }

    // Seed RTDB with venue & crowd data
    await ensureVenueSeeded(venueId).catch(e =>
      console.warn('[VenueImport] RTDB seed failed (non-fatal):', e)
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
