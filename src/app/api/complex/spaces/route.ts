import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore, adminDb } from '@/lib/firebaseAdmin';

/**
 * POST /api/complex/spaces
 *   Body: { complexId, spaceData: Omit<VenueSpace, 'id'> & { id?: string }, userId }
 *   Creates a new VenueSpace within a VenueComplex.
 *
 * PATCH /api/complex/spaces
 *   Body: { complexId, spaceId, updates: Partial<VenueSpace>, userId }
 *   Updates a VenueSpace (e.g. sets currentEventId when a SpaceEvent goes live).
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { complexId, spaceData, userId } = body;

    if (!complexId || !spaceData?.name) {
      return NextResponse.json({ ok: false, error: 'complexId and spaceData.name are required' }, { status: 400 });
    }

    const { checkPermission } = await import('@/lib/fga');
    if (userId) {
      const allowed = await checkPermission(userId, 'complex_admin', 'complex', complexId);
      if (!allowed) {
        return NextResponse.json({ ok: false, error: 'Only complex_admin can create spaces' }, { status: 403 });
      }
    }

    const spacesCol = adminFirestore
      .collection('venue_complexes')
      .doc(complexId)
      .collection('spaces');

    let spaceId: string;
    if (spaceData.id) {
      await spacesCol.doc(spaceData.id).set({ ...spaceData, createdAt: Date.now() });
      spaceId = spaceData.id;
    } else {
      const ref = await spacesCol.add({ ...spaceData, createdAt: Date.now() });
      spaceId = ref.id;
    }

    // Seed RTDB crowd slot for this space
    const crowdPath = spaceData.isShared
      ? `complex_crowd/${complexId}/shared/${spaceId}`
      : `complex_crowd/${complexId}/spaces/${spaceId}`;

    await adminDb.ref(crowdPath).set({
      density  : 0,
      count    : 0,
      capacity : spaceData.capacity ?? 0,
      status   : 'normal',
      spaceName: spaceData.name,
    });

    return NextResponse.json({ ok: true, spaceId });
  } catch (err) {
    console.error('[Complex Spaces POST]', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { complexId, spaceId, updates, userId } = body;

    if (!complexId || !spaceId || !updates) {
      return NextResponse.json({ ok: false, error: 'complexId, spaceId, and updates are required' }, { status: 400 });
    }

    const { checkPermission } = await import('@/lib/fga');
    if (userId) {
      const allowed = await checkPermission(userId, 'complex_admin', 'complex', complexId);
      if (!allowed) {
        return NextResponse.json({ ok: false, error: 'Only complex_admin can update spaces' }, { status: 403 });
      }
    }

    await adminFirestore
      .collection('venue_complexes')
      .doc(complexId)
      .collection('spaces')
      .doc(spaceId)
      .update({ ...updates, updatedAt: Date.now() });

    return NextResponse.json({ ok: true, spaceId });
  } catch (err) {
    console.error('[Complex Spaces PATCH]', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
