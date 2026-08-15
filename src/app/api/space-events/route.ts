import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore, adminDb } from '@/lib/firebaseAdmin';

/**
 * GET /api/space-events?complexId=X&spaceId=Y
 *   Returns SpaceEvents for a complex (optionally filtered by spaceId). Public read.
 *
 * POST /api/space-events
 *   Body: { complexId, spaceId, orgId, name, type, date, expectedAttendance, description?, userId }
 *   SpaceAdmin creates a new event in their space.
 *
 * PATCH /api/space-events
 *   Body: { eventId, spaceId, complexId, status, userId, ... }
 *   SpaceAdmin updates an event (typically to transition status: upcoming→live→ended).
 *   Going live also writes currentEventId to the parent VenueSpace and seeds RTDB.
 *   Ending clears currentEventId from the parent VenueSpace.
 */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const complexId = searchParams.get('complexId');
    const spaceId   = searchParams.get('spaceId');

    if (!complexId) {
      return NextResponse.json({ ok: false, error: 'complexId is required' }, { status: 400 });
    }

    let query = adminFirestore
      .collection('space_events')
      .where('complexId', '==', complexId) as FirebaseFirestore.Query;

    if (spaceId) query = query.where('spaceId', '==', spaceId);

    const snap = await query.orderBy('date', 'desc').limit(50).get();
    const events = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    return NextResponse.json({ ok: true, events });
  } catch (err) {
    console.error('[SpaceEvents GET]', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, complexId, spaceId, ...eventData } = body;

    if (!complexId || !spaceId || !eventData.name) {
      return NextResponse.json({ ok: false, error: 'complexId, spaceId, and name are required' }, { status: 400 });
    }

    const { checkPermission } = await import('@/lib/fga');
    if (userId) {
      const allowed = await checkPermission(userId, 'space_admin', 'space', spaceId);
      if (!allowed) {
        return NextResponse.json({ ok: false, error: 'Only space_admin can create events' }, { status: 403 });
      }
    }

    const now = Date.now();
    const checkinUrl = `/checkin/${complexId}/space/${spaceId}?event=pending`;

    const ref = await adminFirestore.collection('space_events').add({
      ...eventData,
      complexId,
      spaceId,
      status    : 'upcoming',
      createdAt : now,
      checkinUrl,
    });

    // Update checkinUrl with actual event ID
    await ref.update({ checkinUrl: `/checkin/${complexId}/space/${spaceId}?event=${ref.id}` });

    return NextResponse.json({ ok: true, eventId: ref.id });
  } catch (err) {
    console.error('[SpaceEvents POST]', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { eventId, spaceId, complexId, status, userId, ...updates } = body;

    if (!eventId || !spaceId) {
      return NextResponse.json({ ok: false, error: 'eventId and spaceId are required' }, { status: 400 });
    }

    const { checkPermission } = await import('@/lib/fga');
    if (userId) {
      const allowed = await checkPermission(userId, 'space_admin', 'space', spaceId);
      if (!allowed) {
        return NextResponse.json({ ok: false, error: 'Only space_admin can update events' }, { status: 403 });
      }
    }

    const now = Date.now();

    await adminFirestore.collection('space_events').doc(eventId).update({
      ...updates,
      ...(status && { status }),
      updatedAt: now,
    });

    if (status === 'live' && complexId) {
      // Mark this space as hosting the event
      await adminFirestore
        .collection('venue_complexes')
        .doc(complexId)
        .collection('spaces')
        .doc(spaceId)
        .update({ currentEventId: eventId });

      // Write event metadata to RTDB crowd slot
      await adminDb.ref(`complex_crowd/${complexId}/spaces/${spaceId}/eventId`).set(eventId);
      await adminDb.ref(`complex_crowd/${complexId}/spaces/${spaceId}/orgId`).set(updates.orgId ?? '');
    }

    if (status === 'ended' && complexId) {
      // Clear currentEventId from space
      await adminFirestore
        .collection('venue_complexes')
        .doc(complexId)
        .collection('spaces')
        .doc(spaceId)
        .update({ currentEventId: null });

      await adminDb.ref(`complex_crowd/${complexId}/spaces/${spaceId}/eventId`).remove();
    }

    return NextResponse.json({ ok: true, eventId, status });
  } catch (err) {
    console.error('[SpaceEvents PATCH]', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
