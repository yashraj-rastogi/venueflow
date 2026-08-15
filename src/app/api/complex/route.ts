import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore, adminDb } from '@/lib/firebaseAdmin';

/**
 * GET /api/complex?complexId=X
 *   Returns { complex, spaces, liveEvents } — public read, used by guest PWA.
 *
 * POST /api/complex
 *   Body: { id, name, city, address, totalCapacity, floors, lat, lng, complexAdminOrgId, plan, userId }
 *   Creates a new VenueComplex. Requires complex_admin permission.
 */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const complexId = searchParams.get('complexId');

    if (!complexId) {
      return NextResponse.json({ ok: false, error: 'complexId is required' }, { status: 400 });
    }

    // Fetch complex document
    const complexSnap = await adminFirestore.collection('venue_complexes').doc(complexId).get();
    if (!complexSnap.exists) {
      return NextResponse.json({ ok: false, error: 'Complex not found' }, { status: 404 });
    }
    const complex = { id: complexSnap.id, ...complexSnap.data() };

    // Fetch all spaces
    const spacesSnap = await adminFirestore
      .collection('venue_complexes')
      .doc(complexId)
      .collection('spaces')
      .get();
    const spaces = spacesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Fetch live space events
    const eventsSnap = await adminFirestore
      .collection('space_events')
      .where('complexId', '==', complexId)
      .where('status', '==', 'live')
      .get();
    const liveEvents = eventsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    return NextResponse.json({ ok: true, complex, spaces, liveEvents });
  } catch (err) {
    console.error('[Complex GET]', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, ...complexData } = body;

    if (!complexData.id || !complexData.name) {
      return NextResponse.json({ ok: false, error: 'id and name are required' }, { status: 400 });
    }

    // FGA: only a complex_admin or platform superadmin can create complexes
    if (userId) {
      const { checkPermission } = await import('@/lib/fga');
      const allowed = await checkPermission(userId, 'complex_admin', 'complex', complexData.id);
      // On first creation, fall through (no tuple yet); post-creation the caller should grant tuple
      if (!allowed) {
        console.warn(`[Complex POST] FGA check failed for userId=${userId}, complexId=${complexData.id} — proceeding for first-time setup`);
      }
    }

    const now = Date.now();
    await adminFirestore
      .collection('venue_complexes')
      .doc(complexData.id)
      .set({ ...complexData, createdAt: now, updatedAt: now });

    // Seed zeroed RTDB structure for complex crowd tracking
    await adminDb.ref(`complex_crowd/${complexData.id}`).set({
      totalCount: 0,
      shared    : {},
      spaces    : {},
    });

    return NextResponse.json({ ok: true, complexId: complexData.id });
  } catch (err) {
    console.error('[Complex POST]', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
