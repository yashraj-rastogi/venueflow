import { NextRequest, NextResponse } from 'next/server';
import {
  EVENT_PHASES, getNextPhaseId, isEventOver, computeSimulatedSnapshot,
} from '@/lib/crowdEngine';
import {
  startSimulation, stopSimulation, pushSnapshotToRTDB,
} from '@/lib/crowdEngineServer';
import { updateEvent, subscribeToLiveEvent } from '@/lib/firestore';
import { checkVenueWeather } from '@/lib/weatherService';
import { SAMPLE_VENUES } from '@/lib/sampleData';
import { VenueEvent, EventPhaseId, CrowdSnapshot, Zone } from '@/types';

// In-memory state for simulation (per-process — suitable for single-server / local dev)
// In production, use Vercel Cron + Firestore for durability across serverless instances.
const simState = new Map<string, {
  event    : VenueEvent;
  snapshot : CrowdSnapshot | null;
}>();

/** GET /api/events/[eventId]/simulate — get simulation status */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const state = simState.get(eventId);
  if (!state) return NextResponse.json({ ok: false, running: false });
  return NextResponse.json({ ok: true, running: true, phase: state.event.currentPhaseId });
}

/** POST /api/events/[eventId]/simulate — start/stop/tick simulation */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const body = await req.json() as {
    action  : 'start' | 'stop' | 'tick' | 'advance_phase';
    event  ?: VenueEvent;
    venueId?: string;
  };

  const { action, event, venueId } = body;

  // ── STOP ──────────────────────────────────────────────────────────────────
  if (action === 'stop') {
    stopSimulation(eventId);
    simState.delete(eventId);
    await updateEvent(eventId, { status: 'ended', actualAttendance: simState.get(eventId)?.snapshot?.totalCount });
    return NextResponse.json({ ok: true, stopped: true });
  }

  // ── ADVANCE PHASE ─────────────────────────────────────────────────────────
  if (action === 'advance_phase' && event) {
    const next = getNextPhaseId(event.currentPhaseId ?? 'doors_open');
    if (!next) return NextResponse.json({ ok: false, error: 'Already in final phase' });
    const newPhase: Partial<VenueEvent> = { currentPhaseId: next, phaseStartedAt: Date.now() };
    await updateEvent(eventId, newPhase);
    const state = simState.get(eventId);
    if (state) state.event = { ...state.event, ...newPhase };
    return NextResponse.json({ ok: true, newPhase: next, label: EVENT_PHASES[next].label });
  }

  // ── START ─────────────────────────────────────────────────────────────────
  if (action === 'start' && event && venueId) {
    // Check weather and apply risk factor
    const venue = SAMPLE_VENUES.find(v => v.id === venueId);
    let weatherRiskFactor = 0;
    if (venue) {
      const { riskFactor } = await checkVenueWeather(venue);
      weatherRiskFactor = riskFactor;
    }

    const liveEvent: VenueEvent = {
      ...event,
      status           : 'live',
      currentPhaseId   : 'doors_open',
      phaseStartedAt   : Date.now(),
      weatherRiskFactor,
    };

    await updateEvent(eventId, {
      status           : 'live',
      currentPhaseId   : 'doors_open',
      phaseStartedAt   : Date.now(),
      weatherRiskFactor,
    });

    simState.set(eventId, { event: liveEvent, snapshot: null });

    const zones: Zone[] = venue?.zones ?? [];

    startSimulation(
      eventId,
      venueId,
      zones,
      () => simState.get(eventId)?.event ?? null,
      () => simState.get(eventId)?.snapshot ?? null,
      async (newPhaseId: EventPhaseId) => {
        const state = simState.get(eventId);
        if (!state) return;
        const updated: Partial<VenueEvent> = { currentPhaseId: newPhaseId, phaseStartedAt: Date.now() };
        state.event = { ...state.event, ...updated };
        await updateEvent(eventId, updated);
        if (isEventOver(state.event)) {
          stopSimulation(eventId);
          await updateEvent(eventId, { status: 'ended', actualAttendance: state.snapshot?.totalCount });
        }
      },
    );

    // Immediately compute and push first tick
    const firstSnap = computeSimulatedSnapshot(zones, liveEvent, null);
    simState.get(eventId)!.snapshot = firstSnap;
    await pushSnapshotToRTDB(venueId, firstSnap);

    return NextResponse.json({
      ok              : true,
      started         : true,
      weatherRiskFactor,
      initialCount    : firstSnap.totalCount,
      phase           : 'doors_open',
    });
  }

  // ── TICK (manual trigger for testing) ─────────────────────────────────────
  if (action === 'tick' && event && venueId) {
    const venue  = SAMPLE_VENUES.find(v => v.id === venueId);
    const zones  = venue?.zones ?? [];
    const state  = simState.get(eventId);
    const snap   = computeSimulatedSnapshot(zones, event, state?.snapshot ?? null);
    if (state) state.snapshot = snap;
    await pushSnapshotToRTDB(venueId, snap);
    return NextResponse.json({ ok: true, snapshot: snap });
  }

  return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
}
