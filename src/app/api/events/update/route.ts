import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * PATCH /api/events/update
 * Body: { eventId, status?, currentPhaseId?, actualAttendance? }
 *
 * Lifecycle:
 *   upcoming  →  live  (sets phaseStartedAt)
 *   live      →  ended (sets actualAttendance from RTDB crowd count)
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as {
      eventId: string;
      status?: 'upcoming' | 'live' | 'ended';
      currentPhaseId?: string;
      actualAttendance?: number;
    };

    const { eventId, status, currentPhaseId, actualAttendance } = body;
    if (!eventId) {
      return NextResponse.json({ ok: false, error: 'eventId is required' }, { status: 400 });
    }

    const ref = adminFirestore.collection('events').doc(eventId);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ ok: false, error: 'Event not found' }, { status: 404 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: Record<string, any> = {};
    if (status) update.status = status;
    if (currentPhaseId) update.currentPhaseId = currentPhaseId;
    if (status === 'live') update.phaseStartedAt = Date.now();
    if (status === 'ended' && actualAttendance !== undefined) update.actualAttendance = actualAttendance;

    await ref.update(update);

    return NextResponse.json({ ok: true, eventId, update });
  } catch (err) {
    console.error('[EventUpdate]', err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'Failed to update event' }, { status: 500 });
  }
}
