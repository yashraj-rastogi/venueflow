/**
 * safety.ts — DIM-ICE (Ingress-Distribution-Management-ICE) crowd safety framework
 *
 * Mathematical constraints from specification:
 *   Physical density:  ρ = N / A  ≤ 4.5 people/m²
 *   Egress flow rate:  F = N / (W × t) ≥ 25 pax/min
 *
 * References: Green Guide (SGSA), Fruin LOS standards.
 */
import { Zone, SafetyMetrics } from '@/types';

// ── Safety thresholds (spec-mandated) ────────────────────────────────────────
export const MAX_PHYSICAL_DENSITY = 4.5;   // people/m²
export const MIN_FLOW_RATE        = 25;    // pax/min
export const WARNING_DENSITY_RATIO = 0.80; // 80% of max triggers warning

// ── Core math functions ──────────────────────────────────────────────────────

/**
 * Physical crowd density  ρ = N / A
 * @param count     Number of people in the zone
 * @param areaM2    Floor area of the zone in m²
 * @returns         Density in people/m² (0 if areaM2 ≤ 0)
 */
export function calcPhysicalDensity(count: number, areaM2: number): number {
  if (!areaM2 || areaM2 <= 0) return 0;
  return count / areaM2;
}

/**
 * Egress flow rate  F = N / (W × t)
 * @param countPassed   Estimated number of people flowing through egress per period
 * @param widthM        Total egress width in metres
 * @param timeMins      Time window in minutes
 * @returns             Flow rate in pax/min (0 if widthM or timeMins is ≤ 0)
 */
export function calcFlowRate(countPassed: number, widthM: number, timeMins: number): number {
  if (!widthM || widthM <= 0 || !timeMins || timeMins <= 0) return 0;
  return countPassed / (widthM * timeMins);
}

/**
 * Full DIM-ICE safety evaluation for a zone snapshot.
 * We model egress as 10 % of zone population flowing through exits per 5-min window.
 *
 * @param zone   Zone definition including physical dimensions
 * @param count  Current occupant count (from live crowd data)
 * @returns      SafetyMetrics with phase classification and reallocation flag
 */
export function evaluateZoneSafety(zone: Zone, count: number): SafetyMetrics {
  const areaM2       = zone.areaM2 ?? 0;
  const egressWidthM = zone.egressWidthM ?? 4; // default 4 m egress if not specified

  const physicalDensity = calcPhysicalDensity(count, areaM2);

  // Model: 10 % of occupants attempt egress in a 5-minute window
  const egressCount = count * 0.10;
  const flowRate    = calcFlowRate(egressCount, egressWidthM, 5);

  const densityCritical = areaM2 > 0 && physicalDensity > MAX_PHYSICAL_DENSITY;
  const densityWarning  = areaM2 > 0 && physicalDensity > MAX_PHYSICAL_DENSITY * WARNING_DENSITY_RATIO;

  // Flow rate is only meaningful when the zone is already under crowd pressure.
  // Below 50% of the density threshold, flow concerns are not yet actionable.
  const densityPressureActive = areaM2 > 0
    ? physicalDensity > MAX_PHYSICAL_DENSITY * 0.5
    : count > 500; // fallback when areaM2 is unknown

  const flowCritical = densityPressureActive && count > 100 && flowRate < MIN_FLOW_RATE;

  let dimIcePhase: SafetyMetrics['dimIcePhase'];
  if (densityCritical || flowCritical) {
    dimIcePhase = 'critical';
  } else if (densityWarning) {
    dimIcePhase = 'warning';
  } else {
    dimIcePhase = 'safe';
  }

  return {
    physicalDensity,
    flowRate,
    dimIcePhase,
    staffReallocationNeeded: dimIcePhase === 'critical',
  };
}

/**
 * Classify the DIM-ICE phase label for UI display.
 */
export function dimIceLabel(phase: SafetyMetrics['dimIcePhase']): string {
  return { safe: 'Safe', warning: 'Monitor', critical: '⚠ Reallocate Staff' }[phase];
}
