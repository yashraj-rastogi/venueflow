import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebaseAdmin';
import type { AnalyticsSnapshot } from '@/types';

/**
 * POST /api/analytics/snapshot
 * Body: { venueId: string, snapshot: AnalyticsSnapshot }
 *
 * Persists a crowd analytics snapshot to Firestore.
 * Called internally by the crowd simulation engine every 5 minutes during a live event.
 * This builds the historical dataset that powers post-event reports.
 *
 * No auth check — this is an internal server-to-server call.
 * In production, restrict via Cloud Armor or an internal CIDR rule.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { venueId, snapshot } = body as { venueId: string; snapshot: AnalyticsSnapshot };

    if (!venueId || !snapshot) {
      return NextResponse.json({ ok: false, error: 'venueId and snapshot are required' }, { status: 400 });
    }

    const docRef = await adminFirestore
      .collection('analytics')
      .doc(venueId)
      .collection('snapshots')
      .add({ ...snapshot, savedAt: Date.now() });

    return NextResponse.json({ ok: true, docId: docRef.id });
  } catch (err) {
    console.error('[Analytics Snapshot]', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

/**
 * GET /api/analytics/snapshot?venueId=X&limit=48
 * Returns the most recent N snapshots for historical analytics charts.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const venueId = searchParams.get('venueId');
    const limitN  = parseInt(searchParams.get('limit') ?? '48', 10);

    if (!venueId) {
      return NextResponse.json({ ok: false, error: 'venueId is required' }, { status: 400 });
    }

    const snap = await adminFirestore
      .collection('analytics')
      .doc(venueId)
      .collection('snapshots')
      .orderBy('timestamp', 'desc')
      .limit(limitN)
      .get();

    const snapshots = snap.docs.map(d => d.data() as AnalyticsSnapshot);

    return NextResponse.json({ ok: true, snapshots });
  } catch (err) {
    console.error('[Analytics Snapshot GET]', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
