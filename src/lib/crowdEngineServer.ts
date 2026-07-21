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
