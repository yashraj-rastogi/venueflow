import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore, adminDb } from '@/lib/firebaseAdmin';

/**
 * POST /api/checkin
 * Body: { venueId: string, eventId?: string, zoneId?: string, section?: string, seat?: string, lang?: string }
 *
 * 1. Creates an anonymous GuestSession in Firestore `guest_sessions`
 * 2. Increments RTDB `crowd_data/{venueId}/zones/{zoneId}/count` by 1
 * 3. Updates total crowd count in RTDB `crowd_data/{venueId}/totalCount`
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { venueId, eventId, zoneId = 'zone-n', section = '', seat = '', lang = 'en' } = body;

    if (!venueId) {
      return NextResponse.json({ ok: false, error: 'venueId is required' }, { status: 400 });
    }

    const now = Date.now();

    // 1. Create GuestSession record in Firestore
    const sessionData = {
      venueId,
      eventId: eventId || null,
      zoneId,
      section: section || null,
      seat: seat || null,
      language: lang,
      createdAt: now,
      lastSeenAt: now,
    };

    const sessionRef = await adminFirestore.collection('guest_sessions').add(sessionData);

    // 2. Increment live crowd count in RTDB atomically
    try {
      const zoneRef = adminDb.ref(`crowd_data/${venueId}/zones/${zoneId}/count`);
      const totalRef = adminDb.ref(`crowd_data/${venueId}/totalCount`);

      await zoneRef.transaction((current: number | null) => (current || 0) + 1);
      await totalRef.transaction((current: number | null) => (current || 0) + 1);
    } catch (rtdbErr) {
      console.warn('[CheckIn] RTDB count update failed:', rtdbErr);
    }

    return NextResponse.json({
      ok: true,
      sessionId: sessionRef.id,
      session: sessionData,
      message: 'Check-in recorded successfully',
    });
  } catch (err) {
    console.error('[CheckIn API]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Check-in failed' },
      { status: 500 }
    );
  }
}
