import Link from "next/link";
import { auth } from "@clerk/nextjs/server";

import { HeroTerminal } from "@/components/site/hero-terminal";
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
  "See which personalized rule your audience actually matched — owner-side insights with zero viewer tracking.",
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
      "Yes — four paths. Drop the Linky MCP into Cursor, Claude Desktop, Codex, Continue, or Cline with a paste-ready mcp.json and your agent can call create, update, list, insights, and key management as first-class tools. Or use the public HTTP API, the CLI, or the npm SDK directly — every surface shares one service layer, so the shapes match. See /docs/mcp for the MCP config snippets.",
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
  {
    question: "Can a team share Linky launch bundles?",
    answer:
      "Yes. Switch to your org workspace and every Linky you create is team-owned. Teammates are mapped to one of three roles — admin, editor, viewer — derived from their Clerk org role. Admins delete and manage keys, editors edit, viewers read. Role changes happen in Clerk; Linky mirrors them through webhooks. Full role model at /docs/access-control.",
  },
  {
    question: "How do I see whether my personalized Linky is working?",
    answer:
      "Open any launch bundle in the dashboard and click Insights. You see views, unique viewer-days, Open All clicks, and the per-rule breakdown — did the engineering rule match, or did everyone fall through to the public bundle? No destination-tab tracking, no viewer cookies. Owner questions only: did my audience arrive, and did the right rule match?",
  },
  {
    question: "Is it safe to put a Linky API key in an LLM's context?",
    answer:
      "Pick a read-only scope at mint time. Linky keys carry one of three scopes — links:read, links:write, or keys:admin — and scope is locked at mint. A read-only key can list and view bundles, read insights, and nothing else. If the key leaks from an agent transcript, the blast radius is exactly what you chose up front.",
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

        {/*
          Hero lockup. The outer <section> is a bare grid — NO `.site-hero`
          class — so nothing caps its width. The class's `max-width: 46rem`
          in globals.css was winning against `lg:max-w-none` at equal
          specificity, capping the section at 736px and wrapping the H1
          onto four lines. Instead:
            - Section owns vertical rhythm via `mb-[clamp(2.5rem,6vw,4.5rem)]`
              (matches what `.site-hero` provided globally).
            - Inner copy column re-applies the 46rem cap as a Tailwind
              arbitrary (`max-w-[46rem]`) purely as a reading-measure
              constraint for the prose — no margin/cascade side effects.
            - Terminal column is a fixed 28rem track, so the square's
              visual weight rhymes with the H1.
          Below lg the grid collapses to a single column; H1 + lead + CTAs
          still land first on mobile.
        */}
        <section className="mb-[clamp(2.5rem,6vw,4.5rem)] grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:gap-14">
          <div className="site-hero-copy min-w-0 max-w-[46rem]">
          {/*
            Kicker now surfaces the three strongest, plain-English anchors
            (OSS, agent-first, MIT) instead of the abstract
            "launch orchestration" category label. First thing a visitor
            reads, and it tells them what shelf Linky sits on.
          */}
          <p className="terminal-label mb-4">
            Open source · Agent-first · MIT
          </p>
          {/*
            H1 is now a four-word, fragment-style tagline. The many->one
            parallel IS the product in a single visual beat, the brand is
            in the H1, and a stranger doesn't need an LOTR reference to
            parse it. Previous tagline ("One Linky to open them all.")
            carried a cleverness tax + an ambiguous "them" pronoun — fine
            once you know the product, but a drag for first-time readers.
          */}
          <h1 className="display-title mb-5 text-5xl leading-[0.9] font-semibold text-foreground sm:text-6xl">
            Many URLs. One Linky.
          </h1>

          {/*
            Two-line lead, deliberately split:
              - Line 1 (large, un-muted) names the outcome: a short link
                that opens every tab, for any caller. Avoids restating
                the H1's many->one frame — that would be tautological
                now that the H1 carries it directly.
              - Line 2 (smaller, muted) carries the "how + where" — what
                you actually do with Linky and the surfaces it works on.
            Splits comprehension into two scannable beats instead of
            cramming the verb + audience + outcome into one sentence
            (the Sweep-1 "sentence trying to say too much" trap).
          */}
          <p className="site-hero-lead max-w-3xl text-xl leading-snug font-medium text-foreground sm:text-2xl">
            One short link that opens every tab — for humans or agents
            alike.
          </p>
          <p className="terminal-muted mt-3 max-w-3xl text-base leading-relaxed sm:text-lg">
            Paste your list, share the link. Works the same in any
            browser, CLI, or agent prompt.
          </p>

          {/*
            Earlier drafts had a three-bullet benefit strip + a
            personalization paragraph sitting between the lead and the
            CTAs. Both were pulled because the H1 + two-line lead now
            carry the whole "what is this, what does it do" argument —
            the bullets were restating it in lower-weight prose. Net-new
            info those sections carried has moved:
              - "Free / no signup / MIT-licensed" → microcopy under the
                CTAs, where anxiety-reducers land at the conversion
                moment instead of padding the hero.
              - Personalization detail → already covered in three FAQ
                entries lower on the page. Trust the FAQ to carry it.
          */}
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
                  Primary signed-out CTA points at the live demo
                  (anonymous, zero-friction). Matches the anonymous-
                  creation positioning — fastest path to value is the
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

          {/*
            Sub-CTA reassurance line. Keeps the three anxiety-reducers
            adjacent to the conversion moment:
              - "No signup, no credit card" — confirms the free/anon
                promise right next to the primary CTA.
              - "MIT-licensed, self-host anytime" — escape-hatch
                reassurance for the OSS-preferring crowd.
            Kept intentionally small (terminal-muted, xs) so it reads
            as legal-style reassurance rather than competing with the
            CTAs themselves.
          */}
          <p className="terminal-muted mt-3 text-xs sm:text-sm">
            No signup, no credit card. MIT-licensed — self-host anytime.
          </p>
          </div>

          {/*
            Hero animation column. `HeroTerminal` owns its own 1:1
            aspect-ratio box and scanline scrim; the wrapper just caps
            the mobile width so the square doesn't swallow a phone
            screen. On desktop the parent grid track (~28rem) drives
            the size so the terminal's visual weight matches the H1.
            Sticky positioning was dropped — in a single-fold hero it
            pinned the terminal high and broke vertical alignment
            against the copy.
          */}
          <div className="site-hero-art mx-auto w-full max-w-xs sm:max-w-sm lg:mx-0 lg:max-w-none">
            <HeroTerminal />
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
