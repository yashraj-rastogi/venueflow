'use client';
import { useEffect, useState, useCallback } from 'react';
import { listenToPath, writePath, pushToPath } from '@/lib/firebase';
import { CrowdSnapshot, Notification } from '@/types';
import { SAMPLE_CROWD_SNAPSHOT, SAMPLE_NOTIFICATIONS, SAMPLE_VENUES } from '@/lib/sampleData';

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
    });
  }, [venueId]);

  return { crowd, loading, isLive, triggerUpdate };
}

// ─── Wait Times ────────────────────────────────────────────────────────────────

export function useWaitTimes(venueId: string) {
  // Wait times come from crowd simulation — derived directly from crowd density.
  // In a real deployment, a Cloud Function would write to wait_times/{venueId}.
  // For MVP, we return amenity data from the static venue definition, 
  // which the dashboard mutates optimistically.
  const venue = SAMPLE_VENUES.find(v => v.id === venueId) ?? SAMPLE_VENUES[0];
  const [amenities, setAmenities] = useState(venue.amenities);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!venueId) return;
    setLoading(true);
    const unsub = listenToPath<Record<string, { waitTime: number; predictedWaitTime: number; trend: string; isOpen: boolean }>>(
      `wait_times/${venueId}`,
      (data) => {
        if (data) {
          // Merge live wait time data with static amenity definitions
          setAmenities(prev => prev.map(a => ({
            ...a,
            ...(data[a.id] ?? {}),
          })));
        }
        setLoading(false);
      }
    );
    return unsub;
  }, [venueId]);

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
          // Seed sample notifications if none exist
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

// ─── Seed venue data to RTDB ───────────────────────────────────────────────────

export async function seedVenueData(venueId: string) {
  const venue = SAMPLE_VENUES.find(v => v.id === venueId) ?? SAMPLE_VENUES[0];

  // Write initial crowd snapshot
  const zones: Record<string, { density: number; count: number; capacity: number }> = {};
  for (const zone of venue.zones) {
    zones[zone.id] = {
      density: zone.density,
      count: zone.currentCount,
      capacity: zone.capacity,
    };
  }
  await writePath(`crowd_data/${venueId}`, {
    timestamp: Date.now(),
    venueId,
    totalCount: Object.values(zones).reduce((s, z) => s + z.count, 0),
    zones,
  });

  // Write initial wait times
  const waitTimes: Record<string, { waitTime: number; predictedWaitTime: number; trend: string; isOpen: boolean }> = {};
  for (const a of venue.amenities) {
    waitTimes[a.id] = {
      waitTime: a.waitTime,
      predictedWaitTime: a.predictedWaitTime,
      trend: a.trend,
      isOpen: a.isOpen,
    };
  }
  await writePath(`wait_times/${venueId}`, waitTimes);
}
