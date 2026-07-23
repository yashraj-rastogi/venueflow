import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore } from '@/lib/firebaseAdmin';
import { VenueEvent } from '@/types';

/**
 * POST /api/events/create
 * Body: { orgId, venueId, name, type, date, expectedAttendance, description?, specialInstructions? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Partial<VenueEvent> & { orgId: string };
    const { orgId, venueId, name, type, date, expectedAttendance, description, specialInstructions } = body;

    if (!orgId || !venueId || !name || !type || !date) {
      return NextResponse.json({ ok: false, error: 'Missing required fields: orgId, venueId, name, type, date' }, { status: 400 });
    }

    const eventData = {
      orgId,
      venueId,
      name: name.trim(),
      type,
      date,
      expectedAttendance: expectedAttendance ?? 0,
      status: 'upcoming',
      description: description ?? '',
      specialInstructions: specialInstructions ?? '',
      createdAt: Date.now(),
    };

    const ref = await adminFirestore.collection('events').add(eventData);

    return NextResponse.json({ ok: true, eventId: ref.id, event: { id: ref.id, ...eventData } });
  } catch (err) {
    console.error('[EventCreate]', err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'Failed to create event' }, { status: 500 });
  }
}
