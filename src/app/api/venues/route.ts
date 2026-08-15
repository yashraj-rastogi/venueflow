import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore, adminDb } from '@/lib/firebaseAdmin';
import { SAMPLE_VENUES } from '@/lib/sampleData';
import { Venue } from '@/types';

/**
 * GET /api/venues
 * GET /api/venues?venueId=some-venue-id
 *
 * Server-privileged endpoint using Firebase Admin SDK to fetch venues from
 * Firestore and Realtime Database, merging with built-in demo venues.
 * Solves client-side Firestore collectionGroup permission issues for guests.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get('venueId');

    // ── Mode 1: Fetch single venue by ID ─────────────────────────────────────
    if (venueId) {
      // 1. Check RTDB venues/{venueId}
      try {
        const rtdbSnap = await adminDb.ref(`venues/${venueId}`).get();
        if (rtdbSnap.exists()) {
          const rtdbData = rtdbSnap.val();
          const zones = Array.isArray(rtdbData.zones)
            ? rtdbData.zones
            : rtdbData.zones
            ? Object.entries(rtdbData.zones).map(([id, z]: [string, any]) => ({
                id: z.id || id,
                name: z.name || id,
                capacity: z.capacity || 10000,
                currentCount: 0,
                density: 0,
                coordinates: z.coordinates || [],
              }))
            : [];

          const amenities = Array.isArray(rtdbData.amenities)
            ? rtdbData.amenities
            : rtdbData.amenities
            ? Object.entries(rtdbData.amenities).map(([id, a]: [string, any]) => ({
                id: a.id || id,
                name: a.name || id,
                type: a.type || 'concession',
                location: a.location || { lat: rtdbData.lat || 0, lng: rtdbData.lng || 0 },
                section: a.section || '',
                capacity: a.capacity || undefined,
                waitTime: 0,
                predictedWaitTime: 0,
                trend: 'stable' as const,
                isOpen: true,
              }))
            : [];

          const venue: Venue = {
            id: venueId,
            name: rtdbData.name || venueId,
            city: rtdbData.city || 'Location',
            capacity: rtdbData.capacity || 50000,
            lat: rtdbData.lat || 0,
            lng: rtdbData.lng || 0,
            imageUrl: rtdbData.imageUrl,
            zones,
            amenities,
            sections: Array.isArray(rtdbData.sections)
              ? rtdbData.sections
              : rtdbData.sections
              ? Object.entries(rtdbData.sections).map(([id, s]: [string, any]) => ({
                  id: s.id || id,
                  name: s.name || id,
                  level: s.level || 1,
                  zones: s.zones || [],
                }))
              : [],
          };
          return NextResponse.json({ ok: true, venue });
        }
      } catch (err) {
        console.warn('[GET /api/venues] RTDB lookup failed:', err);
      }

      // 2. Check Firestore collectionGroup('venues')
      try {
        const querySnap = await adminFirestore.collectionGroup('venues').get();
        const foundDoc = querySnap.docs.find(d => d.id === venueId);
        if (foundDoc && foundDoc.exists) {
          return NextResponse.json({ ok: true, venue: { id: foundDoc.id, ...foundDoc.data() } });
        }
      } catch (fsErr) {
        console.warn('[GET /api/venues] Firestore lookup failed:', fsErr);
      }

      // 3. Check sample venues
      const sample = SAMPLE_VENUES.find(v => v.id === venueId);
      if (sample) {
        return NextResponse.json({ ok: true, venue: sample });
      }

      return NextResponse.json({ ok: false, error: 'Venue not found' }, { status: 404 });
    }

    // ── Mode 2: Fetch all venues ─────────────────────────────────────────────
    const venueMap = new Map<string, Venue>();

    // 1. Add sample venues
    SAMPLE_VENUES.forEach(v => venueMap.set(v.id, v));

    // 2. Query Firestore collectionGroup('venues') via Admin SDK
    try {
      const fsVenuesSnap = await adminFirestore.collectionGroup('venues').get();
      fsVenuesSnap.docs.forEach(d => {
        const data = d.data() as Partial<Venue>;
        venueMap.set(d.id, {
          id: d.id,
          name: data.name || d.id,
          city: data.city || 'Location',
          capacity: data.capacity || 50000,
          lat: data.lat || 0,
          lng: data.lng || 0,
          zones: data.zones || [],
          amenities: data.amenities || [],
          sections: data.sections || [],
          imageUrl: data.imageUrl,
        });
      });
    } catch (fsErr) {
      console.warn('[GET /api/venues] All Firestore venues lookup failed:', fsErr);
    }

    // 3. Query RTDB venues/ path
    try {
      const rtdbSnap = await adminDb.ref('venues').get();
      if (rtdbSnap.exists()) {
        const allRtdb = rtdbSnap.val() as Record<string, any>;
        Object.entries(allRtdb).forEach(([id, v]) => {
          const zones = Array.isArray(v.zones)
            ? v.zones
            : v.zones
            ? Object.entries(v.zones).map(([zid, z]: [string, any]) => ({
                id: z.id || zid,
                name: z.name || zid,
                capacity: z.capacity || 10000,
                currentCount: 0,
                density: 0,
                coordinates: z.coordinates || [],
              }))
            : [];

          const existing = venueMap.get(id);
          venueMap.set(id, {
            id,
            name: v.name || existing?.name || id,
            city: v.city || existing?.city || 'Location',
            capacity: v.capacity || existing?.capacity || 50000,
            lat: v.lat ?? existing?.lat ?? 0,
            lng: v.lng ?? existing?.lng ?? 0,
            zones: zones.length > 0 ? zones : existing?.zones || [],
            amenities: Array.isArray(v.amenities)
              ? v.amenities
              : v.amenities
              ? Object.values(v.amenities)
              : existing?.amenities || [],
            sections: Array.isArray(v.sections)
              ? v.sections
              : v.sections
              ? Object.values(v.sections)
              : existing?.sections || [],
            imageUrl: v.imageUrl || existing?.imageUrl,
          });
        });
      }
    } catch (rtdbErr) {
      console.warn('[GET /api/venues] All RTDB venues lookup failed:', rtdbErr);
    }

    return NextResponse.json({
      ok: true,
      venues: Array.from(venueMap.values()),
    });
  } catch (err) {
    console.error('[GET /api/venues]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Failed to fetch venues' },
      { status: 500 },
    );
  }
}
