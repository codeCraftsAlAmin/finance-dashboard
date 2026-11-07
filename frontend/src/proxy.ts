import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Must match COOKIE_NAME in the API settings.
const SESSION_COOKIE = "access_token";

/**
 * Optimistic check only: it sends visitors without a session cookie to the login page
 * before any HTML is served. The API still verifies the token on every request, and the
 * dashboard handles an expired token itself.
 */
export function proxy(request: NextRequest) {
  if (!request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/overview/:path*", "/money/:path*", "/bills/:path*", "/loans/:path*", "/books/:path*", "/dates/:path*", "/learn/:path*", "/challenges/:path*", "/vault/:path*"],
};
