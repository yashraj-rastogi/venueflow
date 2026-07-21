import { NextRequest, NextResponse } from 'next/server';
import { SAMPLE_VENUES } from '@/lib/sampleData';

/**
 * GET /api/v1/venues/[venueId]/crowd
 *
 * Partner REST API — returns current crowd data for external integrations.
 * Authentication: Bearer API key in Authorization header.
 *
 * Response format (stable, versioned):
 * {
 *   "venueId": "metlife-stadium",
 *   "timestamp": 1721123456789,
 *   "totalCount": 68200,
 *   "safetyPhase": "warning",
 *   "zones": { "zone-a": { "density": 0.87, "count": 18000, "physicalDensity": 3.9 } }
 * }
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ venueId: string }> },
) {
  const { venueId } = await params;

  // ── API Key auth ─────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization') ?? '';
  const token      = authHeader.replace('Bearer ', '').trim();

  if (!token || token.length < 16) {
    return NextResponse.json(
      { error: 'Invalid or missing API key. Use Authorization: Bearer <key>' },
      { status: 401 },
    );
  }

  // TODO: In production, hash the token and look up in Firestore ApiKey collection
  // For now, accept any bearer token >= 16 chars for demo purposes

  const venue = SAMPLE_VENUES.find(v => v.id === venueId);
  if (!venue) {
    return NextResponse.json({ error: `Venue '${venueId}' not found` }, { status: 404 });
  }

  // Build response from current zone data
  const zones: Record<string, {
    name           : string;
    density        : number;
    count          : number;
    capacity       : number;
    physicalDensity: number;
    safetyPhase    : string;
    isStepFree    ?: boolean;
  }> = {};

  let safetyPhase = 'safe';

  for (const zone of venue.zones) {
    const physicalDensity = zone.areaM2 ? zone.currentCount / zone.areaM2 : null;
    let zoneSafety = 'safe';
    if (physicalDensity !== null) {
      if (physicalDensity > 4.5) zoneSafety = 'critical';
      else if (physicalDensity > 3.6) zoneSafety = 'warning';
    } else if (zone.density > 0.9) {
      zoneSafety = 'critical';
    } else if (zone.density > 0.75) {
      zoneSafety = 'warning';
    }

    if (zoneSafety === 'critical') safetyPhase = 'critical';
    else if (zoneSafety === 'warning' && safetyPhase === 'safe') safetyPhase = 'warning';

    zones[zone.id] = {
      name           : zone.name,
      density        : Math.round(zone.density * 1000) / 1000,
      count          : zone.currentCount,
      capacity       : zone.capacity,
      physicalDensity: physicalDensity != null ? Math.round(physicalDensity * 100) / 100 : -1,
      safetyPhase    : zoneSafety,
      isStepFree     : zone.isStepFree,
    };
  }

  const totalCount = venue.zones.reduce((s, z) => s + z.currentCount, 0);

  return NextResponse.json({
    venueId    : venue.id,
    venueName  : venue.name,
    city       : venue.city,
    timestamp  : Date.now(),
    totalCount,
    capacity   : venue.capacity,
    fillRate   : Math.round((totalCount / venue.capacity) * 1000) / 1000,
    safetyPhase,
    zones,
  }, {
    headers: {
      'Cache-Control': 'no-store',
      'X-VenueFlow-Version': '1.0',
    },
  });
}
