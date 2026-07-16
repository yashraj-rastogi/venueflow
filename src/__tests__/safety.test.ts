/**
 * safety.test.ts — Unit tests for the DIM-ICE crowd safety math module
 * Run: npm test
 */
import {
  calcPhysicalDensity,
  calcFlowRate,
  evaluateZoneSafety,
  MAX_PHYSICAL_DENSITY,
  MIN_FLOW_RATE,
} from '@/lib/safety';
import type { Zone } from '@/types';

// ── Helper: build a minimal zone fixture ──────────────────────────────────────
function makeZone(overrides: Partial<Zone> = {}): Zone {
  return {
    id           : 'zone-test',
    name         : 'Test Zone',
    capacity     : 8000,
    currentCount : 4000,
    density      : 0.50,
    coordinates  : [],
    areaM2       : 1000,
    egressWidthM : 10,
    isStepFree   : false,
    phase        : 'circulation',
    ...overrides,
  };
}

// ── calcPhysicalDensity ───────────────────────────────────────────────────────
describe('calcPhysicalDensity', () => {
  test('returns correct ρ for valid inputs', () => {
    expect(calcPhysicalDensity(4500, 1000)).toBeCloseTo(4.5);
  });

  test('returns 0 when areaM2 is 0', () => {
    expect(calcPhysicalDensity(500, 0)).toBe(0);
  });

  test('returns 0 when areaM2 is negative', () => {
    expect(calcPhysicalDensity(500, -100)).toBe(0);
  });

  test('exceeds spec threshold 4.5 for overcrowded zone', () => {
    const density = calcPhysicalDensity(5000, 1000); // 5 people/m²
    expect(density).toBeGreaterThan(MAX_PHYSICAL_DENSITY);
  });
});

// ── calcFlowRate ─────────────────────────────────────────────────────────────
describe('calcFlowRate', () => {
  test('returns correct F = N / (W × t)', () => {
    // 250 people / (10m × 1min) = 25 pax/min — exactly at spec threshold
    expect(calcFlowRate(250, 10, 1)).toBeCloseTo(25);
  });

  test('returns 0 when width is 0', () => {
    expect(calcFlowRate(100, 0, 5)).toBe(0);
  });

  test('returns 0 when time is 0', () => {
    expect(calcFlowRate(100, 10, 0)).toBe(0);
  });

  test('flow rate below 25 for narrow egress', () => {
    const flow = calcFlowRate(50, 2, 5); // 50 / (2 × 5) = 5 pax/min
    expect(flow).toBeLessThan(MIN_FLOW_RATE);
  });
});

// ── evaluateZoneSafety ────────────────────────────────────────────────────────
describe('evaluateZoneSafety', () => {
  test('returns "safe" phase for low occupancy zone', () => {
    const zone = makeZone({ areaM2: 2000, egressWidthM: 12 });
    const metrics = evaluateZoneSafety(zone, 1000); // 0.5 people/m²
    expect(metrics.dimIcePhase).toBe('safe');
    expect(metrics.staffReallocationNeeded).toBe(false);
  });

  test('returns "critical" phase when physical density exceeds 4.5', () => {
    const zone = makeZone({ areaM2: 500, egressWidthM: 10 });
    // 2500 people / 500 m² = 5 people/m² > 4.5 threshold
    const metrics = evaluateZoneSafety(zone, 2500);
    expect(metrics.dimIcePhase).toBe('critical');
    expect(metrics.staffReallocationNeeded).toBe(true);
  });

  test('returns "warning" phase near 80% of density threshold', () => {
    // ρ = 3700/1000m² = 3.7 ppl/m² = 82% of 4.5 → warning band (>80%, <100%)
    // egressWidthM=2: F = (370)/(2*5) = 37 pax/min ≥ 25 → flowCritical=false
    // densityPressureActive: 3.7 > 2.25 = true, but flowCritical=false → warning ✓
    const zone = makeZone({ areaM2: 1000, egressWidthM: 2 });
    const metrics = evaluateZoneSafety(zone, 3700);
    expect(metrics.dimIcePhase).toBe('warning');
    expect(metrics.staffReallocationNeeded).toBe(false);
  });

  test('physicalDensity is 0 when areaM2 is not provided', () => {
    const zone = makeZone({ areaM2: undefined });
    const metrics = evaluateZoneSafety(zone, 5000);
    expect(metrics.physicalDensity).toBe(0);
  });

  test('physicalDensity value is correctly calculated', () => {
    const zone = makeZone({ areaM2: 1000 });
    const metrics = evaluateZoneSafety(zone, 3000); // 3 people/m²
    expect(metrics.physicalDensity).toBeCloseTo(3.0);
  });
});
