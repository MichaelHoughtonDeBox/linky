import { SignUp } from "@clerk/nextjs";

import { SiteHeader } from "@/components/site/site-header";

// Clerk catch-all: handles all intermediate flow URLs (email verification,
// SSO callbacks, etc.) without us having to manage sub-routes. The bracketed
// segment name `sign-up` is purely convention; it does not need to match any
// Clerk config — only the mounted URL itself must match the configured
// NEXT_PUBLIC_CLERK_SIGN_UP_URL env variable (defaults to /signup).
export default function SignUpPage() {
  return (
    <div className="terminal-stage flex flex-1 items-start justify-center px-5 py-5 sm:py-6">
      <main className="site-shell w-full max-w-4xl p-5 sm:p-6 lg:p-7">
        <SiteHeader currentPath="/signup" />

        <section className="site-hero">
          <p className="terminal-label mb-3">Sign up</p>
          <h1 className="display-title mb-3 text-4xl leading-[0.95] font-semibold text-foreground sm:text-5xl">
            Create a Linky account
          </h1>
          <p className="terminal-muted max-w-2xl text-sm leading-relaxed sm:text-base">
            Accounts let you save, edit, and share your launch bundles across
            devices, claim bundles an agent created for you, and collaborate
            in teams. An account also unlocks the personalized tabs on any
            Linky whose owner has attached rules for you.
          </p>

          <div className="mt-6 flex justify-center sm:justify-start">
            <SignUp
              routing="path"
              path="/signup"
              signInUrl="/signin"
              // `fallbackRedirectUrl` is used when no `redirect_url` query
              // param is present. This lets upstream flows (like the claim
              // page) round-trip through sign-up while still defaulting to
              // the dashboard for direct visits.
              fallbackRedirectUrl="/dashboard"
            />
          </div>
        </section>
      </main>
    </div>
  );
}
