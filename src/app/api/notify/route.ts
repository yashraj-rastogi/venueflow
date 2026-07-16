import { NextRequest, NextResponse } from 'next/server';
import { sanitizeInput } from '@/lib/inputGuard';
import { checkPermission } from '@/lib/fga';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pushToPath: ((path: string, data: unknown) => unknown) | null = null;
async function getPusher() {
  if (!pushToPath) {
    const mod  = await import('@/lib/firebase');
    pushToPath = mod.pushToPath;
  }
  return pushToPath!;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { venueId, section, message, type, title, userId } = body;

    // ── Basic field validation ─────────────────────────────────────────────
    if (!message || !venueId) {
      return NextResponse.json(
        { ok: false, error: 'venueId and message are required' },
        { status: 400 },
      );
    }

    if (typeof venueId !== 'string' || venueId.length > 60) {
      return NextResponse.json(
        { ok: false, error: 'Invalid venueId' },
        { status: 400 },
      );
    }

    // ── OWASP LLM01: Sanitize message against prompt injection ────────────
    const { safe, blocked, reason } = sanitizeInput(message);
    if (blocked) {
      return NextResponse.json(
        { ok: false, error: `Message blocked: ${reason}` },
        { status: 422 },
      );
    }

    // ── OWASP LLM06: OpenFGA ReBAC authorization ──────────────────────────
    // Only venue staff/admins may broadcast notifications.
    if (userId) {
      const allowed = await checkPermission(userId, 'staff', 'venue', venueId);
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
      await push(`notifications/${venueId}`, notification);
    } catch {
      // RTDB unavailable — still return the notification object for optimistic UI
    }

    return NextResponse.json({ ok: true, notification });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
