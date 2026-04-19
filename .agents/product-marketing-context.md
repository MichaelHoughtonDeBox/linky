# Product Marketing Context

*Last updated: 2026-04-17*
*Status: **V1.5 — hero tagline swapped. Canonical tagline is now "Many URLs. One Linky." (was "One Linky to open them all.") after the hero-clarity pass that shipped in PRs #9 + #10. In-voice and Customer Language examples updated to match what's actually on the landing page.** OSS + hosted framing still locked in. Monetization intentionally honest ("TBD, likely hosted features"). Customer Language section is intentionally aspirational until real users land; exact paid-tier scope is deliberately undecided. All other sections are locked. Anything concrete (architecture, trust policy, terminology) was lifted verbatim from the repo. Anchor doc for other marketing skills (copy-editing, copywriting, etc.) to reference.*

---

## Product Overview

**One-liner:**
Linky turns many URLs into one short launch link. Open source, agent-first.

**What it does:**
Give Linky a list of URLs and get back one short URL. Share it. Recipients land on a launcher page, click **Open All**, and every saved tab fires — with manual fallback links when popups are blocked. Attach a resolution policy and the same Linky opens a different tab set per viewer based on their Clerk identity (email, email domain, GitHub login, Google email, org membership), while anonymous and unmatched viewers fall through to the public bundle.

The whole codebase is MIT-licensed on GitHub. Use the hosted product at `getalinky.com` or self-host on your own Vercel + Neon — both paths are first-class.

**Product category (internal framing — not user-facing copy):**
"Agent-first launch orchestration." Sits on a new shelf between three adjacent categories customers search:
- Link shorteners (Bitly, Dub.co, Short.io) — but Linky bundles N URLs per short link, not 1.
- Tab-group / session managers (OneTab, Toby, Workona, Tab Session Manager) — but Linky is a shareable URL, not a local browser extension.
- Link-in-bio / link hubs (Linktree, Beacons) — but Linky launches tabs on click, not a landing page menu, and is built for devs + agents, not creators.

**Product type:**
Open-source developer + agent tooling with an optional hosted offering. Web app + public HTTP API + CLI + npm SDK + Cursor skill. SaaS-adjacent — the primitive is free and anonymous by default on the hosted product, free forever if you self-host, with accounts and teams layered on via Clerk.

**Business model:**
Open source + hosted. Monetization is genuinely undecided.

**The product is OSS (MIT license).** The whole codebase — API, launcher, dashboard, CLI, SDK, resolution-policy engine — is in the public GitHub repo. Anyone can clone it, run `npm run db:migrate`, deploy to Vercel + Neon, and operate their own Linky instance. **Self-hosting is free. Forever. That's the license.**

**The hosted offering at `getalinky.com` is where monetization will live.** We haven't decided the exact shape yet. Working hypothesis:

- **Anonymous creation on `getalinky.com` stays free** — load-bearing for the agent distribution story. An agent needs to be able to emit a Linky with zero signup. Rate-limited, permanent, immutable (as shipped).
- **Features beyond free link creation will likely be paid** on the hosted product — editing, renaming, history, identity-aware resolution, analytics, clean launcher (no "Made with Linky" footer), custom branding, team workspaces. The exact split is TBD.
- **Shape of the paid offer:** likely a single flat fee (working figure ~$9/month for full hosted access) rather than per-seat, per-Linky, or per-view metering. Rationale: the audience hates SaaS friction.
- **If you don't want to pay:** self-host. Clone the repo, ship it. MIT license, no strings.

Stripe direct billing is scaffolded in Sprint 1 (Customers minted per user and per org on Clerk webhooks) — no prices defined, no paid tier live yet.

**How to talk about this publicly (copy guidance):**
- **Do** frame Linky as OSS first, hosted second. "Open source. Use it. Host it yourself or let us run it for you."
- **Do** name the MIT license. It's a differentiator vs. Bitly / Linktree / OneTab — none of those are OSS.
- **Do** be honest that monetization is TBD. "Eventually the hosted product will charge for advanced features. For now, everything works." The audience rewards that candor.
- **Don't** claim a specific price, tier structure, or launch date until it's shipped. The $9 figure is a working hypothesis, not a commitment.
- **Don't** pretend the free tier is a trial. It's the actual product — either hosted-free (for anonymous creation) or self-host-free (for everything).

**Product maturity:**
Brand new — built in the last ~36 hours. No customer metrics, no case studies, no testimonials yet. Marketing copy should reflect that honestly: **built in public, open source, agent-first, early days, shipping fast.**

---

## Target Audience

**Who Linky is for:**
Agent-native builders. Individuals, not teams. Not buying on behalf of an org — buying for their own toolbelt.

- **Indie hackers** shipping side projects and solo SaaS.
- **Claude Code users** — power users who already live inside an agent and want every tool in their workflow to speak the same language.
- **Cursor users / Cursor skill adopters** — devs installing skills to their agents, looking for primitives their agents can emit.
- **OpenCode / Codex / Windsurf / VS Code agent users** — same pattern, different surface.
- **Vibe coders & "Twitter coding bros"** — the X/Twitter cohort posting agent workflows, skill stacks, and CLI screenshots. They are both the audience *and* the distribution channel.
- **Agentic coding people** — anyone whose daily loop involves prompting an agent and handing URLs back and forth.
- **Founders shipping in public** — small teams or solo founders who need a clean, shareable artifact for "here's everything from this session."
- **Anyone adding skills to their agents** — the skill marketplace audience. If they're reading a README that starts with `npx skills add`, they're our person.

**Decision-maker = user = buyer.**
No enterprise procurement. No devex committee. One person, one decision, one credit card. Convert by being obviously useful to the individual inside the first Linky they create.

**Primary use case:**
An agent returns a pile of URLs at the end of a task. The user wants one artifact — a single short URL — they can save, share, or hand off to the next agent in their loop.

**Jobs to be done:**
- "When my agent finishes a task, give me one URL instead of a wall of links."
- "When I hand off a session to another agent (or future-me), package the whole context as one artifact."
- "When I post my workflow on Twitter / X, give me one URL to show instead of a screenshot of 12 tabs."
- "When I'm building a skill for my own agent stack, give me a primitive it can emit that looks as good as the rest of my setup."

**Use cases (landing page, verbatim — reordered in PR #9 to lead with the indie / agent motion):**
- Hand off full context packs between agents and teammates — one URL replaces a wall of links.
- Package a research session for a demo, a client, or an async update. Send the URL, skip the screenshots.
- Give every agent task a clean ending: one Linky instead of 10+ URLs in chat.
- Launch PR review bundles for standups and release trains.
- Run incident-response checklists from one shareable URL — no hunting for tabs.
- Ship a single team standup Linky — each teammate opens their own queue, drafts, and inbox from the same URL.
- Route signed-in partners to partner-scoped URLs while staff open internal runbooks from the same Linky.

*Note: team/enterprise use cases are real but are a secondary motion. Lead with the solo/agent-native jobs.*

---

## Personas

Linky is a **prosumer developer tool**. Individuals buy, individuals use. Persona set is tight on purpose:

| Persona | Cares about | Challenge | Value we promise |
|---|---|---|---|
| **The agent-native indie hacker** (primary) | Shipping solo, clean tooling, small bills, agent workflows | Their Claude Code / Cursor / OpenCode agent keeps spitting out 10+ URLs per task that land in chat and die there | One URL from every agent task. Free to start, $9 flat when they want the full feature set |
| **The skill-adder / agent power user** (primary) | Making their agent stack *feel* as sharp as it reads on Twitter | No clean way for their agent to return "here's the session" without a wall of links | A first-class primitive their agent can emit — skill, CLI, SDK, API. Agent output that finally looks the way they want |
| **The building-in-public founder** (primary) | Shipping, being seen shipping, sharable artifacts | Every demo / async update is a mess of URLs; each viewer opens a random subset | One short URL per session. Personalize later with policies if they want. Post it once, it just works |
| **The Twitter coding bro / vibe coder** (amplifier) | Workflow aesthetics, agent screenshots, tool-stack posts | Their posts need one concrete artifact to link to, not 12 browser tabs in a screenshot | A Linky URL is the shareable output of an agent session. The brand is terminal-aesthetic and that already matches their vibe |

**Anti-persona:**
- **Non-technical consumers** / link-in-bio creators / marketers building landing-page menus. Linky is not a landing page. Linktree / Beacons / Bento serve them better.
- **Enterprise devex teams** looking for an RFP-shaped, SSO-gated, audit-logged URL manager. Linky is deliberately frictionless and prosumer-priced. Enterprise is not the motion (now).
- **Analytics / attribution seekers.** Linky is low-surveillance by default. If the reader wants per-click tracker hops and UTM manipulation, they are shopping on the wrong shelf.
- **Anyone who wants one URL that redirects to one URL.** Use Bitly. Linky bundles.

---

## Problems & Pain Points

**Core problem:**
Agents, workflows, and humans constantly need to hand off many URLs as one artifact. Today you either paste a wall of 10+ links (which nobody opens), attach a doc full of links (which requires the receiver to click through one by one), or maintain a team bookmark bar (which goes stale the moment roles change). There is no compact, shareable, agent-friendly primitive for "launch this bundle of tabs."

**Why alternatives fall short:**
- **Link shorteners (Bitly, Dub.co)** are one-URL-in, one-URL-out. They don't bundle. Using 10 short links is 10 times the problem.
- **Link-in-bio (Linktree, Beacons)** require a click per destination and are built for creators with audiences, not developers with sessions.
- **Tab-group managers (OneTab, Toby, Workona)** are local browser extensions. The state lives on one device, not at a URL you can paste into Slack or return from a CLI.
- **Shared bookmark bars / team docs** go stale, can't personalize per viewer, and have no history.
- **Just pasting a list of URLs** works for 2–3 links and fails at 5+.

**What it costs them:**
- Lost context between agent handoffs (the LLM returns 12 links and the human opens 2).
- Meeting dead-time while everyone finds their own tabs for standup / release review / incident response.
- Stale runbooks because the bookmark bar belongs to one person who left.
- Security edges — partners see internal URLs because maintaining per-audience pages is too much work.

**Emotional tension:**
- Agents produce more output than humans can triage. Developers feel like they're drowning in links their own tools generated.
- Handing off a session to a teammate (or a future-self) feels like losing the thread. There's no "save state" primitive that survives the chat window.

---

## Competitive Landscape

**Direct competitors (same solution, same problem):**
- **OneTab / Toby / Workona** — bundle tabs, but as browser-local state. Linky is a URL you can paste anywhere, callable from an agent.
- **Tab Session Manager extensions** — same browser-local constraint.
- **Custom internal tools** (team bookmark pages, Notion link indexes) — high maintenance, no personalization, no agent API.

**Secondary competitors (different solution, same problem):**
- **Bitly / Dub.co / Short.io** — URL shorteners. They solve "one URL → shorter URL" not "N URLs → one URL."
- **Linktree / Beacons / Bento** — link hubs for creators, click-through menus, not tab launchers.
- **Notion / Coda pages with a link list** — handoff works but every recipient has to click through one by one; no Open All, no personalization.
- **Slack canvas / Google Docs** with pasted URLs — ubiquitous but inert.

**Indirect competitors (conflicting approach):**
- **Just sending the links in chat** — zero friction to create, maximum friction to open. Linky bets the receiver experience matters.
- **Per-audience static pages** (hand-built partner portals, customer hubs) — high engineering cost, no per-viewer personalization, no agent API.

**How each falls short, summarized:**
None of them are agent-callable (no public API + CLI + SDK + MCP), none of them bundle many URLs into one short launcher URL, and none of them resolve tab sets per viewer identity at click time.

### Competitive framing in public copy (locked in — anchor against alternatives)

Landing page, Twitter threads, and docs should **explicitly contrast Linky against the adjacent shelves** rather than pretending it's category-defining in a vacuum. The audience (indie hackers, agent-native builders) recognizes the adjacent tools by name and benefits from a crisp "Linky is not X, it's Y" framing.

Concrete contrast patterns to use:

- **vs. Bitly / Dub / Short.io** — "URL shorteners take one URL in and give one short URL back. Linky takes *many* URLs in and gives one short launcher URL back." Use when talking to devs who think "link tool = shortener."
- **vs. Linktree / Beacons / Bento** — "Link-in-bio pages show a menu and ask your viewer to click through. Linky opens all the tabs in one click. Built for agent sessions, not creator audiences."
- **vs. OneTab / Toby / Workona** — "Tab-group extensions live on your machine. Linky lives at a URL you can paste into chat, Slack, or an agent prompt."
- **vs. just pasting links in chat** — "Works fine for 2 URLs. Breaks at 5. Linky is one URL, always."
- **vs. all of the above (OSS angle)** — "And it's open source. Self-host on your own infra, or let us run it for you. The adjacent tools are closed boxes." Use when the audience is the self-hoster / agent-native crowd (most of our ICP).

Rules for using these contrasts:

1. **Never snipe.** Respect the adjacent tools — they're good at their job, their job just isn't this. Punching down on Bitly reads as insecure to the audience.
2. **Name the tool explicitly** (Bitly, Linktree, OneTab). Don't say "other URL tools" — the audience needs the concrete anchor to locate Linky mentally.
3. **One contrast per copy block**, not all four in a row. A Twitter thread uses one. A landing page can cycle through them across sections.
4. **The contrast always lands on a Linky-specific verb** (bundle, launch, personalize, hand off). Never end on "we're better."

---

## Differentiation

**Key differentiators:**
- **Open source (MIT).** Whole codebase on GitHub. Self-host for free, forever. No vendor lock-in. None of the adjacent tools (Bitly, Linktree, OneTab, Dub.co closed-source core) give you this. For the target audience — indie hackers and agent-native builders who value escape hatches — this is a first-rank differentiator, not a footnote.
- **Bundle, don't shorten.** N URLs → one short URL → one click opens all of them.
- **Agent-first surfaces.** Public HTTP API + CLI + npm SDK + Cursor skill + MCP (roadmap). Agents are a first-class caller, not an afterthought.
- **Identity-aware resolution.** Attach a policy and the same Linky opens a different tab set per viewer — evaluated server-side against their Clerk identity (email, email domain, user id, GitHub login, Google email, org memberships). Anonymous and unmatched viewers fall through to the public bundle, so the URL stays safe to share publicly.
- **Born-personalized at create time.** Agents can attach a policy in the same `POST /api/links` call — the Linky is locked down from the first click, with no window where an unrestricted version is live.
- **Claim flow for agent → human handoff.** An agent creates a Linky anonymously and returns a one-time claim URL; one click binds ownership to the human's Clerk account (org context wins).
- **Anonymous create is permanent + immutable.** No TTL, no anonymous-edit path. A URL you share with the world will never change under its readers. Trust model.
- **Append-only history.** Every edit (including policy edits) snapshots into `linky_versions`. Old state is preserved forever.
- **Low-surveillance primitive by default.** No tracker-hop redirects, no fingerprint cookies on anonymous viewers, no "did you read this?" pings on destination tabs. Analytics that ship will answer *owner* questions ("did my audience arrive?"), not *viewer* questions ("what is Alice doing right now?").

**How we do it differently:**
A Linky is a URL, not an extension. The primitive is public and free (rate-limited). Identity is strictly Clerk (no rolled-our-own SSO). The resolver is pure and previewable (authors run the same evaluator with a "Preview as" control). Ownership is immutable once claimed — the trust contract with viewers is explicit and documented.

**Why that's better:**
- **For agents**: one URL is a compact, chat-friendly artifact. Tools can emit it, tools can consume it.
- **For teams**: one URL per team ritual (standup, incident, release) with per-viewer personalization replaces a dozen stale bookmark bars.
- **For humans**: explainable trust — shared public URLs never change, history is append-only, personalization is transparent to owners and opaque-by-default to viewers (owner taxonomy stays private).

**Why customers choose us:**
- They want agents to return one artifact, not a wall of links.
- They want the same URL to work for different audiences without building per-audience pages.
- They want a primitive that's callable from a CLI + API + skill, not a UI-only SaaS.
- They want a shareable URL with a trust contract they can explain to their team.

---

## Objections

| Objection | Response |
|---|---|
| "Isn't this just a URL shortener?" | URL shorteners take one URL in and give one short URL back. Linky takes *many* URLs in and gives *one* short launcher URL back — clicking it opens every saved tab with one click. And it resolves per-viewer when you attach a policy. |
| "Why not just paste the links in Slack / chat / an email?" | Works fine for 2–3 links, fails at 5+ (recipients skim, open 1–2, move on). Linky is one artifact, one click, all tabs. Also works as a callable output from agents and CLIs. |
| "Do I have to create an account?" | No. Anonymous creation is free and frictionless. Accounts unlock editing, renaming, team workspaces, version history, and personalization. Agent-created Linkies include a one-time claim URL so you can bind ownership later. |
| "Won't sharing a personalized Linky leak internal URLs to the wrong people?" | Policies evaluate server-side against Clerk identity. Anonymous and unmatched viewers always fall through to the public bundle — they never see the personalized tabs. Rule names are private by default (owner taxonomy stays internal). |
| "What happens when a tab is dead / the URL changed?" | Edit the Linky. Every edit is append-only in `linky_versions` — old state is preserved forever, viewers see the new bundle immediately. |
| "Is this just going to track everyone who clicks?" | No. Linky is low-surveillance by default — no tracker-hop redirects, no fingerprint cookies on anonymous viewers, no cross-tab observability. Analytics that ship will answer owner questions ("did my audience arrive?"), not viewer questions. Per-URL wrapper redirects will be strictly opt-in, never on by default. |
| "We already use Bitly / Dub.co / OneTab — why switch?" | Different shelf. Keep those for what they do. Use Linky where you need: one URL that opens many tabs, callable from agents/CLIs, personalizable per viewer. |

**Anti-persona:**
- Non-technical consumers building link-in-bio pages (use Linktree).
- Teams that want one URL that *redirects* to one destination (use Bitly).
- Tab hoarders who want local-only session management (use Toby / OneTab).
- Anyone looking for a tracking / analytics / attribution tool — Linky is deliberately low-surveillance.

---

## Switching Dynamics

**Push (what drives them away from current solution):**
- Their agent keeps returning 10+ links per task and nobody opens them.
- Standup / release / incident rituals waste 3–5 minutes per person on "finding my tabs."
- The team bookmark bar goes stale every time someone changes role.
- Partner handoffs require hand-built per-partner pages — too expensive to maintain.

**Pull (what attracts them to Linky):**
- One short URL from any agent, CLI, script, or curl.
- One click → Open All → every tab fires.
- Same URL, different tabs per viewer, without building per-audience pages.
- Free + anonymous + permanent for the simple case on the hosted product.
- Open source (MIT). Self-host the whole thing for free if they prefer.
- Works with their existing agent stack (Cursor, Claude, ChatGPT, Codex, Copilot, Windsurf, VS Code, Warp).

**Habit (what keeps them stuck):**
- Default behavior of pasting URLs in chat.
- Local bookmark bars / extensions the team is already trained on.
- "We have a Notion page for that."

**Anxiety (what worries them about switching):**
- "Will the URL break if I edit it?" — No. Same slug, append-only history.
- "Will it track my viewers?" — No. Low-surveillance by default.
- "Will my agents actually pick it up?" — Yes. The Cursor skill, CLI, SDK, and MCP (roadmap) are the install path.
- "What if I want to change the tabs later?" — Sign in, claim, edit. Or attach a policy at create time and personalize per viewer.
- "Is it locked in?" — No. MIT license, whole codebase on GitHub. If the hosted product ever does something you don't like, clone the repo and run your own instance. The escape hatch is built in by design.
- "What if the company disappears?" — The code survives. OSS.

---

## Customer Language

**How they describe the problem (best guesses — validate with real users):**
- "My agent returned like 12 links and I opened 2 of them."
- "I need to hand this agent session to the next agent and there's no save state."
- "Every Twitter post of my workflow is a screenshot of 14 tabs."
- "I want my agent's output to look as clean as the rest of my setup."
- "I don't want another SaaS with seats. Just charge me nine bucks."

**How they describe Linky (aspirational — from the landing page + README):**
- "Many URLs. One Linky." *(H1 on the landing page as of PR #10 — the canonical four-word tagline)*
- "One short link that opens every tab — for humans or agents alike." *(hero lead, post PR #10)*
- "One launch bundle, one short URL."
- "The agent returns one URL instead of a pile."

**Words to use:**
- **Linky** (singular, capitalized) — the brand, the short URL, the verb ("create a Linky").
- **launch bundle(s)** — the plural in prose ("your launch bundles", "team-owned bundles", "no bundles yet").
- **launcher page** — the `/l/[slug]` page with the Open All button.
- **Open All** — the action on the launcher page.
- **claim URL / claim flow** — the agent-to-human handoff.
- **identity-aware resolution** — the per-viewer tab personalization feature.
- **agent-first** — framing for copy that respects LLM / CLI callers.
- **bundle**, **orchestrate**, **launch**, **hand off**, **ship**, **serve**.

**Words to avoid:**
- **"Linkies"** (plural) in any user-facing surface — it's the internal name only. Use "launch bundles" in UI/docs/marketing.
- **URL shortener** — technically wrong (we bundle, not shorten) and anchors us to the wrong shelf.
- **Tracker / analytics / attribution** — off-brand for the low-surveillance position.
- **"Unlock powerful workflows"**, **"Get started now!"**, **"Supercharge"** — generic marketing energy. Linky is stark, imperative, terminal-aesthetic.
- **"Account required"** — anonymous creation is the default.
- **Linky page**, **the landing**, **activation link**, **bind URL** — wrong terminology per brand rules.

**Glossary:**

| Term | Meaning |
|---|---|
| Linky | The brand, the short URL, the verb. "Create a Linky." |
| launch bundle | A Linky's set of URLs. The public-facing plural in prose. |
| launcher page | `/l/[slug]` — where the Open All button lives. |
| Open All | The action that fires every saved tab. |
| resolution policy | The JSON rules-engine blob that drives per-viewer tab personalization. |
| claim URL / claim token | The one-time, one-shot handoff primitive that binds an anonymous Linky to a Clerk account. |
| subject | Internal auth actor: `org`, `user`, or `anonymous`. |
| born personalized | A Linky created with a policy attached in the same `POST /api/links` call — locked down from the first click. |
| claim flow | The agent-to-human handoff where an agent creates a Linky and returns a claim URL the human opens to take ownership. |
| viewer | The person opening a `/l/[slug]` launcher. Identity resolves via Clerk. |
| owner | The Clerk user or org attributed on `linkies.owner_user_id` / `linkies.owner_org_id`. |

---

## Brand Voice

**Tone:**
Stark, confident, direct, agent-first. Low marketing-energy. No fluff. Imperative over aspirational.

**Style:**
Terminal aesthetic — mono body type (IBM Plex Mono, `--font-linky-mono`), Bricolage Grotesque headlines (`.display-title`), `#ffffff` background, `#111111` foreground, thin `#d9d9d9` borders, no gradients, zero border-radius. Concrete verbs. Respect that the reader might be an LLM or a CLI operator, not a mouse-driven consumer.

**Personality:**
Stark. Confident. Developer-native. Agent-first. Trust-forward.

**Examples of in-voice copy (already shipped):**
- "Many URLs. One Linky." *(hero H1 — four-word fragment; the many→one parallel IS the product)*
- "One short link that opens every tab — for humans or agents alike." *(hero lead)*
- "Paste your list, share the link. Works the same in any browser, CLI, or agent prompt." *(hero sub-lead — hand-off promise)*
- "No signup, no credit card. MIT-licensed — self-host anytime." *(sub-CTA reassurance line; zero-risk framing at the conversion moment)*
- "Two steps. That's it."
- "Tell your agent to use Linky once. After that, whenever it needs to send you multiple URLs, it sends one Linky link instead."
- "Paste a few URLs. Get one Linky back." *(demo section heading — imperative, concrete)*

**Retired copy (do NOT resurrect):**
- ~~"One Linky to open them all."~~ — the old LOTR-reference tagline. Was replaced in PR #10 because it carried three costs: required a pop-culture pattern-match to unlock, had an ambiguous "them" with no grammatical antecedent, and traded clarity for cleverness at the biggest 15-second-comprehension surface on the site. Kept here so copy reviewers don't re-propose it.
- ~~"Agent-first launch orchestration."~~ — the original hero kicker. Replaced with "Open source · Agent-first · MIT" because "launch orchestration" is abstract category jargon that doesn't tell a first-time reader what shelf Linky sits on.
- ~~"Give Linky a list of URLs and get back one short launcher link. Purpose-built for agents, workflows, and fast context handoffs."~~ — the old hero lead. "Fast context handoffs" is vague filler; the new two-line lead split is sharper.

**Examples of out-of-voice copy (do not ship):**
- "Unlock powerful link workflows today!" (marketing energy)
- "Linky is the #1 way to..." (ranking claims)
- "Supercharge your productivity" (generic)
- "Click here to get started!" (imperative but hollow)

---

## Proof Points

**Metrics (to validate — placeholders for now):**
- *TODO: number of Linkies created, number of launcher page views, claim conversion rate, active orgs.*

**Customers / logos:**
- No external case studies yet — intentional. Product is 36 hours old.
- **Stack the product already integrates with** (shipped in the `works-with-strip` on the homepage): Cursor, Claude, OpenAI, Gemini, Codex, Windsurf, VS Code, Warp.
- Treat these as *compatibility* proof, not *customer* proof. Copy should say "works with" — never imply endorsement or partnership.

**Testimonials:**
- **None yet. Section stays aspirational until real users post real quotes.** Do not invent or paraphrase. Do not surface placeholder quotes on the landing page.
- When testimonials do arrive (Twitter / X replies to the founder's build-log threads are the most likely first source), prefer raw screenshots of the tweet over paraphrased quotes. Matches the build-in-public tone.

**Value themes & supporting evidence:**

| Theme | Proof |
|---|---|
| Agent-first | Public HTTP API, CLI with `--json`, npm SDK, Cursor skill, MCP on roadmap. Anonymous creation is free and rate-limited. |
| One URL, many tabs | `/l/[slug]` launcher opens every saved tab with Open All + popup-blocker fallbacks. |
| One URL, many audiences | `resolutionPolicy` DSL in `src/lib/linky/policy.ts` — pure evaluator, server-side per-click, exhaustively tested. Preview as control in the dashboard. |
| Trust-forward | Anonymous Linkies are permanent + immutable. Append-only `linky_versions` history. Low-surveillance by default (no tracker hops, no fingerprint cookies). Policy never leaks to viewers. Rule names private by default. |
| Agent → human handoff | One-shot claim token with 30-day expiry. Org context wins at claim time. Returned once, non-recoverable. |
| Self-hostable | MIT license. Next.js 16 + Clerk + Neon Postgres + Stripe direct. No ORM. Deploy to Vercel + Neon in minutes. |

---

## Goals

**Business goal (near-term, first 90 days):**
Become the default primitive for "return many URLs as one artifact" inside agent-native developer workflows. Win the skill-install in Claude Code, Cursor, OpenCode, Codex. Get Linky URLs showing up in Twitter / X posts of agent workflows.

**Business goal (6–12 months):**
Define an MCP-native "linky session" convention other agent frameworks can adopt. Convert anonymous creators → claimed accounts → $9/mo paid tier. Reach a sustainable indie-scale ARR from flat-fee subscriptions without ever quoting a sales call.

**Conversion actions (ordered by value):**
1. **Install the Cursor / Claude Code skill** — the skill emits Linky URLs at the end of every agent task. Stickiest primitive; once installed, Linkies appear in every session output.
2. **Create a Linky anonymously from the landing page, CLI, or API** — zero-friction, zero-account on-ramp on the hosted product.
3. **Claim a Linky** (sign in / sign up via Clerk on the hosted product) — converts anonymous user into an account.
4. **Upgrade to the hosted paid tier** — unlocks the clean launcher and other hosted-paid features. Working hypothesis: one flat fee, shape TBD.
5. **Star / fork / self-host the GitHub repo** — parallel conversion for the OSS-preferring crowd. Self-hosters are not lost revenue; they're validation, contributors, and amplifiers. Every GitHub star compounds the OSS trust story.
6. **Share a Linky publicly** (Twitter / X, Discord, Slack, blog) — each shared Linky is a distribution surface for the hosted product.

**Current metrics:**
- *Built in the last ~36 hours. No public metrics yet.* Honest framing beats inflated numbers at this stage.
- Instrumentation on roadmap: launcher view events (with Sprint 2 policy match-context), "Open All" click counts, return-visitor signal, claim conversion rate, skill-install rate.

**Growth loops to design for:**
- **Agent → public artifact**: every Linky an agent emits is a public URL someone else sees → potential new user.
- **Skill install → agent session → Linky per session**: install once, emit forever.
- **Shared Linky → recipient signs up to claim / edit / personalize**.
- **"Made with Linky" footer on free + anonymous launcher pages** — see Launch Plan below for the spec. Drives the $9 upgrade *and* serves as the primary zero-cost distribution channel.

---

## Launch Plan

### Channel sequencing (first 30 days)

**Locked in. No HN, no Product Hunt yet — not until there's a thicker dogfooding story.**

1. **Cursor / Claude Code skill-install readiness** — the skill is the stickiest primitive. Every agent session it runs in emits a Linky. Publish and document the install path first.
2. **Personal Twitter / X thread from the founder's handle** — build-in-public framing, terminal-aesthetic screenshots, concrete demos. Founder voice, not corporate voice.
3. **Build log follow-ups** — periodic "what I shipped this week" posts, each one ending with a Linky of the relevant URLs (dogfood-as-marketing).
4. **Skill-ecosystem submissions** — Claude Code skill index, Cursor skill marketplace, OpenCode skill registry. Get on every list.
5. **HN / Product Hunt** — later, once there's a screenshot of real usage, a real quote, or a real number. Launching to those audiences too early on a 36-hour-old product wastes the one shot.

### Founder voice (locked in)

Marketing voice = **personal founder voice**, not a corporate "we."
- Founder handle: **[@merlindotcom_](https://x.com/merlindotcom_)** on X / Twitter. All launch posts, build-log threads, and founder-voice marketing come from this handle.
- Build-log tone: "here's what I just shipped," "here's what I got wrong," "here's the thing I learned about Next.js 16's proxy.ts." (That kind of raw post is exactly what the audience follows for.)
- Product copy stays terminal-aesthetic and stark (the brand voice rules in `linky-codebase/SKILL.md` don't change).
- Twitter / X + build log = **personal brand extending the product brand**, not replacing it.
- First-person is fine ("I built Linky because..."). "We" should only appear when genuinely plural — avoid corporate-we on a 36-hour-old solo project.

### Attribution policy (locked in — Option C)

**On `getalinky.com` (the hosted product): free + anonymous launcher pages have a small "Made with Linky" footer. The hosted paid tier removes it.** Self-hosters can configure their own launcher (footer on, off, or branded to their own project).

This is both the primary free distribution channel for the hosted product and the visible, pride-based reason to upgrade.

Spec:

```
Hosted free / anonymous launcher (/l/[slug] on getalinky.com):
  Footer: "Made with Linky · getalinky.com"
  Style: monospace, small, matches terminal aesthetic — not a rainbow "Powered by" badge
  Placement: bottom of the launcher card, below Open All button
  Always-on for free + anonymous Linkies. No toggle.
  On-hover micro-copy: "Linky does not track your clicks." (reinforces
  the low-surveillance brand promise)

Hosted paid launcher:
  No footer. Clean launcher.
  Future expansion: owner-custom branding (name, logo, accent color).

Self-hosted launcher:
  Footer is configurable via env var or config file.
  Default: no footer (it's their deployment, not ours).
  OSS expectation: self-hosters can rebrand freely — that's the point of the license.

Never (everywhere):
  No footer on destination tabs (technically impossible anyway — Same-Origin
  Policy — but state it in copy so viewers know).
  No tracker-hop redirects (unchanged — already in README trust section).
  No attribution in the JSON API response, CLI output, or SDK return value —
  the footer is a launcher-page-only concern, never a primitive-level tax.
```

Trust reconciliation with the "low-surveillance primitive" positioning:
- Footer is visual only. No tracking pixel, no redirect wrapper, no cookie.
- Destination tabs are untouched.
- Paid tier kills the footer — users who care can pay $9 to remove it.
- On-hover copy explicitly disavows tracking.

### Product dependencies for the marketing plan

The launch plan above is **blocked on product work** that doesn't exist yet. Flagging these as engineering items so they don't sit behind the copy:

| Marketing asset | Product dependency | Status |
|---|---|---|
| "Made with Linky" growth loop on hosted product | Footer component on `/l/[slug]` launcher, gated by owner's hosted-paid entitlement | **Not built** |
| Hosted paid upgrade trigger ("clean launcher") | Entitlement flag: `hide_launcher_attribution` (or in an `entitlements` JSON column) on the subject record | **Not built** |
| Hosted paid plan | Stripe price + entitlement check + upgrade flow in dashboard | **Not built** (Stripe webhooks scaffolded, Customers minted per user/org, no prices defined, no feature split finalized) |
| Self-host story | `SELF_HOSTING.md` or equivalent docs walking through Vercel + Neon deploy + env-var config for launcher branding | **Partially built** — Quick Start + Deployment sections exist in README; dedicated self-hosting guide + launcher config is pending |
| Skill-install-first launch beat | Cursor skill published, Claude Code skill published, OpenCode registry entry | **Partially built** — Cursor skill exists (`skills/linky`), others pending |
| Twitter thread assets | Landing page + demo page polish, terminal-aesthetic screenshots | **Built** (landing page is shippable) |
| "Built in public + OSS" angle | Public GitHub repo, MIT license, public roadmap, real commit velocity | **Built** (repo is public, README is detailed, roadmap is in README, MIT license shipped) |

Minimum viable version to ship Option C attribution + OSS self-host config:
1. Add a boolean `hide_launcher_attribution` (or gate it off an `entitlements` JSON column) on the subject that owns the Linky. Hosted paid tier flips this on.
2. Add an env-var override (`LINKY_LAUNCHER_ATTRIBUTION=off` or similar) that self-hosted deployments can use to default the footer off across the entire instance.
3. Render the footer on `/l/[slug]` conditionally based on both signals (instance-level override OR per-subject entitlement).
4. Anonymous Linkies on the hosted product always render the footer (they have no owning subject that could hold the flag).
5. Hosted-paid entitlement (Stripe webhook → subject update) flips the per-subject flag to `true`.
6. Future: owner-custom launcher branding (name, logo, accent color) for hosted-paid; full template override for self-hosters. Ship only when there's demand.

This is a ~1–2 day product change on top of the Stripe work that needs to happen for the hosted paid plan anyway. Bundle into one sprint: "hosted paid plan + attribution entitlement + self-host launcher config = one story."

---

## Roadmap signals (for marketing awareness)

Shipped:
- Accounts + editable launch bundles + per-URL metadata (Sprint 1).
- Identity-aware URL resolution — same Linky, different tabs per viewer (Sprint 2).
- Policy at create time via CLI / SDK / API (Sprint 2.5) — "born personalized" path.
- Bearer API keys + `linky update <slug>` CLI command (Sprint 2.6). Agents
  authenticate as a personal or org subject via `Authorization: Bearer`,
  no browser session needed. Post-create policy editing from the terminal.
- Analytics + access control (Sprint 2.7). Three derived team roles
  (admin / editor / viewer), owner-side launcher analytics, scoped API
  keys (`links:read` / `links:write` / `keys:admin`). Trust posture
  preserved: no viewer tracking, no destination-tab pings. See
  `/docs/access-control` for the public-facing role model.
- **Agents use Linky natively** (Sprint 2.8). First-class MCP server at
  `/api/mcp` (Streamable-HTTP) + bundled `linky mcp` stdio bridge for
  harnesses that don't speak Streamable-HTTP. All 11 authed routes are
  exposed as MCP tools (`linky_create`, `linky_list`, `linky_get`,
  `linky_update`, `linky_delete`, `linky_versions`, `linky_insights`,
  `whoami`, `keys_list`, `keys_create`, `keys_revoke`). Per-key hourly
  rate limits (`rate_limit_per_hour`, default 1000/hr) cap runaway
  agents without touching legitimate workflows. CLI widened to 11-to-11
  parity with the MCP surface. Public walkthrough at `/docs/mcp` with
  copy-paste snippets for Cursor, Claude Desktop, Codex, Continue,
  Cline. Copy rule stays agent-framed ("your agent can create Linkies",
  never "we support the MCP spec").

Upcoming:
- Cursor / Claude / ChatGPT-native skills — emit a Linky at the end of
  every task. *MCP (Sprint 2.8) ships the underlying primitive; skill
  packaging per harness is the marketing follow-up.*
- Browser extension — tab-group capture and restore.

---

## Open questions — all resolved in V1.3

Resolved:
- ~~Primary persona~~ → indie hackers, Claude Code / Cursor / OpenCode / Codex users, vibe coders, founders, skill-adders. Individuals, not orgs.
- ~~Pricing model~~ → one flat fee, ~$9/month for full access.
- ~~Product maturity~~ → built in the last ~36 hours. Marketing reflects that honestly.
- ~~Launch channel sequencing~~ → Twitter thread + Cursor / Claude Code skill install first. HN / Product Hunt deferred until there's a dogfooding story.
- ~~Founder voice~~ → personal founder voice from **@merlindotcom_**. Build-log tone, raw and shipping-in-public. First person ("I built Linky because...") over corporate-we.
- ~~Attribution policy~~ → Option C: free + anonymous launcher pages carry a small "Made with Linky" footer; $9 paid tier removes it. Spec and product dependencies captured in the Launch Plan section.
- ~~Customer quotes~~ → stay aspirational. No invented quotes. When real quotes arrive, prefer raw tweet screenshots over paraphrased testimonials.
- ~~Competitive framing~~ → **anchor explicitly against Bitly / Linktree / OneTab** in public copy. Respectful contrast, never sniping. Rules captured under Competitive Landscape → Competitive framing in public copy.
- ~~Free vs. paid split~~ → anonymous creation stays free forever (load-bearing for agent distribution). Clean launcher is locked in as a $9 feature. Other gates (policy complexity, `maxLinkies`, analytics, version history depth) are **deliberately undecided** — revisit before shipping Stripe prices. Documented under Product Overview → Business model.

### Next revision triggers

Update this doc when any of the following happen:

1. **First real user quote lands** → replace aspirational Customer Language section with verbatim quotes.
2. **First paid subscriber ships** → add real pricing section, update Proof Points with subscriber-count milestone if disclosure-comfortable.
3. **$9 plan ships** → lock the free/paid feature split into Business model section, remove the TBD list.
4. **Product-dependency work completes** → flip "Not built" → "Built" in the Launch Plan table, unblock the marketing beat that was waiting on it.
5. **HN / Product Hunt becomes live** → add to Launch Plan channel sequencing with its own messaging guidance.
6. **New sprint ships** (e.g., analytics, MCP server, browser extension) → update Product Overview, Differentiation, and Roadmap signals to reflect what's now shipped.
