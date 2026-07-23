import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore, adminDb } from '@/lib/firebaseAdmin';

/**
 * POST /api/checkout
 * Body: { venueId: string, zoneId?: string, sessionId?: string }
 *
 * 1. Decrements RTDB `crowd_data/{venueId}/zones/{zoneId}/count`
 * 2. Decrements RTDB `crowd_data/{venueId}/totalCount`
 * 3. Removes or marks GuestSession in Firestore
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { venueId, zoneId = 'zone-n', sessionId } = body;

    if (!venueId) {
      return NextResponse.json({ ok: false, error: 'venueId is required' }, { status: 400 });
    }

    // 1. Decrement live crowd count in RTDB (floor at 0)
    try {
      const zoneRef = adminDb.ref(`crowd_data/${venueId}/zones/${zoneId}/count`);
      const totalRef = adminDb.ref(`crowd_data/${venueId}/totalCount`);

      await zoneRef.transaction((current: number | null) => Math.max((current || 0) - 1, 0));
      await totalRef.transaction((current: number | null) => Math.max((current || 0) - 1, 0));
    } catch (rtdbErr) {
      console.warn('[CheckOut] RTDB count update failed:', rtdbErr);
    }

    // 2. Remove session if provided
    if (sessionId) {
      try {
        await adminFirestore.collection('guest_sessions').doc(sessionId).delete();
      } catch (fsErr) {
        console.warn('[CheckOut] Firestore session delete failed:', fsErr);
      }
    }

    return NextResponse.json({
      ok: true,
      message: 'Successfully checked out of venue',
    });
  } catch (err) {
    console.error('[CheckOut API]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Check-out failed' },
      { status: 500 }
    );
  }
}
