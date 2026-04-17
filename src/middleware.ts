import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Admin route protection: check for a simple session token or fallback for demo
  // In a robust implementation, use Firebase Admin SDK to check the session cookie
  // For this MVP, we rely on the client-side component to kick out non-admins, 
  // but we provide a middleware stub for future cookie-based protection.
  
  // If the user clears the "auth_dismissed" flag, let them see the modal.
  const isAuthPage = request.nextUrl.pathname === '/admin';
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
