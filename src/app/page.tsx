import Link from "next/link";
import { auth } from "@clerk/nextjs/server";

import { LiveLinkyDemo } from "@/components/site/live-linky-demo";
import { SiteHeader } from "@/components/site/site-header";
import { WorksWithStrip } from "@/components/site/works-with-strip";

// Ordered per product-marketing-context.md: lead with the solo / agent-native
// motion (primary persona), then team use cases. The old ordering buried the
// indie hacker / agent-native story behind PR review + incident response.
const USE_CASES = [
  "Hand off full context packs between agents and teammates — one URL replaces a wall of links.",
  "Package a research session for a demo, a client, or an async update. Send the URL, skip the screenshots.",
  "Give every agent task a clean ending: one Linky instead of 10+ URLs in chat.",
  "Launch PR review bundles for standups and release trains.",
  "Run incident-response checklists from one shareable URL — no hunting for tabs.",
  "Ship a single team standup Linky — each teammate opens their own queue, drafts, and inbox from the same URL.",
  "Route signed-in partners to partner-scoped URLs while staff open internal runbooks from the same Linky.",
];

// Reordered so the first three FAQs answer the questions a brand-new reader
// hits first ("what is this? do I need an account? what happens when I click
// a Linky?"), and the agent / policy depth sits after that baseline.
const FAQ_ITEMS = [
  {
    question: "What can I bundle into a Linky?",
    answer:
      "Any valid http or https URL. Paste links from docs, dashboards, tickets, repos, and runbooks. The backend normalizes and de-dupes them for you.",
  },
  {
    question: "Do I need an account?",
    answer:
      "No. Anonymous creation is free and frictionless — every create call returns a claim URL so you can bind the Linky to an account later. Accounts unlock editing, renaming, team workspaces, and version history. If you'd rather own the whole thing end-to-end, the repo is MIT-licensed — clone it, self-host on Vercel + Neon, and run your own Linky instance.",
  },
  {
    question: "What happens when someone opens a Linky URL?",
    answer:
      "They land on the launcher page, click Open All, and every saved tab fires. If the browser blocks popups, manual fallback links are right there — nobody gets stranded.",
  },
  {
    question: "Can my agent create Linky links directly?",
    answer:
      "Yes. Agents can call the public HTTP API, run the CLI, or use the npm SDK. A Cursor / Claude Code skill is already shipped, and an MCP server is on the roadmap.",
  },
  {
    question: "How does personalization work?",
    answer:
      "Attach a resolution policy to any Linky. On every click, rules evaluate the viewer's signed-in identity — email, email domain, user id, GitHub login, Google email, org memberships — and the launcher opens the matching tab set. Unmatched and anonymous viewers fall through to the public launch bundle, so the same URL stays safe to share publicly.",
  },
  {
    question: "Do viewers need an account to see personalized tabs?",
    answer:
      "No account is needed for the public bundle — it opens for anyone. To see a personalized tab set the viewer signs in, and the launcher nudges them when a policy is in play but they haven't signed in yet.",
  },
  {
    question: "Can my agent attach a policy when creating a Linky?",
    answer:
      "Yes. The create endpoint accepts an optional resolutionPolicy in the same request, and the CLI exposes linky create ... --policy file.json (use --policy - to pipe from stdin). The Linky is locked down from the first click — no window where an unrestricted version is live. Anonymous launch bundles are immutable until claimed, so if your agent attaches a policy without signing in, pass email alongside it so the claim URL lands with the eventual human owner.",
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
          {/*
            Kicker now surfaces the three strongest, plain-English anchors
            (OSS, agent-first, MIT) instead of the abstract
            "launch orchestration" category label. First thing a visitor
            reads, and it tells them what shelf Linky sits on.
          */}
          <p className="terminal-label mb-4">
            Open source · Agent-first · MIT
          </p>
          <h1 className="display-title mb-5 text-5xl leading-[0.9] font-semibold text-foreground sm:text-6xl">
            One Linky to open them all.
          </h1>

          {/*
            New plain-English lead. Replaces the old "launch orchestration"
            paragraph. Goal: a brand-new visitor understands what Linky does
            within the first 15 seconds — concrete verb, concrete artifact.
          */}
          <p className="terminal-muted max-w-3xl text-base leading-relaxed sm:text-lg">
            Bundle many URLs into one short launch link. Share it so agents
            and humans can hand off full context at scale — one click, every
            tab opens.
          </p>

          {/*
            Three-bullet benefit strip. The user's explicit ask: "put the
            benefits out very, very soon." Each line answers a "so what?"
            question a new reader has on first paint.
          */}
          <ul className="site-benefit-strip mt-6">
            <li className="site-benefit-item">
              <span className="site-benefit-marker" aria-hidden="true">
                ›
              </span>
              <span>
                <strong className="text-foreground">
                  Many URLs in, one short URL out.
                </strong>{" "}
                <span className="terminal-muted">
                  No more walls of links in chat.
                </span>
              </span>
            </li>
            <li className="site-benefit-item">
              <span className="site-benefit-marker" aria-hidden="true">
                ›
              </span>
              <span>
                <strong className="text-foreground">
                  Humans and agents share the same Linky.
                </strong>{" "}
                <span className="terminal-muted">
                  One click opens every saved tab — from any browser, CLI, or
                  agent prompt.
                </span>
              </span>
            </li>
            <li className="site-benefit-item">
              <span className="site-benefit-marker" aria-hidden="true">
                ›
              </span>
              <span>
                <strong className="text-foreground">
                  Free and open source.
                </strong>{" "}
                <span className="terminal-muted">
                  Anonymous creation by default — no signup to ship your
                  first Linky. Self-host if you prefer.
                </span>
              </span>
            </li>
          </ul>

          {/*
            Personalization kept in-hero but demoted to a smaller, optional
            "Need more?" line. Strips the "identity resolves at click time"
            jargon that was blocking comprehension for new readers.
          */}
          <p className="terminal-muted mt-6 max-w-3xl text-sm leading-relaxed sm:text-base">
            Need per-viewer tabs? Attach a policy and the same Linky opens a
            different bundle for each viewer — still safe to share publicly,
            since unknown viewers fall through to the public bundle.
          </p>

          <div className="site-hero-cta-row mt-7 flex flex-wrap gap-2">
            {isSignedIn ? (
              <>
                <Link
                  href="/dashboard"
                  className="terminal-action px-4 py-2 text-sm"
                >
                  Open dashboard
                </Link>
                <Link
                  href="#demo"
                  className="terminal-secondary px-4 py-2 text-sm"
                >
                  Try it now ↓
                </Link>
                <Link
                  href="/docs"
                  className="terminal-secondary px-4 py-2 text-sm"
                >
                  Read docs
                </Link>
              </>
            ) : (
              <>
                {/*
                  Primary signed-out CTA now points at the live demo
                  (anonymous, zero-friction). That matches the anonymous-
                  creation positioning — the fastest path to value is the
                  textarea below the fold, not a Clerk sign-in dialog.
                */}
                <Link
                  href="#demo"
                  className="terminal-action px-4 py-2 text-sm"
                >
                  Try it now ↓
                </Link>
                <Link
                  href="/docs"
                  className="terminal-secondary px-4 py-2 text-sm"
                >
                  Read docs
                </Link>
                <Link
                  href="/signup"
                  className="terminal-secondary px-4 py-2 text-sm"
                >
                  Sign up free
                </Link>
              </>
            )}
          </div>
        </section>

        <LiveLinkyDemo />
        <WorksWithStrip />

        <section className="site-section">
          <div className="site-section-lede mb-5">
            <p className="terminal-label mb-2">Who it&apos;s for</p>
            <h2 className="display-title text-2xl font-semibold text-foreground sm:text-3xl">
              Built for agent sessions and team rituals.
            </h2>
          </div>
          <div className="site-divider-list">
            {USE_CASES.map((item) => (
              <article key={item} className="site-divider-item">
                <p className="terminal-muted text-sm leading-relaxed sm:text-base">
                  {item}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="site-section">
          <div className="site-section-lede mb-5">
            <p className="terminal-label mb-2">FAQ</p>
            <h2 className="display-title text-2xl font-semibold text-foreground sm:text-3xl">
              The questions people ask first.
            </h2>
          </div>
          <div className="site-divider-list">
            {FAQ_ITEMS.map((item) => (
              <article key={item.question} className="site-divider-item">
                <h3 className="mb-3 text-sm font-semibold text-foreground sm:text-base">
                  {item.question}
                </h3>
                <p className="terminal-muted text-sm leading-relaxed sm:text-base">
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
