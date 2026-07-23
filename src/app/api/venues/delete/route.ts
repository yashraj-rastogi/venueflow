import { NextRequest, NextResponse } from 'next/server';
import { adminDeleteVenue } from '@/lib/firebaseAdmin';

/**
 * DELETE /api/venues/delete
 *
 * Permanently removes a venue and all its associated data from Firestore and RTDB.
 *
 * Body: { orgId: string, venueId: string }
 */
export async function DELETE(req: NextRequest) {
  try {
    const { orgId, venueId } = (await req.json()) as { orgId?: string; venueId?: string };

    if (!orgId || !venueId) {
      return NextResponse.json({ ok: false, error: 'orgId and venueId are required' }, { status: 400 });
    }

    // Prevent accidental deletion of the built-in demo venue
    if (venueId === 'metlife-stadium') {
      return NextResponse.json({ ok: false, error: 'Cannot delete the demo venue.' }, { status: 403 });
    }

    await adminDeleteVenue(orgId, venueId);

    return NextResponse.json({ ok: true, message: `Venue "${venueId}" deleted successfully.` });
  } catch (err) {
    console.error('[VenueDelete]', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Delete failed' },
      { status: 500 },
    );
  }
}
