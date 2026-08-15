/**
 * firebaseAdmin.ts — server-only Firebase Admin SDK
 *
 * Used by API routes and server-side simulation to write to Realtime Database
 * and Firestore with privileged access. The Admin SDK bypasses security rules,
 * so rules can stay locked while trusted server API routes still write freely.
 *
 * NEVER import this from a client component.
 */
import { initializeApp, getApps, cert, applicationDefault, App } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';

const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;

function resolveCredential() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (raw && raw.trim()) {
    try {
      return cert(JSON.parse(raw.trim()));
    } catch (e) {
      console.warn('[firebaseAdmin] Could not parse FIREBASE_SERVICE_ACCOUNT_KEY:', e);
    }
  }
  return applicationDefault();
}

function getAdminApp(): App {
  const ADMIN_APP_NAME = 'admin';
  const existing = getApps().find(a => a.name === ADMIN_APP_NAME);
  if (existing) return existing;
  return initializeApp(
    { credential: resolveCredential(), databaseURL },
    ADMIN_APP_NAME,
  );
}

export const adminDb        = getDatabase(getAdminApp());
export const adminFirestore = getFirestore(getAdminApp());
export const adminAuth      = getAuth(getAdminApp());
export const adminMessaging = getMessaging(getAdminApp());

// ─── Database helpers (privileged, rule-bypassing) ──────────────────────────────

export function writePath(path: string, data: unknown): Promise<void> {
  return adminDb.ref(path).set(data);
}

export function pushToPath(path: string, data: unknown): Promise<unknown> {
  return adminDb.ref(path).push(data) as unknown as Promise<unknown>;
}

// ─── Firestore Admin helpers ──────────────────────────────────────────────────

export async function adminCreateVenueInOrg(
  orgId: string,
  venueId: string,
  venueData: Record<string, unknown>,
): Promise<void> {
  const venueRef = adminFirestore.doc(`organizations/${orgId}/venues/${venueId}`);
  await venueRef.set(venueData, { merge: true });

  const orgRef = adminFirestore.doc(`organizations/${orgId}`);
  await orgRef.set({
    venueIds: FieldValue.arrayUnion(venueId),
  }, { merge: true });
}

export function deletePath(path: string): Promise<void> {
  return adminDb.ref(path).remove();
}

/**
 * Permanently deletes a venue from:
 *  - Firestore:  organizations/{orgId}/venues/{venueId}
 *  - Firestore:  org document venueIds array
 *  - RTDB:       venues/{venueId}, crowd_data/{venueId}, wait_times/{venueId}, notifications/{venueId}
 */
export async function adminDeleteVenue(orgId: string, venueId: string): Promise<void> {
  // 1. Remove Firestore venue doc
  await adminFirestore.doc(`organizations/${orgId}/venues/${venueId}`).delete();

  // 2. Remove venueId from org's venueIds array
  await adminFirestore.doc(`organizations/${orgId}`).update({
    venueIds: FieldValue.arrayRemove(venueId),
  });

  // 3. Clean up all RTDB paths for this venue
  await Promise.all([
    deletePath(`venues/${venueId}`),
    deletePath(`crowd_data/${venueId}`),
    deletePath(`wait_times/${venueId}`),
    deletePath(`notifications/${venueId}`),
    deletePath(`events/${venueId}`),
  ]);
}
