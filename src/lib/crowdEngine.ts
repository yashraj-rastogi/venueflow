/**
 * crowdEngine.ts — Event-Aware Realistic IoT Crowd Simulation Engine (Client-Safe)
 *
 * Contains pure calculation, state functions, and constants for crowd simulation.
 * This file has NO server dependencies (no firebase-admin) so it can be safely
 * imported in both Client Components ('use client') and Server Components.
 */

import { EventPhase, EventPhaseId, VenueEvent, Zone, CrowdSnapshot } from '@/types';

// ── Event phase definitions ───────────────────────────────────────────────────

export const EVENT_PHASES: Record<EventPhaseId, EventPhase> = {
  doors_open: {
    id: 'doors_open', label: 'Doors Open', durationMins: 90,
    zoneFillRatios: { ingress: 0.15, circulation: 0.05, egress: 0.02 },
  },
  pre_game: {
    id: 'pre_game', label: 'Pre-Game', durationMins: 60,
    zoneFillRatios: { ingress: 0.55, circulation: 0.35, egress: 0.10 },
  },
  first_half: {
    id: 'first_half', label: 'First Half', durationMins: 60,
    zoneFillRatios: { ingress: 0.82, circulation: 0.78, egress: 0.65 },
  },
  halftime: {
    id: 'halftime', label: 'Halftime', durationMins: 20,
    zoneFillRatios: { ingress: 0.45, circulation: 0.92, egress: 0.30 },
  },
  second_half: {
    id: 'second_half', label: 'Second Half', durationMins: 65,
    zoneFillRatios: { ingress: 0.88, circulation: 0.80, egress: 0.70 },
  },
  post_game: {
    id: 'post_game', label: 'Post-Game', durationMins: 15,
    zoneFillRatios: { ingress: 0.50, circulation: 0.85, egress: 0.92 },
  },
  egress: {
    id: 'egress', label: 'Egress', durationMins: 45,
    zoneFillRatios: { ingress: 0.10, circulation: 0.20, egress: 0.60 },
  },
};

export const PHASE_ORDER: EventPhaseId[] = [
  'doors_open', 'pre_game', 'first_half', 'halftime',
  'second_half', 'post_game', 'egress',
];

// ── Gaussian noise for realistic sensor-like variation ───────────────────────

function gaussianNoise(mean: number, stdDev: number): number {
  const u = 1 - Math.random();
  const v = Math.random();
  return mean + stdDev * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ── Current event phase resolution ───────────────────────────────────────────

export function getCurrentPhase(event: VenueEvent): EventPhase {
  if (!event.currentPhaseId) return EVENT_PHASES['doors_open'];
  return EVENT_PHASES[event.currentPhaseId] ?? EVENT_PHASES['doors_open'];
}

export function getNextPhaseId(currentPhaseId: EventPhaseId): EventPhaseId | null {
  const idx = PHASE_ORDER.indexOf(currentPhaseId);
  return idx < PHASE_ORDER.length - 1 ? PHASE_ORDER[idx + 1] : null;
}

export function isEventOver(event: VenueEvent): boolean {
  return event.currentPhaseId === 'egress' &&
    event.phaseStartedAt != null &&
    Date.now() - event.phaseStartedAt > EVENT_PHASES['egress'].durationMins * 60_000;
}

// ── Core simulation tick ──────────────────────────────────────────────────────

export function computeSimulatedSnapshot(
  zones       : Zone[],
  event       : VenueEvent,
  prevSnapshot: CrowdSnapshot | null,
): CrowdSnapshot {
  const phase            = getCurrentPhase(event);
  const weatherFactor    = 1 - (event.weatherRiskFactor ?? 0);
  const newZones: CrowdSnapshot['zones'] = {};

  for (const zone of zones) {
    const zonePhase   = zone.phase ?? 'circulation';
    const targetRatio = phase.zoneFillRatios[zonePhase] ?? phase.zoneFillRatios.circulation;
    const targetCount = Math.round(zone.capacity * targetRatio * weatherFactor);
    const noisyTarget = Math.round(gaussianNoise(targetCount, zone.capacity * 0.03));
    const prevCount   = prevSnapshot?.zones[zone.id]?.count ?? Math.round(zone.capacity * 0.05);
    const smoothed    = Math.round(prevCount + (noisyTarget - prevCount) * 0.15);
    const count       = clamp(smoothed, 0, zone.capacity);
    const density     = zone.capacity > 0 ? count / zone.capacity : 0;

    newZones[zone.id] = { density, count, capacity: zone.capacity };
  }

  const totalCount = Object.values(newZones).reduce((s, z) => s + z.count, 0);

  return {
    timestamp: Date.now(),
    venueId  : event.venueId,
    totalCount,
    zones    : newZones,
  };
}

// ── Weather risk factor computation ──────────────────────────────────────────

export function computeWeatherRisk(tempF: number, weatherCode: number): number {
  let risk = 0;
  if (tempF > 100)   risk += 0.08;  // extreme heat
  if (tempF > 95)    risk += 0.04;  // heat advisory
  if (tempF < 15)    risk += 0.06;  // extreme cold
  if (weatherCode >= 200 && weatherCode < 300) risk += 0.12; // thunderstorm
  if (weatherCode >= 900 && weatherCode < 910) risk += 0.20; // extreme weather
  if (weatherCode >= 500 && weatherCode < 600) risk += 0.04; // rain
  return clamp(risk, 0, 0.35);
}
