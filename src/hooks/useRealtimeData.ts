'use client';
import { useEffect, useState, useCallback } from 'react';
import { listenToPath, pushToPath } from '@/lib/firebase';
import { CrowdSnapshot, Notification, Venue, Amenity } from '@/types';
import { SAMPLE_CROWD_SNAPSHOT, SAMPLE_NOTIFICATIONS, SAMPLE_VENUES } from '@/lib/sampleData';
import { getVenueById } from '@/lib/firestore';
import { ensureVenueSeeded } from '@/lib/seedFirebase';

// ─── Venue Data (from RTDB, seeded from sampleData) ───────────────────────────

/**
 * Real-time venue hook — reads from `venues/{venueId}` in RTDB.
 * Falls back to Firestore or sampleData if RTDB is unseeded.
 */
export function useVenueData(venueId: string) {
  const fallback = SAMPLE_VENUES.find(v => v.id === venueId) ?? {
    ...SAMPLE_VENUES[0],
    id: venueId,
    name: venueId,
  };
  const [venue, setVenue] = useState<Venue>(fallback);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    if (!venueId) return;
    let isMounted = true;

    // Fetch from Firestore if custom venue not in sample data
    if (!SAMPLE_VENUES.some(v => v.id === venueId)) {
      getVenueById(venueId).then(fsVenue => {
        if (fsVenue && isMounted) {
          setVenue(fsVenue);
          ensureVenueSeeded(venueId, fsVenue);
        }
      });
    }

    const unsub = listenToPath<{
      name: string;
      city: string;
      capacity: number;
      lat: number;
      lng: number;
      imageUrl?: string;
      zones?: Record<string, { name: string; capacity: number; coordinates: object[] }>;
      amenities?: Record<string, { name: string; type: string; location: object; section: string; capacity?: number }>;
      sections?: Record<string, { name: string; level: number; zones: string[] }>;
    }>(`venues/${venueId}`, (data) => {
      if (data) {
        // Rebuild Venue shape from RTDB record
        const zones = data.zones
          ? Object.entries(data.zones).map(([id, z]) => ({
              id,
              name: z.name,
              capacity: z.capacity,
              currentCount: 0, // populated by useCrowdData
              density: 0,      // populated by useCrowdData
              coordinates: (z.coordinates as { lat: number; lng: number }[]) ?? [],
            }))
          : fallback.zones;

        const amenities: Amenity[] = data.amenities
          ? Object.entries(data.amenities).map(([id, a]) => ({
              id,
              name: a.name,
              type: a.type as Amenity['type'],
              location: a.location as { lat: number; lng: number },
              section: a.section,
              capacity: a.capacity,
              // wait-time fields seeded via useWaitTimes
              waitTime: 0,
              predictedWaitTime: 0,
              trend: 'stable' as const,
              isOpen: true,
            }))
          : fallback.amenities;

        const sections = data.sections
          ? Object.entries(data.sections).map(([id, s]) => ({
              id,
              name: s.name,
              level: s.level,
              zones: s.zones ?? [],
            }))
          : fallback.sections;

        if (isMounted) {
          setVenue({
            id: venueId,
            name: data.name ?? fallback.name,
            city: data.city ?? fallback.city,
            capacity: data.capacity ?? fallback.capacity,
            lat: data.lat ?? fallback.lat,
            lng: data.lng ?? fallback.lng,
            imageUrl: data.imageUrl ?? fallback.imageUrl,
            zones,
            amenities,
            sections,
          });
          setIsLive(true);
        }
      }
      if (isMounted) setLoading(false);
    });
    return () => {
      isMounted = false;
      unsub();
    };
  }, [venueId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { venue, loading, isLive };
}

// ─── All Venues List (for home page aggregate stats) ──────────────────────────

export function useAllVenues() {
  const [venues, setVenues] = useState<Venue[]>(SAMPLE_VENUES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen to each known venue in RTDB
    const unsubs = SAMPLE_VENUES.map((sv, idx) =>
      listenToPath<{ name: string; capacity: number; city: string }>(`venues/${sv.id}`, (data) => {
        if (data) {
          setVenues(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], name: data.name ?? sv.name, capacity: data.capacity ?? sv.capacity, city: data.city ?? sv.city };
            return next;
          });
        }
        if (idx === SAMPLE_VENUES.length - 1) setLoading(false);
      })
    );
    return () => unsubs.forEach(u => u());
  }, []);

  return { venues, loading };
}

// ─── Crowd Data ────────────────────────────────────────────────────────────────

/** Build a zeroed CrowdSnapshot for a venue so new venues show 0 guests by default */
function makeEmptyCrowd(venueId: string): CrowdSnapshot {
  return { timestamp: Date.now(), venueId, totalCount: 0, zones: {} };
}

export function useCrowdData(venueId: string) {
  // Start with empty (zeroed) crowd — never leak MetLife sample data into other venues
  const [crowd, setCrowd] = useState<CrowdSnapshot>(() =>
    venueId === 'metlife-stadium' ? SAMPLE_CROWD_SNAPSHOT : makeEmptyCrowd(venueId)
  );
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    if (!venueId) return;
    // Reset to empty state for the new venueId before subscribing
    setCrowd(venueId === 'metlife-stadium' ? SAMPLE_CROWD_SNAPSHOT : makeEmptyCrowd(venueId));
    setIsLive(false);
    setLoading(true);

    const unsub = listenToPath<CrowdSnapshot>(`crowd_data/${venueId}`, (data) => {
      if (data) {
        setCrowd(data);
        setIsLive(true);
      }
      setLoading(false);
    });
    return unsub;
  }, [venueId]);

  // Trigger a crowd simulation update via API
  const triggerUpdate = useCallback(async () => {
    await fetch('/api/crowd/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ venueId }),
    }).catch(() => {});
  }, [venueId]);

  return { crowd, loading, isLive, triggerUpdate };
}

// ─── Wait Times ────────────────────────────────────────────────────────────────

export function useWaitTimes(venueId: string) {
  // Only use MetLife sample amenities for the demo venue; others start zeroed
  const isSample = SAMPLE_VENUES.some(v => v.id === venueId);
  const sampleAmenities = isSample
    ? (SAMPLE_VENUES.find(v => v.id === venueId) ?? SAMPLE_VENUES[0]).amenities
    : [];
  const [amenities, setAmenities] = useState(sampleAmenities);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!venueId) return;
    setLoading(true);
    const unsub = listenToPath<Record<string, { waitTime: number; predictedWaitTime: number; trend: string; isOpen: boolean }>>(
      `wait_times/${venueId}`,
      (data) => {
        if (data) {
          setAmenities(prev => {
            // For known amenities: merge live wait data
            if (prev.length > 0) {
              return prev.map(a => {
                const live = data[a.id];
                if (!live) return a;
                return {
                  ...a,
                  waitTime: live.waitTime ?? 0,
                  predictedWaitTime: live.predictedWaitTime ?? 0,
                  trend: (live.trend as 'increasing' | 'stable' | 'decreasing') ?? 'stable',
                  isOpen: live.isOpen ?? true,
                };
              });
            }
            // For venues with no local amenity list yet (custom venues), build from RTDB
            return Object.entries(data).map(([id, a]) => ({
              id,
              name: id,
              type: 'concession' as const,
              location: { lat: 0, lng: 0 },
              section: '',
              waitTime: a.waitTime ?? 0,
              predictedWaitTime: a.predictedWaitTime ?? 0,
              trend: (a.trend as 'increasing' | 'stable' | 'decreasing') ?? 'stable',
              isOpen: a.isOpen ?? true,
            }));
          });
        }
        setLoading(false);
      }
    );
    return unsub;
  }, [venueId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { amenities, loading };
}

// ─── Notifications ─────────────────────────────────────────────────────────────

export function useNotifications(venueId: string) {
  const isSample = venueId === 'metlife-stadium';
  const initial  = isSample ? SAMPLE_NOTIFICATIONS : [];
  const [notifications, setNotifications] = useState<Notification[]>(initial);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!venueId) return;
    const unsub = listenToPath<Record<string, Notification>>(
      `notifications/${venueId}`,
      (data) => {
        if (data) {
          const list = Object.values(data).sort((a, b) => b.timestamp - a.timestamp);
          setNotifications(list);
        } else {
          setNotifications(isSample ? SAMPLE_NOTIFICATIONS : []);
        }
        setLoading(false);
      }
    );
    return unsub;
  }, [venueId, isSample]);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return { notifications, loading, unreadCount, markAllRead };
}
