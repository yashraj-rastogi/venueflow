'use client';
import { useEffect, useState, useCallback } from 'react';
import { listenToPath, pushToPath } from '@/lib/firebase';
import { CrowdSnapshot, Notification, Venue, Amenity, SpaceCrowdSlice, GuestPositionTick } from '@/types';
import { SAMPLE_CROWD_SNAPSHOT, SAMPLE_NOTIFICATIONS, SAMPLE_VENUES, SAMPLE_COMPLEX_CROWD } from '@/lib/sampleData';
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
    name: venueId.replace(/-/g, ' ').toUpperCase(),
  };
  const [venue, setVenue] = useState<Venue>(fallback);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    if (!venueId) return;
    let isMounted = true;

    // 1. Fetch from server API endpoint (bypasses Firestore client permissions)
    fetch(`/api/venues?venueId=${encodeURIComponent(venueId)}`)
      .then(r => r.json())
      .then(res => {
        if (res.ok && res.venue && isMounted) {
          setVenue(res.venue);
          setIsLive(true);
        }
      })
      .catch(() => {});

    // 2. Fetch from Firestore fallback if custom venue
    if (!SAMPLE_VENUES.some(v => v.id === venueId)) {
      getVenueById(venueId).then(fsVenue => {
        if (fsVenue && isMounted) {
          setVenue(fsVenue);
          ensureVenueSeeded(venueId, fsVenue);
        }
      }).catch(() => {});
    }

    // 3. Listen to Realtime Database
    const unsub = listenToPath<{
      name: string;
      city: string;
      capacity: number;
      lat: number;
      lng: number;
      imageUrl?: string;
      zones?: any;
      amenities?: any;
      sections?: any;
    }>(`venues/${venueId}`, (data) => {
      if (data && isMounted) {
        // Safely parse zones whether stored as array or object
        let parsedZones = fallback.zones;
        if (data.zones) {
          if (Array.isArray(data.zones)) {
            parsedZones = data.zones.map((z, idx) => ({
              id: z.id || `zone-${idx}`,
              name: z.name || `Zone ${idx + 1}`,
              capacity: z.capacity || 10000,
              currentCount: 0,
              density: 0,
              coordinates: z.coordinates || [],
            }));
          } else if (typeof data.zones === 'object') {
            parsedZones = Object.entries(data.zones).map(([id, z]: [string, any]) => ({
              id: z.id || id,
              name: z.name || id,
              capacity: z.capacity || 10000,
              currentCount: 0,
              density: 0,
              coordinates: z.coordinates || [],
            }));
          }
        }

        // Safely parse amenities whether stored as array or object
        let parsedAmenities: Amenity[] = fallback.amenities;
        if (data.amenities) {
          if (Array.isArray(data.amenities)) {
            parsedAmenities = data.amenities.map((a, idx) => ({
              id: a.id || `amenity-${idx}`,
              name: a.name || `Amenity ${idx + 1}`,
              type: (a.type as Amenity['type']) || 'concession',
              location: a.location || { lat: data.lat || 0, lng: data.lng || 0 },
              section: a.section || '',
              capacity: a.capacity,
              waitTime: 0,
              predictedWaitTime: 0,
              trend: 'stable' as const,
              isOpen: true,
            }));
          } else if (typeof data.amenities === 'object') {
            parsedAmenities = Object.entries(data.amenities).map(([id, a]: [string, any]) => ({
              id: a.id || id,
              name: a.name || id,
              type: (a.type as Amenity['type']) || 'concession',
              location: a.location || { lat: data.lat || 0, lng: data.lng || 0 },
              section: a.section || '',
              capacity: a.capacity,
              waitTime: 0,
              predictedWaitTime: 0,
              trend: 'stable' as const,
              isOpen: true,
            }));
          }
        }

        // Safely parse sections
        let parsedSections = fallback.sections;
        if (data.sections) {
          if (Array.isArray(data.sections)) {
            parsedSections = data.sections;
          } else if (typeof data.sections === 'object') {
            parsedSections = Object.entries(data.sections).map(([id, s]: [string, any]) => ({
              id: s.id || id,
              name: s.name || id,
              level: s.level || 1,
              zones: s.zones || [],
            }));
          }
        }

        setVenue(prev => ({
          id: venueId,
          name: data.name ?? prev.name,
          city: data.city ?? prev.city,
          capacity: data.capacity ?? prev.capacity,
          lat: data.lat ?? prev.lat,
          lng: data.lng ?? prev.lng,
          imageUrl: data.imageUrl ?? prev.imageUrl,
          zones: parsedZones.length > 0 ? parsedZones : prev.zones,
          amenities: parsedAmenities.length > 0 ? parsedAmenities : prev.amenities,
          sections: parsedSections.length > 0 ? parsedSections : prev.sections,
        }));
        setIsLive(true);
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

// ─── All Venues List (for home page aggregate stats and checkin) ───────────────────

export function useAllVenues() {
  const [venues, setVenues] = useState<Venue[]>(SAMPLE_VENUES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // 1. Fetch complete list of venues from server
    fetch('/api/venues')
      .then(r => r.json())
      .then(res => {
        if (res.ok && Array.isArray(res.venues) && isMounted) {
          setVenues(res.venues);
          setLoading(false);
        }
      })
      .catch(() => {});

    // 2. Realtime listener for venues path
    const unsub = listenToPath<Record<string, Partial<Venue>>>('venues', (data) => {
      if (data && typeof data === 'object' && isMounted) {
        setVenues(prev => {
          const map = new Map<string, Venue>();
          prev.forEach(v => map.set(v.id, v));
          Object.entries(data).forEach(([id, v]) => {
            const existing = map.get(id);
            map.set(id, {
              id,
              name: v.name || existing?.name || id,
              city: v.city || existing?.city || 'Location',
              capacity: v.capacity || existing?.capacity || 50000,
              lat: v.lat ?? existing?.lat ?? 0,
              lng: v.lng ?? existing?.lng ?? 0,
              zones: (v.zones ? (Array.isArray(v.zones) ? v.zones : Object.values(v.zones)) : existing?.zones) || [],
              amenities: (v.amenities ? (Array.isArray(v.amenities) ? v.amenities : Object.values(v.amenities)) : existing?.amenities) || [],
              sections: (v.sections ? (Array.isArray(v.sections) ? v.sections : Object.values(v.sections)) : existing?.sections) || [],
              imageUrl: v.imageUrl || existing?.imageUrl,
            } as Venue);
          });
          return Array.from(map.values());
        });
      }
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
      unsub();
    };
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

// ═══════════════════════════════════════════════════════════════════════════════
// VENUE COMPLEX HOOKS (v2) — additive, do NOT change existing hooks above
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * useComplexCrowd — listens to RTDB `complex_crowd/{complexId}`.
 * Returns the full building crowd: all spaces + shared corridors.
 * Used by the ComplexAdmin overview dashboard.
 */
export function useComplexCrowd(complexId: string | null | undefined) {
  const isDemo = complexId === 'bharat-mandap';
  const initialData = isDemo ? {
    shared    : (SAMPLE_COMPLEX_CROWD.shared as unknown as Record<string, SpaceCrowdSlice>),
    spaces    : (SAMPLE_COMPLEX_CROWD.spaces as unknown as Record<string, SpaceCrowdSlice>),
    totalCount: SAMPLE_COMPLEX_CROWD.totalCount,
  } : null;

  const [data, setData] = useState<{
    shared    : Record<string, SpaceCrowdSlice>;
    spaces    : Record<string, SpaceCrowdSlice>;
    totalCount: number;
  } | null>(initialData);
  const [loading, setLoading] = useState(!isDemo);

  useEffect(() => {
    if (!complexId) { setLoading(false); return; }
    const unsub = listenToPath(`complex_crowd/${complexId}`, (val: unknown) => {
      const raw = val as Record<string, unknown> | null;
      if (raw && (raw.spaces || raw.shared)) {
        setData({
          shared    : (raw?.shared  as Record<string, SpaceCrowdSlice>) ?? {},
          spaces    : (raw?.spaces  as Record<string, SpaceCrowdSlice>) ?? {},
          totalCount: (raw?.totalCount as number) ?? 0,
        });
      } else if (complexId === 'bharat-mandap') {
        setData({
          shared    : (SAMPLE_COMPLEX_CROWD.shared as unknown as Record<string, SpaceCrowdSlice>),
          spaces    : (SAMPLE_COMPLEX_CROWD.spaces as unknown as Record<string, SpaceCrowdSlice>),
          totalCount: SAMPLE_COMPLEX_CROWD.totalCount,
        });
      }
      setLoading(false);
    });
    return unsub;
  }, [complexId]);

  const isLive = data ? Object.values(data.spaces).some(s => s.count > 0) : false;

  return { shared: data?.shared ?? {}, spaces: data?.spaces ?? {}, totalCount: data?.totalCount ?? 0, loading, isLive };
}

/**
 * useSpaceCrowd — listens to a single RTDB space slot.
 * Used by SpaceAdmin dashboard (sees ONLY their space, not neighbours).
 */
export function useSpaceCrowd(complexId: string | null | undefined, spaceId: string | null | undefined) {
  const isDemo = complexId === 'bharat-mandap';
  const demoSlot = isDemo && spaceId
    ? ((SAMPLE_COMPLEX_CROWD.spaces as unknown as Record<string, SpaceCrowdSlice>)[spaceId] ?? null)
    : null;

  const [crowd, setCrowd] = useState<SpaceCrowdSlice | null>(demoSlot);
  const [loading, setLoading] = useState(!demoSlot);

  useEffect(() => {
    if (!complexId || !spaceId) { setLoading(false); return; }
    const path = `complex_crowd/${complexId}/spaces/${spaceId}`;
    const unsub = listenToPath(path, (val: unknown) => {
      if (val) {
        setCrowd(val as SpaceCrowdSlice);
      } else if (complexId === 'bharat-mandap') {
        const slot = (SAMPLE_COMPLEX_CROWD.spaces as unknown as Record<string, SpaceCrowdSlice>)[spaceId] ?? null;
        setCrowd(slot);
      }
      setLoading(false);
    });
    return unsub;
  }, [complexId, spaceId]);

  return { crowd, loading };
}

/**
 * useComplexNotifications — merges two RTDB paths:
 *   `complex_notifications/{complexId}/broadcast_all`   (all-complex alerts)
 *   `complex_notifications/{complexId}/spaces/{spaceId}` (space-specific alerts)
 * Used by the Guest Complex PWA and SpaceAdmin dashboard.
 */
export function useComplexNotifications(complexId: string | null | undefined, spaceId: string | null | undefined) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!complexId) { setLoading(false); return; }

    const broadcastMap: Record<string, Notification> = {};
    const spaceMap    : Record<string, Notification> = {};

    const merge = () => {
      const all = Object.values({ ...broadcastMap, ...spaceMap })
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 50);
      setNotifications(all);
    };

    // Listen to complex-wide broadcasts
    const unsubBroadcast = listenToPath(
      `complex_notifications/${complexId}/broadcast_all`,
      (val: unknown) => {
        const map = (val ?? {}) as Record<string, Notification>;
        Object.assign(broadcastMap, map);
        merge();
        setLoading(false);
      },
    );

    // Listen to space-scoped notifications (only if spaceId provided)
    let unsubSpace: (() => void) | undefined;
    if (spaceId) {
      unsubSpace = listenToPath(
        `complex_notifications/${complexId}/spaces/${spaceId}`,
        (val: unknown) => {
          const map = (val ?? {}) as Record<string, Notification>;
          Object.assign(spaceMap, map);
          merge();
        },
      );
    } else {
      setLoading(false);
    }

    return () => {
      unsubBroadcast();
      unsubSpace?.();
    };
  }, [complexId, spaceId]);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return { notifications, loading, unreadCount, markAllRead };
}

/**
 * useGuestPositions — listens to RTDB `guest_positions/{complexId}`.
 * Returns a map of sessionId → GuestPositionTick for the ComplexAdmin heatmap.
 */
export function useGuestPositions(complexId: string | null | undefined) {
  const [positions, setPositions] = useState<Record<string, GuestPositionTick>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!complexId) { setLoading(false); return; }
    const unsub = listenToPath(`guest_positions/${complexId}`, (val: unknown) => {
      setPositions((val ?? {}) as Record<string, GuestPositionTick>);
      setLoading(false);
    });
    return unsub;
  }, [complexId]);

  return { positions, loading };
}
