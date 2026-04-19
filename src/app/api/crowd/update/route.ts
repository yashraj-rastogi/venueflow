import { NextRequest, NextResponse } from 'next/server';
import { SAMPLE_VENUES } from '@/lib/sampleData';

// Client SDK import — works without a service account for free-tier RTDB
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let writePath: ((path: string, data: unknown) => unknown) | null = null;
async function getWriter() {
  if (!writePath) {
    const mod = await import('@/lib/firebase');
    writePath = mod.writePath;
  }
  return writePath!;
}

function simulateDelta(density: number): number {
  // Realistic crowd drift — weighted toward convergence around 0.5
  const drift = (Math.random() - 0.5) * 0.08;
  const pull = (0.5 - density) * 0.04; // mean reversion
  return Math.max(0, Math.min(1, density + drift + pull));
}

export async function POST(req: NextRequest) {
  try {
    const { venueId } = await req.json();
    const venue = SAMPLE_VENUES.find(v => v.id === venueId) ?? SAMPLE_VENUES[0];

    const updatedZones: Record<string, { density: number; count: number; capacity: number }> = {};
    for (const zone of venue.zones) {
      const newDensity = simulateDelta(zone.density);
      updatedZones[zone.id] = {
        density: parseFloat(newDensity.toFixed(3)),
        count: Math.round(newDensity * zone.capacity),
        capacity: zone.capacity,
      };
    }

    const snapshot = {
      timestamp: Date.now(),
      venueId,
      totalCount: Object.values(updatedZones).reduce((s, z) => s + z.count, 0),
      zones: updatedZones,
    };

    // Write to Firebase RTDB
    try {
      const write = await getWriter();
      await write(`crowd_data/${venueId}`, snapshot);
    } catch {
      // RTDB not available in dev — return the simulated data anyway
    }

    return NextResponse.json({ ok: true, snapshot });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
