import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Admin route protection stub.
// Client-side useAuth handles the actual redirect in the component.
// This file is the Next.js 16+ replacement for middleware.ts.
export async function proxy(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
