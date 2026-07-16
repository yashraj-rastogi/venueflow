import { NextRequest, NextResponse } from 'next/server';
import { SAMPLE_VENUES } from '@/lib/sampleData';
import { evaluateZoneSafety } from '@/lib/safety';

// Client SDK import — works without a service account for free-tier RTDB
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let writePath: ((path: string, data: unknown) => unknown) | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pushToPath: ((path: string, data: unknown) => unknown) | null = null;

async function getFirebase() {
  if (!writePath || !pushToPath) {
    const mod = await import('@/lib/firebase');
    writePath  = mod.writePath;
    pushToPath = mod.pushToPath;
  }
  return { writePath: writePath!, pushToPath: pushToPath! };
}

function simulateDelta(density: number): number {
  const drift = (Math.random() - 0.5) * 0.08;
  const pull  = (0.5 - density) * 0.04; // mean reversion
  return Math.max(0, Math.min(1, density + drift + pull));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { venueId } = body;

    if (!venueId || typeof venueId !== 'string') {
      return NextResponse.json({ ok: false, error: 'venueId is required' }, { status: 400 });
    }

    const venue = SAMPLE_VENUES.find(v => v.id === venueId) ?? SAMPLE_VENUES[0];

    const updatedZones: Record<string, { density: number; count: number; capacity: number }> = {};
    const safetyAlerts: { zoneId: string; phase: string }[] = [];

    for (const zone of venue.zones) {
      const newDensity = simulateDelta(zone.density);
      const newCount   = Math.round(newDensity * zone.capacity);

      updatedZones[zone.id] = {
        density : parseFloat(newDensity.toFixed(3)),
        count   : newCount,
        capacity: zone.capacity,
      };

      // ── DIM-ICE Safety Evaluation ─────────────────────────────────────────
      const safety = evaluateZoneSafety(zone, newCount);
      if (safety.staffReallocationNeeded || safety.dimIcePhase === 'warning') {
        safetyAlerts.push({ zoneId: zone.id, phase: safety.dimIcePhase });
      }
    }

    const snapshot = {
      timestamp : Date.now(),
      venueId,
      totalCount: Object.values(updatedZones).reduce((s, z) => s + z.count, 0),
      zones     : updatedZones,
    };

    // ── Write to Firebase RTDB ──────────────────────────────────────────────
    try {
      const { writePath: write, pushToPath: push } = await getFirebase();
      await write(`crowd_data/${venueId}`, snapshot);

      // Auto-push safety notifications for each at-risk zone
      for (const alert of safetyAlerts) {
        const zoneInfo = venue.zones.find(z => z.id === alert.zoneId);
        const notif = {
          id       : `safety-${alert.zoneId}-${Date.now()}`,
          type     : alert.phase === 'critical' ? 'emergency' : 'warning',
          title    : alert.phase === 'critical'
            ? `⚠ CRITICAL: ${zoneInfo?.name ?? alert.zoneId} — Staff Reallocation Required`
            : `Monitor: ${zoneInfo?.name ?? alert.zoneId} approaching safety threshold`,
          message  : alert.phase === 'critical'
            ? `Physical density or egress flow has breached DIM-ICE safety thresholds. Immediate staff reallocation required.`
            : `Zone density is approaching the 4.5 people/m² safety threshold. Monitor closely.`,
          section  : 'all',
          timestamp: Date.now(),
          read     : false,
        };
        await push(`notifications/${venueId}`, notif);
      }
    } catch {
      // RTDB not available in dev — return the simulated data anyway
    }

    return NextResponse.json({ ok: true, snapshot, safetyAlerts });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
