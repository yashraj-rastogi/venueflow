import { NextRequest, NextResponse } from 'next/server';
import { sanitizeInput } from '@/lib/inputGuard';
import { checkPermission } from '@/lib/fga';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pushToPath: ((path: string, data: unknown) => unknown) | null = null;
async function getPusher() {
  if (!pushToPath) {
    const mod  = await import('@/lib/firebaseAdmin');
    pushToPath = mod.pushToPath;
  }
  return pushToPath!;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { venueId, complexId, spaceId, section, message, type, title, userId } = body;

    // ── Basic field validation ────────────────────────────────────────────────────────────────
    if (!message || (!venueId && !complexId)) {
      return NextResponse.json(
        { ok: false, error: 'message and at least one of venueId/complexId are required' },
        { status: 400 },
      );
    }

    if (venueId && (typeof venueId !== 'string' || venueId.length > 60)) {
      return NextResponse.json({ ok: false, error: 'Invalid venueId' }, { status: 400 });
    }

    // ── OWASP LLM01: Sanitize message against prompt injection ──────────────────
    const { safe, blocked, reason } = sanitizeInput(message);
    if (blocked) {
      return NextResponse.json(
        { ok: false, error: `Message blocked: ${reason}` },
        { status: 422 },
      );
    }

    // ── OWASP LLM06: OpenFGA ReBAC authorization ───────────────────────────────
    if (userId) {
      let allowed = false;
      if (complexId && !spaceId) {
        // Complex-wide broadcast: requires complex_admin
        allowed = await checkPermission(userId, 'complex_admin', 'complex', complexId);
      } else if (complexId && spaceId) {
        // Space-scoped broadcast: space_admin or complex_admin
        allowed =
          (await checkPermission(userId, 'space_admin', 'space', spaceId)) ||
          (await checkPermission(userId, 'complex_admin', 'complex', complexId));
      } else if (venueId) {
        // Legacy venue broadcast: venue staff/admin
        allowed = await checkPermission(userId, 'staff', 'venue', venueId);
      }

      if (!allowed) {
        return NextResponse.json(
          { ok: false, error: 'Insufficient permissions to broadcast notifications' },
          { status: 403 },
        );
      }
    }

    const notification = {
      id       : `notif-${Date.now()}`,
      type     : type ?? 'info',
      title    : title ?? 'Staff Broadcast',
      message  : safe,
      section  : section ?? 'all',
      timestamp: Date.now(),
      read     : false,
    };

    try {
      const push = await getPusher();

      if (complexId && spaceId) {
        // Space-scoped: only reaches attendees in this specific space
        await push(`complex_notifications/${complexId}/spaces/${spaceId}/${notification.id}`, notification);
      } else if (complexId) {
        // Complex-wide broadcast: reaches ALL attendees in the complex
        await push(`complex_notifications/${complexId}/broadcast_all/${notification.id}`, notification);
      } else if (venueId) {
        // Legacy single-venue path
        await push(`notifications/${venueId}`, notification);
      }
    } catch {
      // RTDB unavailable — still return notification for optimistic UI
    }

    // ── FCM fan-out to on-duty staff ──────────────────────────────────────────────────────
    // Only fan-out for emergency or warning type notifications
    if ((type === 'emergency' || type === 'warning') && venueId) {
      try {
        const { adminFirestore, adminMessaging } = await import('@/lib/firebaseAdmin');
        // Derive orgId from venueId by scanning orgs (best-effort, non-blocking)
        const orgSnap = await adminFirestore
          .collection('organizations')
          .where('venueIds', 'array-contains', venueId)
          .limit(1)
          .get();

        if (!orgSnap.empty) {
          const orgId = orgSnap.docs[0].id;
          const tokensSnap = await adminFirestore
            .collection('organizations')
            .doc(orgId)
            .collection('venues')
            .doc(venueId)
            .collection('push_tokens')
            .get();

          const tokens = tokensSnap.docs.map(d => d.data().fcmToken as string).filter(Boolean);

          if (tokens.length > 0) {
            await adminMessaging.sendEachForMulticast({
              tokens,
              notification: {
                title: title ?? 'VenueFlow Alert',
                body : safe,
              },
              data: { type: type ?? 'info', venueId },
            });
          }
        }
      } catch (fcmErr) {
        console.warn('[Notify] FCM fan-out failed (non-blocking):', fcmErr);
      }
    }

    return NextResponse.json({ ok: true, notification });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

/**
 * DELETE /api/notify
 * Body: { venueId: string, notifId?: string }
 */
export async function DELETE(req: NextRequest) {
  try {
    const { venueId, notifId } = await req.json() as { venueId?: string; notifId?: string };
    if (!venueId) {
      return NextResponse.json({ ok: false, error: 'venueId is required' }, { status: 400 });
    }

    const { deletePath } = await import('@/lib/firebaseAdmin');

    if (notifId) {
      await deletePath(`notifications/${venueId}/${notifId}`);
    } else {
      await deletePath(`notifications/${venueId}`);
    }

    return NextResponse.json({ ok: true, message: notifId ? `Deleted notification ${notifId}` : `Cleared all notifications for venue ${venueId}` });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
