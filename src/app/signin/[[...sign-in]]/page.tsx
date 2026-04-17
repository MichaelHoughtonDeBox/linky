import { SignIn } from "@clerk/nextjs";

import { SiteHeader } from "@/components/site/site-header";

// Mirror of /signup for returning users. Clerk's catch-all handles the
// various intermediate redirects (magic link, SSO callback, etc.).
export default function SignInPage() {
  return (
    <div className="terminal-stage flex flex-1 items-start justify-center px-5 py-5 sm:py-6">
      <main className="site-shell w-full max-w-4xl p-5 sm:p-6 lg:p-7">
        <SiteHeader currentPath="/signin" />

        <section className="site-hero">
          <p className="terminal-label mb-3">Sign in</p>
          <h1 className="display-title mb-3 text-4xl leading-[0.95] font-semibold text-foreground sm:text-5xl">
            Welcome back
          </h1>
          <p className="terminal-muted max-w-2xl text-sm leading-relaxed sm:text-base">
            Sign in to manage your launch bundles, edit their URLs and
            metadata, and collaborate on team bundles. Signing in also
            unlocks the personalized tabs on any Linky whose owner has
            attached rules for you.
          </p>

          <div className="mt-6 flex justify-center sm:justify-start">
            <SignIn
              routing="path"
              path="/signin"
              signUpUrl="/signup"
              // `fallbackRedirectUrl` honors upstream `redirect_url` query
              // params (used by the claim flow) and falls back to the
              // dashboard for direct sign-ins.
              fallbackRedirectUrl="/dashboard"
            />
          </div>
        </section>
      </main>
    </div>
  );
}
