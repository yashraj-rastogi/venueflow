/**
 * firestore.ts — Firestore client + typed collection helpers
 *
 * Architecture:
 *   - Firebase RTDB  → real-time crowd counters (low-latency pub/sub)
 *   - Firestore      → persistent data (orgs, venues, events, staff, incidents)
 *
 * IMPORTANT: This module is imported by both client and server components.
 * On the server (API routes), use firebase-admin for privileged access.
 * On the client, use the regular Firebase SDK.
 */
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc,
  updateDoc, deleteDoc, query, where, orderBy, limit, onSnapshot,
  serverTimestamp, Timestamp, DocumentData, QueryConstraint,
  writeBatch, arrayUnion, collectionGroup,
} from 'firebase/firestore';
import { app } from '@/lib/firebase';
import {
  Organization, StaffMember, VenueEvent, Incident,
  GuestSession, Venue, StaffRole,
  VenueComplex, VenueSpace, SpaceEvent, AnalyticsSnapshot,
} from '@/types';
import { SAMPLE_COMPLEX, SAMPLE_SPACES, SAMPLE_SPACE_EVENTS } from '@/lib/sampleData';

export const db = getFirestore(app);

// ── Collection references ─────────────────────────────────────────────────────

export const orgsCol      = () => collection(db, 'organizations');
export const venuesCol    = (orgId: string) => collection(db, `organizations/${orgId}/venues`);
export const staffCol     = (orgId: string, venueId: string) =>
  collection(db, `organizations/${orgId}/venues/${venueId}/staff`);
export const eventsCol    = () => collection(db, 'events');
export const incidentsCol = () => collection(db, 'incidents');
export const guestsCol    = () => collection(db, 'guest_sessions');
export const snapshotsCol = (venueId: string) =>
  collection(db, `crowd_snapshots/${venueId}/snapshots`);

// ── Venue Complex collection references (v2) ──────────────────────────────────
export const complexesCol   = () => collection(db, 'venue_complexes');
export const spacesCol      = (complexId: string) =>
  collection(db, `venue_complexes/${complexId}/spaces`);
export const spaceStaffCol  = (complexId: string, spaceId: string) =>
  collection(db, `venue_complexes/${complexId}/spaces/${spaceId}/staff`);
export const spaceEventsCol = () => collection(db, 'space_events');
export const pushTokensCol  = (orgId: string, venueId: string) =>
  collection(db, `organizations/${orgId}/venues/${venueId}/push_tokens`);
export const analyticsCol   = (venueId: string) =>
  collection(db, `analytics/${venueId}/snapshots`);

// ── Organization helpers ──────────────────────────────────────────────────────

export async function getOrganization(orgId: string): Promise<Organization | null> {
  const snap = await getDoc(doc(db, 'organizations', orgId));
  return snap.exists() ? { id: snap.id, ...snap.data() } as Organization : null;
}

export async function createOrganization(data: Omit<Organization, 'id' | 'createdAt' | 'venueIds'>): Promise<string> {
  const ref = doc(orgsCol(), data.slug);
  await setDoc(ref, { ...data, createdAt: Date.now(), venueIds: [], plan: 'starter' });
  return ref.id;
}

export async function updateOrganization(orgId: string, data: Partial<Organization>): Promise<void> {
  await updateDoc(doc(db, 'organizations', orgId), data as DocumentData);
}

// ── Venue helpers ─────────────────────────────────────────────────────────────

export async function getOrgVenues(orgId: string): Promise<Venue[]> {
  const snaps = await getDocs(venuesCol(orgId));
  return snaps.docs.map(d => ({ id: d.id, ...d.data() }) as Venue);
}

export async function getVenueById(venueId: string): Promise<Venue | null> {
  try {
    const snaps = await getDocs(collectionGroup(db, 'venues'));
    const docSnap = snaps.docs.find(d => d.id === venueId);
    if (docSnap && docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Venue;
    }
  } catch (err: unknown) {
    // Quietly ignore permission restrictions on unauthenticated client-side collectionGroup queries
    const code = (err as { code?: string })?.code;
    if (code !== 'permission-denied' && code !== 'resource-exhausted') {
      console.debug('[firestore] getVenueById fallback:', err);
    }
  }
  return null;
}

export async function createVenueInOrg(orgId: string, venueData: Omit<Venue, 'id'>): Promise<string> {
  const ref  = await addDoc(venuesCol(orgId), venueData);
  // Append the new venueId to the org's venueIds array atomically
  await updateDoc(doc(db, 'organizations', orgId), {
    venueIds: arrayUnion(ref.id),
  });
  return ref.id;
}

// ── Staff helpers ─────────────────────────────────────────────────────────────

export async function getVenueStaff(orgId: string, venueId: string): Promise<StaffMember[]> {
  const snaps = await getDocs(staffCol(orgId, venueId));
  return snaps.docs.map(d => ({ uid: d.id, ...d.data() }) as StaffMember);
}

export async function upsertStaffMember(
  orgId: string, venueId: string, member: StaffMember,
): Promise<void> {
  await setDoc(doc(staffCol(orgId, venueId), member.uid), member, { merge: true });
}

export async function getStaffRole(orgId: string, venueId: string, uid: string): Promise<StaffRole | null> {
  const snap = await getDoc(doc(staffCol(orgId, venueId), uid));
  return snap.exists() ? (snap.data().role as StaffRole) : null;
}

// ── Event helpers ─────────────────────────────────────────────────────────────

export async function getVenueEvents(venueId: string, statusFilter?: VenueEvent['status']): Promise<VenueEvent[]> {
  const constraints: QueryConstraint[] = [where('venueId', '==', venueId), limit(25)];
  if (statusFilter) constraints.push(where('status', '==', statusFilter));
  const snaps = await getDocs(query(eventsCol(), ...constraints));
  const list  = snaps.docs.map(d => ({ id: d.id, ...d.data() }) as VenueEvent);
  return list.sort((a, b) => (b.date ?? 0) - (a.date ?? 0));
}

export async function createEvent(data: Omit<VenueEvent, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(eventsCol(), { ...data, createdAt: Date.now() });
  return ref.id;
}

export async function updateEvent(eventId: string, data: Partial<VenueEvent>): Promise<void> {
  await updateDoc(doc(eventsCol(), eventId), data as DocumentData);
}

export function subscribeToLiveEvent(
  venueId: string,
  callback: (event: VenueEvent | null) => void,
): () => void {
  const q = query(eventsCol(), where('venueId', '==', venueId), where('status', '==', 'live'), limit(1));
  return onSnapshot(q, snap => {
    if (snap.empty) { callback(null); return; }
    callback({ id: snap.docs[0].id, ...snap.docs[0].data() } as VenueEvent);
  });
}

// ── Incident helpers ──────────────────────────────────────────────────────────

export async function createIncident(data: Omit<Incident, 'id'>): Promise<string> {
  const ref = await addDoc(incidentsCol(), data);
  return ref.id;
}

export async function getOpenIncidents(venueId: string): Promise<Incident[]> {
  const q = query(incidentsCol(), where('venueId', '==', venueId), where('status', '!=', 'resolved'), orderBy('status'), orderBy('reportedAt', 'desc'));
  const snaps = await getDocs(q);
  return snaps.docs.map(d => ({ id: d.id, ...d.data() }) as Incident);
}

export async function resolveIncident(incidentId: string): Promise<void> {
  await updateDoc(doc(incidentsCol(), incidentId), { status: 'resolved', resolvedAt: Date.now() });
}

export function subscribeToIncidents(
  venueId: string,
  callback: (incidents: Incident[]) => void,
): () => void {
  const q = query(incidentsCol(), where('venueId', '==', venueId), where('status', '!=', 'resolved'), orderBy('status'), orderBy('reportedAt', 'desc'), limit(20));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Incident));
  });
}

// ── Guest session helpers ─────────────────────────────────────────────────────

export async function createGuestSession(data: Omit<GuestSession, 'id'>): Promise<string> {
  const ref = await addDoc(guestsCol(), data);
  return ref.id;
}

export async function getActiveGuestCount(venueId: string): Promise<number> {
  const fiveMinsAgo = Date.now() - 5 * 60 * 1000;
  const q = query(guestsCol(), where('venueId', '==', venueId), where('lastSeenAt', '>', fiveMinsAgo));
  const snaps = await getDocs(q);
  return snaps.size;
}

// ── Crowd snapshot helpers ────────────────────────────────────────────────────

export async function saveCrowdSnapshot(venueId: string, snapshot: Record<string, unknown>): Promise<void> {
  await addDoc(snapshotsCol(venueId), { ...snapshot, savedAt: Date.now() });
}

export async function getCrowdHistory(venueId: string, limitN = 48): Promise<DocumentData[]> {
  const q = query(snapshotsCol(venueId), orderBy('savedAt', 'desc'), limit(limitN));
  const snaps = await getDocs(q);
  return snaps.docs.map(d => d.data());
}

// ── Event additional helpers ──────────────────────────────────────────────────

export async function getLiveEvent(venueId: string): Promise<VenueEvent | null> {
  const q = query(eventsCol(), where('venueId', '==', venueId), where('status', '==', 'live'), limit(1));
  const snaps = await getDocs(q);
  if (snaps.empty) return null;
  return { id: snaps.docs[0].id, ...snaps.docs[0].data() } as VenueEvent;
}

export function subscribeToVenueEvents(
  venueId: string,
  callback: (events: VenueEvent[]) => void,
): () => void {
  const q = query(eventsCol(), where('venueId', '==', venueId));
  return onSnapshot(q, snap => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }) as VenueEvent);
    list.sort((a, b) => (b.date ?? 0) - (a.date ?? 0));
    callback(list);
  });
}

// ── Guest session update helper ───────────────────────────────────────────────

export async function updateGuestSession(sessionId: string, data: Partial<GuestSession>): Promise<void> {
  await updateDoc(doc(db, 'guest_sessions', sessionId), data as DocumentData);
}

// ═══════════════════════════════════════════════════════════════════════════════
// VENUE COMPLEX HELPERS (v2)
// ═══════════════════════════════════════════════════════════════════════════════

// ── VenueComplex CRUD ─────────────────────────────────────────────────────────

export async function getComplex(complexId: string): Promise<VenueComplex | null> {
  try {
    const snap = await getDoc(doc(db, 'venue_complexes', complexId));
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as VenueComplex;
    }
  } catch (err) {
    console.debug('[firestore] getComplex fallback:', err);
  }
  if (complexId === 'bharat-mandap' || complexId === SAMPLE_COMPLEX.id) {
    return SAMPLE_COMPLEX;
  }
  return null;
}

export async function createComplex(data: Omit<VenueComplex, 'id'>): Promise<string> {
  // Use the slug-style id from the data (caller provides it via `data` cast)
  const ref = doc(complexesCol(), (data as VenueComplex & { id: string }).id ?? 'complex');
  await setDoc(ref, { ...data, createdAt: Date.now() });
  return ref.id;
}

export async function updateComplex(complexId: string, data: Partial<VenueComplex>): Promise<void> {
  await updateDoc(doc(db, 'venue_complexes', complexId), data as DocumentData);
}

// ── VenueSpace CRUD ───────────────────────────────────────────────────────────

export async function getComplexSpaces(complexId: string): Promise<VenueSpace[]> {
  try {
    const snaps = await getDocs(spacesCol(complexId));
    if (!snaps.empty) {
      return snaps.docs.map(d => ({ id: d.id, ...d.data() }) as VenueSpace);
    }
  } catch (err) {
    console.debug('[firestore] getComplexSpaces fallback:', err);
  }
  if (complexId === 'bharat-mandap') {
    return SAMPLE_SPACES;
  }
  return [];
}

export async function getSpace(complexId: string, spaceId: string): Promise<VenueSpace | null> {
  try {
    const snap = await getDoc(doc(db, `venue_complexes/${complexId}/spaces`, spaceId));
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as VenueSpace;
    }
  } catch (err) {
    console.debug('[firestore] getSpace fallback:', err);
  }
  if (complexId === 'bharat-mandap') {
    return SAMPLE_SPACES.find(s => s.id === spaceId) ?? null;
  }
  return null;
}

export async function createSpace(complexId: string, data: Omit<VenueSpace, 'id'> & { id?: string }): Promise<string> {
  if (data.id) {
    await setDoc(doc(spacesCol(complexId), data.id), data);
    return data.id;
  }
  const ref = await addDoc(spacesCol(complexId), data);
  return ref.id;
}

export async function updateSpace(complexId: string, spaceId: string, data: Partial<VenueSpace>): Promise<void> {
  await updateDoc(doc(db, `venue_complexes/${complexId}/spaces`, spaceId), data as DocumentData);
}

export function subscribeToComplexSpaces(
  complexId: string,
  callback: (spaces: VenueSpace[]) => void,
): () => void {
  try {
    return onSnapshot(spacesCol(complexId), snap => {
      if (!snap.empty) {
        callback(snap.docs.map(d => ({ id: d.id, ...d.data() }) as VenueSpace));
      } else if (complexId === 'bharat-mandap') {
        callback(SAMPLE_SPACES);
      } else {
        callback([]);
      }
    }, (err) => {
      console.debug('[firestore] subscribeToComplexSpaces fallback:', err);
      if (complexId === 'bharat-mandap') callback(SAMPLE_SPACES);
    });
  } catch {
    if (complexId === 'bharat-mandap') callback(SAMPLE_SPACES);
    return () => {};
  }
}

// ── SpaceEvent CRUD ───────────────────────────────────────────────────────────

export async function getSpaceEvents(complexId: string, spaceId?: string): Promise<SpaceEvent[]> {
  try {
    const constraints: QueryConstraint[] = [where('complexId', '==', complexId), limit(50)];
    if (spaceId) constraints.push(where('spaceId', '==', spaceId));
    const snaps = await getDocs(query(spaceEventsCol(), ...constraints));
    if (!snaps.empty) {
      const list  = snaps.docs.map(d => ({ id: d.id, ...d.data() }) as SpaceEvent);
      return list.sort((a, b) => (b.date ?? 0) - (a.date ?? 0));
    }
  } catch (err) {
    console.debug('[firestore] getSpaceEvents fallback:', err);
  }
  if (complexId === 'bharat-mandap') {
    return SAMPLE_SPACE_EVENTS.filter(e => e.complexId === complexId && (!spaceId || e.spaceId === spaceId));
  }
  return [];
}

export async function createSpaceEvent(data: Omit<SpaceEvent, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(spaceEventsCol(), { ...data, createdAt: Date.now() });
  return ref.id;
}

export async function updateSpaceEvent(eventId: string, data: Partial<SpaceEvent>): Promise<void> {
  await updateDoc(doc(spaceEventsCol(), eventId), data as DocumentData);
}

export function subscribeToLiveSpaceEvents(
  complexId: string,
  callback: (events: SpaceEvent[]) => void,
): () => void {
  try {
    const q = query(spaceEventsCol(), where('complexId', '==', complexId), where('status', '==', 'live'));
    return onSnapshot(q, snap => {
      if (!snap.empty) {
        callback(snap.docs.map(d => ({ id: d.id, ...d.data() }) as SpaceEvent));
      } else if (complexId === 'bharat-mandap') {
        callback(SAMPLE_SPACE_EVENTS.filter(e => e.status === 'live'));
      } else {
        callback([]);
      }
    }, (err) => {
      console.debug('[firestore] subscribeToLiveSpaceEvents fallback:', err);
      if (complexId === 'bharat-mandap') callback(SAMPLE_SPACE_EVENTS.filter(e => e.status === 'live'));
    });
  } catch {
    if (complexId === 'bharat-mandap') callback(SAMPLE_SPACE_EVENTS.filter(e => e.status === 'live'));
    return () => {};
  }
}

// ── Guest Session TTL Cleanup (Privacy — v2) ──────────────────────────────────

/**
 * Returns guest sessions that have passed their expiresAt TTL.
 * Called by POST /api/sessions/cleanup (triggered by Cloud Scheduler every 6h).
 */
export async function getExpiredGuestSessions(nowMs: number = Date.now()): Promise<GuestSession[]> {
  const q = query(guestsCol(), where('expiresAt', '<', nowMs), limit(500));
  const snaps = await getDocs(q);
  return snaps.docs.map(d => ({ id: d.id, ...d.data() }) as GuestSession);
}

/** Batch-deletes expired sessions. Uses Firestore batch writes (max 500 per batch). */
export async function deleteGuestSessions(sessionIds: string[]): Promise<void> {
  if (sessionIds.length === 0) return;
  const batch = writeBatch(db);
  sessionIds.forEach(id => batch.delete(doc(guestsCol(), id)));
  await batch.commit();
}

// ── Analytics Snapshots (Track B) ────────────────────────────────────────────

export async function saveAnalyticsSnapshot(venueId: string, snap: AnalyticsSnapshot): Promise<void> {
  await addDoc(analyticsCol(venueId), { ...snap, savedAt: Date.now() });
}

export async function getAnalyticsHistory(venueId: string, limitN = 48): Promise<AnalyticsSnapshot[]> {
  const q = query(analyticsCol(venueId), orderBy('timestamp', 'desc'), limit(limitN));
  const snaps = await getDocs(q);
  return snaps.docs.map(d => d.data() as AnalyticsSnapshot);
}

