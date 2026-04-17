import Link from "next/link";
import { auth } from "@clerk/nextjs/server";

import { LiveLinkyDemo } from "@/components/site/live-linky-demo";
import { SiteHeader } from "@/components/site/site-header";
import { WorksWithStrip } from "@/components/site/works-with-strip";

const USE_CASES = [
  "Launch PR review bundles for standups and release trains.",
  "Run incident response checklists from one shareable URL.",
  "Hand off full context packs between agents and teammates.",
  "Package research sessions for demos, clients, and async updates.",
  "Ship a single team standup Linky — each teammate opens their own queue, drafts, and inbox from the same URL.",
  "Route signed-in partners to partner-scoped URLs while staff open internal runbooks from the same Linky.",
];

const FAQ_ITEMS = [
  {
    question: "What can I bundle into a Linky?",
    answer:
      "Any valid http or https URL. Paste links from docs, dashboards, tickets, repos, and runbooks.",
  },
  {
    question: "Do I need an account?",
    answer:
      "No. Anonymous creation stays free and frictionless — every POST /api/links without auth still returns a claim URL so you can bind the Linky to an account later. Accounts unlock editing, renaming, team workspaces, and version history.",
  },
  {
    question: "Can my agent create Linky links directly?",
    answer:
      "Yes. Agents can call the public API, run the CLI, or use the npm package API.",
  },
  {
    question: "What happens when someone opens a Linky URL?",
    answer:
      "They land on /l/[slug], click Open All, and launch every saved tab with manual fallback links if popups are blocked.",
  },
  {
    question: "How does personalization work?",
    answer:
      "Attach a resolution policy to any Linky. On every click, rules evaluate the viewer's Clerk identity — email, email domain, user id, GitHub login, Google email, org memberships — and the launcher opens the matching tab set. Unmatched viewers and anonymous viewers fall through to the public launch bundle, so the same URL stays safe to share publicly.",
  },
  {
    question: "Do viewers need an account to see personalized tabs?",
    answer:
      "No account is needed for the public bundle — it opens for anyone. To see a personalized tab set the viewer signs in with Clerk, and the launcher nudges them when a policy is in play but they haven't signed in yet.",
  },
  {
    question: "Can my agent attach a policy when creating a Linky?",
    answer:
      "Yes. POST /api/links accepts an optional resolutionPolicy in the same request, and the CLI exposes linky create ... --policy file.json (use --policy - to pipe from stdin). The Linky is locked down from the first click — no window where an unrestricted version is live. Anonymous Linkies are immutable until claimed, so if your agent attaches a policy without signing in, pass email alongside it so the claim URL lands with the eventual human owner.",
  },
];

export default async function Home() {
  // Resolve auth state server-side so the hero CTAs render correctly on
  // first paint — no client-hydration flash, and no reliance on Clerk's
  // browser JS mounting before the buttons make sense. (Client-side
  // hydration can fail entirely if Clerk DNS / TLS isn't fully configured
  // on a new production instance; server-side `auth()` is unaffected.)
  const session = await auth();
  const isSignedIn = Boolean(session.userId);

  return (
    <div className="terminal-stage flex flex-1 items-start justify-center px-5 py-5 sm:py-6">
      <main className="site-shell w-full max-w-6xl p-5 sm:p-6 lg:p-7">
        <SiteHeader currentPath="/" />

        <section className="site-hero">
          <p className="terminal-label mb-3">Agent-first launch orchestration</p>
          <h1 className="display-title mb-3 text-5xl leading-[0.9] font-semibold text-foreground sm:text-6xl">
            One Linky to open them all.
          </h1>
          <p className="terminal-muted max-w-3xl text-sm leading-relaxed sm:text-base">
            Give Linky a list of URLs and get back one short launcher link.
            Purpose-built for agents, workflows, and fast context handoffs.
          </p>
          <p className="terminal-muted mt-2 max-w-3xl text-sm leading-relaxed sm:text-base">
            Attach a policy and the same Linky opens different tabs for
            different viewers — identity resolves at click time, unmatched
            viewers get the public bundle.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/docs" className="terminal-secondary px-4 py-2 text-sm">
              Read docs
            </Link>
            {isSignedIn ? (
              <Link
                href="/dashboard"
                className="terminal-action px-4 py-2 text-sm"
              >
                Open dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/signin"
                  className="terminal-action px-4 py-2 text-sm"
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="terminal-secondary px-4 py-2 text-sm"
                >
                  Create account
                </Link>
              </>
            )}
          </div>
        </section>

        <LiveLinkyDemo />
        <WorksWithStrip />

        <section className="site-section">
          <h2 className="display-title mb-4 text-2xl font-semibold text-foreground sm:text-3xl">
            Use cases
          </h2>
          <div className="site-divider-list">
            {USE_CASES.map((item) => (
              <article key={item} className="site-divider-item">
                <p className="terminal-muted text-sm leading-relaxed">{item}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="site-section">
          <h2 className="display-title mb-4 text-2xl font-semibold text-foreground sm:text-3xl">
            FAQ
          </h2>
          <div className="site-divider-list">
            {FAQ_ITEMS.map((item) => (
              <article key={item.question} className="site-divider-item">
                <h3 className="mb-2 text-sm font-semibold text-foreground sm:text-base">
                  {item.question}
                </h3>
                <p className="terminal-muted text-sm leading-relaxed">
                  {item.answer}
                </p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
