import { NextRequest, NextResponse } from 'next/server';

// Dynamically import client SDK to avoid firebase-admin dependency
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pushToPath: ((path: string, data: unknown) => unknown) | null = null;
async function getPusher() {
  if (!pushToPath) {
    const mod = await import('@/lib/firebase');
    pushToPath = mod.pushToPath;
  }
  return pushToPath!;
}

export async function POST(req: NextRequest) {
  try {
    const { venueId, section, message, type, title } = await req.json();

    if (!message || !venueId) {
      return NextResponse.json({ ok: false, error: 'venueId and message required' }, { status: 400 });
    }

    const notification = {
      id: `notif-${Date.now()}`,
      type: type ?? 'info',
      title: title ?? 'Staff Broadcast',
      message,
      section: section ?? 'all',
      timestamp: Date.now(),
      read: false,
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
