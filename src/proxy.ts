// Next.js 16 renamed `middleware.ts` to `proxy.ts`. The default export must
// be named `proxy` or be a default export whose runtime shape matches a Next
// middleware (request, event) => Response | void. Clerk's `clerkMiddleware()`
// returns exactly that shape, so we can use it here directly.
//
// LOCATION: this file MUST sit next to `app/` — in this project that means
// `src/proxy.ts`, NOT the repo root. Next.js only picks up the proxy when
// it's co-located with the app dir. Clerk surfaces a very specific error
// when you get this wrong ("clerkMiddleware() was not run, your middleware
// or proxy file might be misplaced"), so if you ever see that, check here
// first.
//
// See: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
//
// NOTE: Proxy defaults to the Node.js runtime in Next.js 16. Do NOT set a
// `runtime` config option here — it will throw at build time.

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Dashboard stays Clerk-native. API routes get finer-grained handling below so
// bearer-auth automation can coexist with browser sessions.
const isProtectedDashboardRoute = createRouteMatcher(["/dashboard(.*)"]);

// Methods that mutate an owned Linky. POST remains public (anonymous create).
// We cannot gate solely by path for `/api/links/:slug` because the resolver
// may be called via GET in the future; method-aware gating keeps it simple.
const MUTATING_METHODS = new Set(["PATCH", "DELETE"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedDashboardRoute(req)) {
    await auth.protect();
    return;
  }

  // Protect owner-only API methods while still admitting bearer-auth requests
  // (API keys for CLI / SDK / future MCP). Dashboard pages remain Clerk-only
  // above; this branch is API-only.
  const hasBearerToken = /^Bearer\s+\S+/i.test(
    req.headers.get("authorization") ?? "",
  );

  // Protect PATCH/DELETE on `/api/links/:slug` without blocking the public
  // create endpoint (POST /api/links). This keeps the anonymous flow open.
  const isLinkyMutation =
    MUTATING_METHODS.has(req.method) &&
    /^\/api\/links\/[^/]+$/.test(req.nextUrl.pathname);

  if (isLinkyMutation) {
    if (hasBearerToken) return;
    await auth.protect();
  }

  if (
    req.method === "GET" &&
    /^\/api\/links\/[^/]+\/versions$/.test(req.nextUrl.pathname)
  ) {
    if (hasBearerToken) return;
    await auth.protect();
  }

  // Sprint 2.7 Chunk B: GET /api/links/:slug/insights is owner+role gated
  // via `requireCanViewLinky` inside the route. Edge-gate here ensures the
  // handler is only reached for signed-in users or bearer-auth callers —
  // keeps 401 surfacing consistent with the other owner routes.
  if (
    req.method === "GET" &&
    /^\/api\/links\/[^/]+\/insights$/.test(req.nextUrl.pathname)
  ) {
    if (hasBearerToken) return;
    await auth.protect();
  }

  if (req.method === "GET" && req.nextUrl.pathname === "/api/me/links") {
    if (hasBearerToken) return;
    await auth.protect();
  }

  if (/^\/api\/me\/keys(?:\/\d+)?$/.test(req.nextUrl.pathname)) {
    if (hasBearerToken) return;
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
  ],
};
