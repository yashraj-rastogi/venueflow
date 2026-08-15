import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebaseAdmin';

/**
 * POST /api/sessions/cleanup
 *
 * Deletes guest_sessions where expiresAt < Date.now().
 * Called by Cloud Scheduler every 6 hours.
 *
 * Cloud Scheduler setup (GCP console):
 *   Schedule: 0 *\/6 * * *   (every 6 hours)
 *   Target  : POST https://{domain}/api/sessions/cleanup
 *   Auth    : OIDC token (service account with invoker role)
 *
 * Returns: { ok, deleted, remaining } for monitoring.
 */
export async function POST(_req: NextRequest) {
  try {
    const now = Date.now();

    // Firestore cannot order by a field not in the inequality filter,
    // so we just use a simple where clause and batch delete.
    const snap = await adminFirestore
      .collection('guest_sessions')
      .where('expiresAt', '<', now)
      .limit(500)          // Firestore batch write limit
      .get();

    if (snap.empty) {
      return NextResponse.json({ ok: true, deleted: 0, message: 'No expired sessions found' });
    }

    const batch = adminFirestore.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    console.info(`[Sessions Cleanup] Deleted ${snap.size} expired sessions at ${new Date(now).toISOString()}`);

    return NextResponse.json({
      ok     : true,
      deleted: snap.size,
      message: `Deleted ${snap.size} expired sessions`,
    });
  } catch (err) {
    console.error('[Sessions Cleanup]', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
