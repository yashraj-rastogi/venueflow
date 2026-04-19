'use client';
import { useEffect, useState, useCallback } from 'react';
import { listenToPath, pushToPath } from '@/lib/firebase';
import { CrowdSnapshot, Notification, Venue, Amenity } from '@/types';
import { SAMPLE_CROWD_SNAPSHOT, SAMPLE_NOTIFICATIONS, SAMPLE_VENUES } from '@/lib/sampleData';

// ─── Venue Data (from RTDB, seeded from sampleData) ───────────────────────────

/**
 * Real-time venue hook — reads from `venues/{venueId}` in RTDB.
 * Falls back to sampleData if RTDB is unavailable or unseeded.
 */
export function useVenueData(venueId: string) {
  const fallback = SAMPLE_VENUES.find(v => v.id === venueId) ?? SAMPLE_VENUES[0];
  const [venue, setVenue] = useState<Venue>(fallback);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    if (!venueId) return;
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
      setLoading(false);
    });
    return unsub;
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

export function useCrowdData(venueId: string) {
  const [crowd, setCrowd] = useState<CrowdSnapshot>(SAMPLE_CROWD_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    if (!venueId) return;
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
  const fallbackVenue = SAMPLE_VENUES.find(v => v.id === venueId) ?? SAMPLE_VENUES[0];
  const [amenities, setAmenities] = useState(fallbackVenue.amenities);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!venueId) return;
    setLoading(true);
    const unsub = listenToPath<Record<string, { waitTime: number; predictedWaitTime: number; trend: string; isOpen: boolean }>>(
      `wait_times/${venueId}`,
      (data) => {
        if (data) {
          setAmenities(prev => prev.map(a => {
            const live = data[a.id];
            if (!live) return a;
            return {
              ...a,
              waitTime: live.waitTime ?? a.waitTime,
              predictedWaitTime: live.predictedWaitTime ?? a.predictedWaitTime,
              trend: (live.trend as 'increasing' | 'stable' | 'decreasing') ?? a.trend,
              isOpen: live.isOpen ?? a.isOpen,
            };
          }));
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
  const [notifications, setNotifications] = useState<Notification[]>(SAMPLE_NOTIFICATIONS);
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
          // Seed sample notifications if none exist yet
          SAMPLE_NOTIFICATIONS.forEach(n => {
            pushToPath(`notifications/${venueId}`, n).catch(() => {});
          });
        }
        setLoading(false);
      }
    );
    return unsub;
  }, [venueId]);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return { notifications, loading, unreadCount, markAllRead };
}
