import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore, adminDb } from '@/lib/firebaseAdmin';

/**
 * POST /api/location/update
 * Body: { sessionId, complexId, spaceId, zoneId, floor?, source?: 'qr' | 'manual' }
 *
 * Silent zone-progression handler called when a guest scans an internal venue QR code.
 * Delegates to the zone-update mode of /api/checkin internally, but provides a
 * dedicated endpoint optimised for the /location-update landing page:
 *   - No new Firestore document created
 *   - Atomically decrements old zone, increments new zone
 *   - Updates guest_positions/{complexId}/{sessionId} in RTDB
 *   - Returns immediately with new position data for the map marker
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      sessionId,
      complexId,
      spaceId,
      zoneId,
      floor    = 0,
      source   = 'qr',
    } = body;

    if (!sessionId || !zoneId) {
      return NextResponse.json(
        { ok: false, error: 'sessionId and zoneId are required' },
        { status: 400 },
      );
    }

    const now = Date.now();

    // Validate session exists and is not expired
    const sessionRef  = adminFirestore.collection('guest_sessions').doc(sessionId);
    const sessionSnap = await sessionRef.get();

    if (!sessionSnap.exists) {
      return NextResponse.json({ ok: false, error: 'Session not found or expired' }, { status: 404 });
    }

    const session = sessionSnap.data()!;
    if (session.expiresAt && session.expiresAt < now) {
      return NextResponse.json({ ok: false, error: 'Session expired — please re-scan the entrance QR' }, { status: 410 });
    }

    const oldZoneId  = session.zoneId  ?? 'zone-n';
    const oldSpaceId = session.spaceId ?? spaceId;
    const effComplex = complexId || session.complexId;

    // Atomically swap crowd counts in RTDB
    if (effComplex && spaceId) {
      const oldCountRef = adminDb.ref(`complex_crowd/${effComplex}/spaces/${oldSpaceId}/count`);
      const newCountRef = adminDb.ref(`complex_crowd/${effComplex}/spaces/${spaceId}/count`);

      await Promise.all([
        oldCountRef.transaction((c: number | null) => Math.max((c || 0) - 1, 0)),
        newCountRef.transaction((c: number | null) => (c || 0) + 1),
      ]);

      // Write live position to RTDB (for ComplexAdmin guest map)
      await adminDb.ref(`guest_positions/${effComplex}/${sessionId}`).set({
        spaceId,
        zoneId,
        floor,
        updatedAt     : now,
        locationSource: source,
      });
    } else {
      // Legacy single-venue path
      const venueId    = session.venueId ?? 'unknown';
      const oldZoneRef = adminDb.ref(`crowd_data/${venueId}/zones/${oldZoneId}/count`);
      const newZoneRef = adminDb.ref(`crowd_data/${venueId}/zones/${zoneId}/count`);
      await Promise.all([
        oldZoneRef.transaction((c: number | null) => Math.max((c || 0) - 1, 0)),
        newZoneRef.transaction((c: number | null) => (c || 0) + 1),
      ]);
    }

    // Update Firestore session with new position
    await sessionRef.update({
      zoneId,
      lastSeenAt    : now,
      locationSource: source,
      ...(spaceId   && { spaceId }),
      ...(effComplex && { complexId: effComplex }),
      ...(floor !== undefined && { floor }),
    });

    return NextResponse.json({
      ok      : true,
      zoneId,
      spaceId : spaceId ?? oldSpaceId,
      floor,
      updatedAt: now,
    });
  } catch (err) {
    console.error('[Location Update API]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Location update failed' },
      { status: 500 },
    );
  }
}
