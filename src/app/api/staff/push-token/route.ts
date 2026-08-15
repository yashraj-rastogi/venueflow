import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminFirestore } from '@/lib/firebaseAdmin';

/**
 * POST /api/staff/push-token
 * Headers: Authorization: Bearer {Firebase ID token}
 * Body: { fcmToken: string, venueId: string, orgId: string, deviceHint?: string }
 *
 * Registers an FCM push token for an authenticated staff member.
 * Tokens are stored per-user so they are overwritten on re-registration
 * (handles device changes and token rotation automatically).
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ ok: false, error: 'Authorization header required' }, { status: 401 });
    }

    const idToken = authHeader.replace('Bearer ', '');
    let decodedToken: { uid: string };

    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid or expired ID token' }, { status: 401 });
    }

    const uid = decodedToken.uid;

    const body = await req.json();
    const { fcmToken, venueId, orgId, deviceHint } = body;

    if (!fcmToken || !venueId || !orgId) {
      return NextResponse.json({ ok: false, error: 'fcmToken, venueId, and orgId are required' }, { status: 400 });
    }

    // Store token under push_tokens/{uid} — overwrites old token for same device
    await adminFirestore
      .collection('organizations')
      .doc(orgId)
      .collection('venues')
      .doc(venueId)
      .collection('push_tokens')
      .doc(uid)
      .set({
        uid,
        venueId,
        orgId,
        fcmToken,
        registeredAt: Date.now(),
        deviceHint  : deviceHint ?? null,
      });

    return NextResponse.json({ ok: true, uid });
  } catch (err) {
    console.error('[Push Token]', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
