import { NextRequest, NextResponse } from 'next/server';
import { adminFirestore, adminDb } from '@/lib/firebaseAdmin';

/**
 * POST /api/admin/orgs
 * Body: { orgId, name, slug, ownerEmail, plan, venueId, venueName, city, capacity, staffEmails }
 *
 * Creates a new organization document, venue sub-document, and staff placeholders.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orgId, name, slug, ownerEmail, plan, venueId, venueName, city, capacity, staffEmails } = body;

    if (!orgId || !name || !ownerEmail || !venueId || !venueName) {
      return NextResponse.json({ ok: false, error: 'Missing required organization or venue fields' }, { status: 400 });
    }

    const now = Date.now();

    // 1. Create Organization doc
    await adminFirestore.collection('organizations').doc(orgId).set({
      id: orgId,
      name,
      slug: slug || orgId,
      plan: plan || 'pro',
      ownerEmail,
      createdAt: now,
      venueIds: [venueId],
    });

    // 2. Create Venue doc
    await adminFirestore.collection('organizations').doc(orgId).collection('venues').doc(venueId).set({
      id: venueId,
      orgId,
      name: venueName,
      city: city || 'Default City',
      totalCapacity: Number(capacity) || 25000,
      createdAt: now,
      zones: [
        { id: 'zone-n', name: 'North Stand', capacity: Math.round((capacity || 25000) * 0.3), density: 0.1, currentCount: 0, isStepFree: true },
        { id: 'zone-s', name: 'South Stand', capacity: Math.round((capacity || 25000) * 0.3), density: 0.1, currentCount: 0, isStepFree: true },
        { id: 'zone-e', name: 'East Stand',  capacity: Math.round((capacity || 25000) * 0.2), density: 0.1, currentCount: 0, isStepFree: false },
        { id: 'zone-w', name: 'West Stand',  capacity: Math.round((capacity || 25000) * 0.2), density: 0.1, currentCount: 0, isStepFree: true },
      ],
      amenities: [
        { id: `${venueId}-rest-1`, type: 'restroom', name: 'Gate 1 Restroom', location: { lat: 0, lng: 0 }, section: 'zone-n', waitTime: 2, predictedWaitTime: 3, trend: 'stable', isOpen: true },
        { id: `${venueId}-conc-1`, type: 'concession', name: 'Food Court A', location: { lat: 0, lng: 0 }, section: 'zone-s', waitTime: 5, predictedWaitTime: 7, trend: 'increasing', isOpen: true },
      ],
    });

    // 3. Create Staff Member placeholders if provided
    if (Array.isArray(staffEmails) && staffEmails.length > 0) {
      const staffCol = adminFirestore.collection('organizations').doc(orgId).collection('venues').doc(venueId).collection('staff');
      for (const email of staffEmails) {
        if (!email.trim()) continue;
        const staffId = `staff-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        await staffCol.doc(staffId).set({
          id: staffId,
          venueId,
          orgId,
          name: email.split('@')[0],
          email: email.trim(),
          role: 'staff',
          assignedZoneId: 'zone-n',
          isOnDuty: true,
          createdAt: now,
        });
      }
    }

    // 4. Seed RTDB crowd structure
    await adminDb.ref(`crowd_data/${venueId}`).set({
      totalCount: 0,
      timestamp: now,
      venueId,
      zones: {
        'zone-n': { count: 0, capacity: Math.round((capacity || 25000) * 0.3), density: 0 },
        'zone-s': { count: 0, capacity: Math.round((capacity || 25000) * 0.3), density: 0 },
        'zone-e': { count: 0, capacity: Math.round((capacity || 25000) * 0.2), density: 0 },
        'zone-w': { count: 0, capacity: Math.round((capacity || 25000) * 0.2), density: 0 },
      },
    });

    return NextResponse.json({ ok: true, orgId, venueId });
  } catch (err) {
    console.error('[Admin Orgs POST]', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
