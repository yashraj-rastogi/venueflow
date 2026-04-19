/**
 * seedFirebase.ts — Hydrates Firebase RTDB with venue data on first run.
 * Reads from RTDB first; only writes if the key doesn't exist.
 * This ensures the app always has real data in Firebase without overwriting live updates.
 */
import { ref, get, set } from 'firebase/database';
import { db } from '@/lib/firebase';
import { SAMPLE_VENUES } from '@/lib/sampleData';

/** Check if a path exists in RTDB */
async function pathExists(path: string): Promise<boolean> {
  try {
    const snap = await get(ref(db, path));
    return snap.exists();
  } catch {
    return false;
  }
}

/**
 * Ensure venue static data is seeded in RTDB.
 * Call this once per venue page load.
 */
export async function ensureVenueSeeded(venueId: string): Promise<void> {
  try {
    // Only seed if venue doesn't already exist in RTDB
    const exists = await pathExists(`venues/${venueId}`);
    if (exists) return;

    const venue = SAMPLE_VENUES.find(v => v.id === venueId);
    if (!venue) return;

    // Write venue metadata (static shape) — zones/amenities as objects
    const zonesObj: Record<string, object> = {};
    for (const z of venue.zones) {
      zonesObj[z.id] = {
        name: z.name,
        capacity: z.capacity,
        coordinates: z.coordinates,
      };
    }

    const amenitiesObj: Record<string, object> = {};
    for (const a of venue.amenities) {
      amenitiesObj[a.id] = {
        name: a.name,
        type: a.type,
        location: a.location,
        section: a.section,
        capacity: a.capacity ?? null,
      };
    }

    const sectionsObj: Record<string, object> = {};
    for (const s of venue.sections) {
      sectionsObj[s.id] = {
        name: s.name,
        level: s.level,
        zones: s.zones,
      };
    }

    await set(ref(db, `venues/${venueId}`), {
      name: venue.name,
      city: venue.city,
      capacity: venue.capacity,
      lat: venue.lat,
      lng: venue.lng,
      imageUrl: venue.imageUrl ?? null,
      zones: zonesObj,
      amenities: amenitiesObj,
      sections: sectionsObj,
    });

    // Seed initial crowd data
    const crowdZones: Record<string, object> = {};
    for (const z of venue.zones) {
      crowdZones[z.id] = {
        density: z.density,
        count: z.currentCount,
        capacity: z.capacity,
      };
    }
    await set(ref(db, `crowd_data/${venueId}`), {
      timestamp: Date.now(),
      venueId,
      totalCount: venue.zones.reduce((s, z) => s + z.currentCount, 0),
      zones: crowdZones,
    });

    // Seed initial wait times
    const waitObj: Record<string, object> = {};
    for (const a of venue.amenities) {
      waitObj[a.id] = {
        waitTime: a.waitTime,
        predictedWaitTime: a.predictedWaitTime,
        trend: a.trend,
        isOpen: a.isOpen,
      };
    }
    await set(ref(db, `wait_times/${venueId}`), waitObj);

    console.info(`[VenueFlow] Seeded ${venueId} to Firebase RTDB ✓`);
  } catch (err) {
    // Non-fatal — app falls back to local sample data gracefully
    console.warn('[VenueFlow] Seed failed (RTDB not configured?):', err);
  }
}

/**
 * Seed all venues at once (called from home page).
 */
export async function ensureAllVenuesSeeded(): Promise<void> {
  await Promise.all(SAMPLE_VENUES.map(v => ensureVenueSeeded(v.id)));
}
