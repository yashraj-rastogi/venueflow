import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

function getAdminDb() {
  if (!getApps().length) {
    initializeApp({
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    });
  }
  return getDatabase(getApp());
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
      const db = getAdminDb();
      await db.ref(`notifications/${venueId}`).push(notification);
    } catch {
      // RTDB unavailable — still return the notification object for optimistic UI
    }

    return NextResponse.json({ ok: true, notification });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
