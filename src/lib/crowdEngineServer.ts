/**
 * crowdEngineServer.ts — Server-only RTDB writers and simulation timers.
 *
 * Imports firebaseAdmin to perform privileged server-side RTDB updates.
 * NEVER import this file from Client Components ('use client').
 * Only import from API routes (src/app/api/**\/route.ts).
 */

import { CrowdSnapshot, EventPhaseId, VenueEvent, Zone } from '@/types';
import { writePath } from '@/lib/firebaseAdmin';
import { computeSimulatedSnapshot, EVENT_PHASES, getNextPhaseId } from './crowdEngine';

export async function pushSnapshotToRTDB(
  venueId : string,
  snapshot: CrowdSnapshot,
): Promise<void> {
  await writePath(`venues/${venueId}/crowd`, snapshot);

  // ── Phase 6f: Red-Zone Density FCM Push Alert Trigger ─────────────────────
  if (snapshot?.zones) {
    for (const [zoneId, zData] of Object.entries(snapshot.zones)) {
      if (zData.density >= 0.75) {
        try {
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          await fetch(`${appUrl}/api/notify`, {
            method : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body   : JSON.stringify({
              venueId,
              title  : `🚨 High Congestion: Zone ${zoneId}`,
              message: `Zone ${zoneId} has reached ${Math.round(zData.density * 100)}% capacity (${zData.count} guests). Immediate staff dispatch recommended.`,
              type   : 'emergency',
            }),
          });
        } catch (err) {
          console.warn('[CrowdEngine] Red-zone alert trigger failed (non-blocking):', err);
        }
      }
    }
  }
}

// ── Simulation interval manager (in-memory, per-process) ─────────────────────

const activeSimulations = new Map<string, ReturnType<typeof setInterval>>();

export function startSimulation(
  eventId : string,
  venueId : string,
  zones   : Zone[],
  getEvent: () => VenueEvent | null,
  getSnap : () => CrowdSnapshot | null,
  onAdvancePhase: (newPhaseId: EventPhaseId) => void,
): void {
  if (activeSimulations.has(eventId)) return;

  const interval = setInterval(async () => {
    const event = getEvent();
    if (!event || event.status !== 'live') {
      stopSimulation(eventId);
      return;
    }

    const snapshot = computeSimulatedSnapshot(zones, event, getSnap());
    await pushSnapshotToRTDB(venueId, snapshot);

    if (event.phaseStartedAt && event.currentPhaseId) {
      const elapsed = (Date.now() - event.phaseStartedAt) / 60_000;
      const phase   = EVENT_PHASES[event.currentPhaseId];
      if (elapsed >= phase.durationMins) {
        const next = getNextPhaseId(event.currentPhaseId);
        if (next) onAdvancePhase(next);
      }
    }
  }, 30_000);

  activeSimulations.set(eventId, interval);
}

export function stopSimulation(eventId: string): void {
  const interval = activeSimulations.get(eventId);
  if (interval) {
    clearInterval(interval);
    activeSimulations.delete(eventId);
  }
}
