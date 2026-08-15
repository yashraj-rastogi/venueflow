import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore, adminDb } from '@/lib/firebaseAdmin';

/**
 * POST /api/checkin
 *
 * Handles three modes — all backward-compatible:
 *
 * MODE A — Legacy single-venue check-in (original behaviour):
 *   Body: { venueId, eventId?, zoneId?, section?, seat?, lang? }
 *
 * MODE B — Complex space check-in (v2):
 *   Body: { venueId, complexId, spaceId, floor?, eventId?, zoneId?, section?, seat?, lang? }
 *   Creates session with complex context + writes to complex_crowd RTDB path.
 *
 * MODE C — Zone Update / QR Progression (v2):
 *   Body: { sessionId, venueId, complexId?, spaceId?, zoneId, floor?, lang? }
 *   When sessionId is present: updates the existing session's zone, atomically
 *   decrements old zone count and increments new zone count. No new Firestore doc.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      // Legacy fields (required for Mode A)
      venueId,
      // v2 complex fields (optional)
      complexId,
      spaceId,
      floor,
      // Zone-update mode trigger
      sessionId,
      // Shared fields
      eventId,
      zoneId  = 'zone-n',
      section = '',
      seat    = '',
      lang    = 'en',
    } = body;

    if (!venueId) {
      return NextResponse.json({ ok: false, error: 'venueId is required' }, { status: 400 });
    }

    const now       = Date.now();
    const expiresAt = now + 86_400_000; // 24-hour TTL for privacy cleanup

    // ── MODE C: Zone Update (sessionId present) ──────────────────────────────
    if (sessionId) {
      try {
        const sessionRef = adminFirestore.collection('guest_sessions').doc(sessionId);
        const sessionSnap = await sessionRef.get();

        if (!sessionSnap.exists) {
          return NextResponse.json({ ok: false, error: 'Session not found' }, { status: 404 });
        }

        const session = sessionSnap.data()!;

        // Validate TTL hasn't expired
        if (session.expiresAt && session.expiresAt < now) {
          return NextResponse.json({ ok: false, error: 'Session expired' }, { status: 410 });
        }

        const oldZoneId   = session.zoneId   ?? 'zone-n';
        const oldSpaceId  = session.spaceId  ?? null;
        const oldComplexId = session.complexId ?? complexId;

        // Atomically update RTDB counts
        if (oldComplexId && spaceId) {
          // Complex path: decrement old space zone, increment new
          const oldPath = `complex_crowd/${oldComplexId}/spaces/${oldSpaceId ?? spaceId}/count`;
          const newPath = `complex_crowd/${oldComplexId}/spaces/${spaceId}/count`;

          await adminDb.ref(oldPath).transaction((c: number | null) => Math.max((c || 0) - 1, 0));
          await adminDb.ref(newPath).transaction((c: number | null) => (c || 0) + 1);

          // Write live guest position to RTDB
          await adminDb.ref(`guest_positions/${oldComplexId}/${sessionId}`).set({
            spaceId,
            zoneId,
            floor       : floor ?? 0,
            updatedAt   : now,
            locationSource: 'qr',
          });
        } else {
          // Legacy path: decrement old zone, increment new
          const oldZoneRef = adminDb.ref(`crowd_data/${venueId}/zones/${oldZoneId}/count`);
          const newZoneRef = adminDb.ref(`crowd_data/${venueId}/zones/${zoneId}/count`);
          await oldZoneRef.transaction((c: number | null) => Math.max((c || 0) - 1, 0));
          await newZoneRef.transaction((c: number | null) => (c || 0) + 1);
        }

        // Update Firestore session
        await sessionRef.update({
          zoneId,
          lastSeenAt    : now,
          ...(spaceId  && { spaceId }),
          ...(complexId && { complexId }),
          ...(floor !== undefined && { floor }),
          locationSource: 'qr',
        });

        return NextResponse.json({ ok: true, mode: 'zone_update', sessionId, zoneId, spaceId });
      } catch (err) {
        console.error('[CheckIn] Zone update failed:', err);
        return NextResponse.json({ ok: false, error: 'Zone update failed' }, { status: 500 });
      }
    }

    // ── MODE A / B: New check-in ──────────────────────────────────────────────
    const sessionData: Record<string, unknown> = {
      venueId,
      eventId   : eventId  || null,
      zoneId,
      section   : section  || null,
      seat      : seat     || null,
      language  : lang,
      createdAt : now,
      lastSeenAt: now,
      expiresAt,                   // Privacy TTL
    };

    // Attach complex context for Mode B
    if (complexId) sessionData.complexId = complexId;
    if (spaceId)   sessionData.spaceId   = spaceId;
    if (floor !== undefined) sessionData.floor = floor;

    const sessionRef = await adminFirestore.collection('guest_sessions').add(sessionData);

    // Increment RTDB counts (both legacy path and complex path if applicable)
    try {
      // Legacy crowd_data path (always updated for backward compat)
      const zoneRef  = adminDb.ref(`crowd_data/${venueId}/zones/${zoneId}/count`);
      const totalRef = adminDb.ref(`crowd_data/${venueId}/totalCount`);
      await zoneRef.transaction((c: number | null) => (c || 0) + 1);
      await totalRef.transaction((c: number | null) => (c || 0) + 1);

      // Complex crowd path (Mode B only)
      if (complexId && spaceId) {
        const spaceCountRef = adminDb.ref(`complex_crowd/${complexId}/spaces/${spaceId}/count`);
        await spaceCountRef.transaction((c: number | null) => (c || 0) + 1);
      }
    } catch (rtdbErr) {
      console.warn('[CheckIn] RTDB count update failed:', rtdbErr);
    }

    return NextResponse.json({
      ok       : true,
      mode     : complexId ? 'complex_checkin' : 'venue_checkin',
      sessionId: sessionRef.id,
      session  : sessionData,
      message  : 'Check-in recorded successfully',
    });
  } catch (err) {
    console.error('[CheckIn API]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Check-in failed' },
      { status: 500 },
    );
  }
}
