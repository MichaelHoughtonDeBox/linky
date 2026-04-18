# Brand

Linky's brand is a promise:

> **Many URLs, one Linky. For humans or agents alike.**

Everything in the design system exists to make that promise legible in
fifteen seconds or less — in the product, in a terminal, on a slide, in a
tweet.

> **Strategy lives in `.agents/product-marketing-context.md`.** Read that
> first for positioning, personas, competitive framing, customer
> language, and launch plan. This file carries the _voice + copy rules_
> that are derived from it and surface in the product. If the two ever
> disagree, PMC wins and this doc is the bug — patch it in the same
> branch.

## Positioning in one sentence

> Linky is the agent-native delivery layer for bundling many URLs behind a
> single short link — open source, MIT-licensed, free to start.

Say this. Don't say "the ultimate URL shortener". Don't say "unlock
powerful link-sharing workflows". The readership is a senior IC, a CLI
operator, or an LLM. Marketing-energy copy leaks trust with all three.

Internal category framing is **"agent-first launch orchestration"** —
that's for whiteboards and investor docs, never UI copy. It describes
the shelf Linky sits on between link shorteners, tab-group managers,
and link-in-bio hubs. See
[`.agents/product-marketing-context.md`](../.agents/product-marketing-context.md)
→ "Product category" for the full framing.

## Primary audiences, in priority order

Driven by `.agents/product-marketing-context.md` → "Target Audience" and
"Personas". Summary here:

1. **The agent-native indie hacker** (primary). Claude Code / Cursor /
   OpenCode / Codex / Windsurf users. Their agent returns 10+ URLs per
   task; they want one.
2. **The skill-adder / agent power user** (primary). Installing skills
   into their agent stack. They want a first-class primitive their agent
   can emit.
3. **The building-in-public founder** (primary). Ships solo, posts
   sessions, needs one shareable artifact per demo / update.
4. **The Twitter / X coding bro, vibe coder** (amplifier). Both audience
   _and_ distribution channel for workflow-aesthetic posts.

Secondary motion: small engineering teams with standup / incident /
release rituals. Real, but validated second — solo-first keeps the
product sharp.

**Decision-maker = user = buyer.** One person, one credit card. No
enterprise procurement, no devex committee. Convert by being obviously
useful inside the first Linky the user creates.

## Voice

**Terminal aesthetic. Stark, confident, agent-first. No fluff.**

- Imperative: "Create a Linky", "Bundle URLs", "Claim the link".
- Concrete: "Paste your list", "Share the URL", not "Get started".
- Low marketing-energy: we explain, we don't sell.
- Agent-respectful: the reader might be an LLM or a CLI operator, not a
  mouse-driven consumer. Write so both parse easily.

### Do

- "Create a Linky."
- "One short link that opens every tab — for humans or agents alike."
- "Paste your list, share the link."
- "No signup, no credit card. MIT-licensed — self-host anytime."

### Don't

- "Get started now!" (marketing-energy)
- "Unlock powerful workflows" (vague, assumes unearned trust)
- "Linkies" in any user-facing string (internal plural — never leaks)
- "The ultimate link bundler" (generic superlative)

## Product language (strict)

These are enforced. Appear in UI copy, docs, READMEs, error messages,
blog posts, tweet copy — every surface a human or agent reads.

| Term | Use for | Never say |
|---|---|---|
| **Linky** (singular, capitalized) | The brand. The short URL. The verb ("create a Linky", "send a Linky"). | — |
| **launch bundle(s)** | The plural in prose. "Your launch bundles", "team-owned bundles", "no bundles yet". | "Linkies" — internal plural, never in UI |
| **links** | Plural noun for URL paths / short URLs. `/api/links`, `/dashboard/links/[slug]`. | "linkies" in URLs |
| **launcher page** | `/l/[slug]` — where the Open All button lives. | "Linky page", "the landing" |
| **claim URL / claim flow** | The agent-initiated handoff. `/claim/[token]`. | "activation link", "bind URL" |
| **subject** (internal) | The auth actor: `org`, `user`, or `anonymous`. | "account" (ambiguous with Clerk) |

**Internal identifiers keep "linkies"** — table names, repo filenames,
function names (`linkies`, `linkies-repository.ts`, `listLinkiesForSubject`,
`maxLinkies`). Do not rename them for cosmetic consistency; the public
contract is `/links`, the internal model is `linkies`, and that's fine.

## Taglines — sanctioned

Use these verbatim. Don't paraphrase.

1. **"Many URLs. One Linky."** — primary H1, canonical since PR #10.
   The many→one parallel IS the product in a single beat.
2. **"One short link that opens every tab — for humans or agents alike."**
   — primary hero lead.
3. **"Paste your list, share the link. Works the same in any browser,
   CLI, or agent prompt."** — hero sub-lead / hand-off promise.
4. **"No signup, no credit card. MIT-licensed — self-host anytime."** —
   sub-CTA anxiety-reducer at the conversion moment.
5. **"Paste a few URLs. Get one Linky back."** — demo section heading.
6. **"Tell your agent to use Linky once. After that, whenever it needs
   to send you multiple URLs, it sends one Linky link instead."** —
   long-form agent-motion explainer.
7. **"Two steps. That's it."** — install / quick-start beat.

### Retired — do not resurrect

Kept here so copy reviewers recognise and reject them.

- **"One Linky to open them all."** — legacy LOTR-reference tagline.
  Retired in PR #10 because it carried a pop-culture pattern-match tax,
  had an ambiguous "them", and traded clarity for cleverness on the
  biggest 15-second-comprehension surface. **Not a fallback.** Not fine
  in tweets. Not fine in GitHub headers. Do not re-propose.
- **"Agent-first launch orchestration."** — original hero kicker.
  Replaced with "Open source · Agent-first · MIT" because "launch
  orchestration" is abstract category jargon.
- **"Give Linky a list of URLs and get back one short launcher link.
  Purpose-built for agents, workflows, and fast context handoffs."** —
  old hero lead. "Fast context handoffs" is vague filler.

## Competitive framing (locked)

Landing page, Twitter / X threads, and docs anchor Linky against
adjacent shelves by name. "Linky is not X, it's Y." Pulled verbatim
from `.agents/product-marketing-context.md` → "Competitive Landscape":

| vs. | Use |
|---|---|
| **Bitly / Dub / Short.io** | "URL shorteners take one URL in and give one short URL back. Linky takes _many_ URLs in and gives one short launcher URL back." |
| **Linktree / Beacons / Bento** | "Link-in-bio pages show a menu and ask your viewer to click through. Linky opens all the tabs in one click. Built for agent sessions, not creator audiences." |
| **OneTab / Toby / Workona** | "Tab-group extensions live on your machine. Linky lives at a URL you can paste into chat, Slack, or an agent prompt." |
| **Just pasting in chat** | "Works fine for 2 URLs. Breaks at 5. Linky is one URL, always." |
| **All of the above — OSS angle** | "And it's open source. Self-host on your own infra, or let us run it for you. The adjacent tools are closed boxes." |

Rules:

1. **Never snipe.** Adjacent tools are good at their job — their job
   just isn't this.
2. **Name tools explicitly** (Bitly, Linktree, OneTab). "Other URL
   tools" is too vague to locate Linky mentally.
3. **One contrast per copy block.** A Twitter thread uses one; a
   landing page can cycle through them across sections.
4. **Land on a Linky-specific verb** (bundle, launch, personalize,
   hand off). Never end on "we're better".

## Monetization voice

Monetization is genuinely undecided. Say so:

- **Do** frame Linky as OSS first, hosted second. "Open source. Use it.
  Host it yourself or let us run it for you."
- **Do** name the MIT license — it's a differentiator vs. Bitly /
  Linktree / OneTab (none of them are OSS).
- **Do** be honest: "Eventually the hosted product will charge for
  advanced features. For now, everything works." The audience rewards
  that candor.
- **Don't** quote a specific price / tier / launch date before it
  ships. The ~$9/month figure is an internal working hypothesis, not a
  commitment.
- **Don't** pretend the free tier is a trial. It's the actual product —
  either hosted-free (anonymous creation) or self-host-free
  (everything).

## Hosted vs. self-hosted language

- **`getalinky.com`** is the hosted product. Anonymous creation stays
  free forever on it. Paid hosted features are TBD.
- **Self-host** means clone the MIT repo, `npm run db:migrate`, deploy
  to Vercel + Neon. Free, forever. Say "self-host", not "install" or
  "deploy" — "self-host" is the word the audience uses.
- When both paths matter, present them side by side. Don't lead the
  reader toward hosted.

## Founder voice vs. product voice

Two registers. Don't mix them.

- **Product voice** is the one this design system codifies: terminal
  aesthetic, stark, imperative, no "we" unless genuinely plural. Used
  in the app, docs, README, error messages, CLI output, slide copy.
- **Founder voice** is the personal Twitter / X voice from
  [@merlindotcom_](https://x.com/merlindotcom_). Build-log tone —
  "here's what I just shipped", "here's what I got wrong", "here's the
  thing I learned about Next.js 16's `proxy.ts`". First-person, raw,
  shipping-in-public. Used for launch threads, build-log posts,
  founder replies.

Product copy never adopts founder register ("I built Linky because..."
on a landing page reads wrong). Founder posts never adopt product
register (a stark imperative in a personal tweet reads corporate).

## Proof-point discipline

Pulled from `.agents/product-marketing-context.md` → "Proof Points":

- **"Works with" is compatibility proof, not customer proof.** The
  works-with-strip (Cursor, Claude, OpenAI, Gemini, Codex, Windsurf,
  VS Code, Warp) is accurate _because_ we integrate with each. Never
  imply endorsement or partnership.
- **No invented quotes.** Testimonials stay aspirational until real
  users post real quotes. When they arrive, prefer raw tweet
  screenshots over paraphrased prose.
- **No hero metrics until they're real.** The product is ~36 hours
  old. Inflated numbers leak trust faster than an honest
  "built-in-public" framing does.

## Attribution policy (Option C)

Locked in:

- **Hosted free + anonymous launcher pages** (`/l/[slug]` on
  `getalinky.com`) carry a small monospace footer: `Made with Linky ·
  getalinky.com`. Below the Open All button. Terminal aesthetic, not a
  rainbow "Powered by" badge. On-hover: "Linky does not track your
  clicks."
- **Hosted paid launcher** — no footer. Clean launcher is the primary
  $9 upgrade trigger.
- **Self-hosted launcher** — footer configurable; default off. The
  license says rebrand freely, so the defaults honour that.

Never: no footer on destination tabs. No tracker-hop redirects. No
attribution in the JSON API response, CLI output, or SDK return value.
The footer is a launcher-page concern, never a primitive-level tax.

## Brand moves

- The slash mark (`/`) carries the brand. Use it as an ornament, a
  section divider, a punctuation beat, a bullet. Never decoratively — it
  always stands in for "here's a URL path" or "here's a Linky".
- The terminal shell (monospace, hairline borders, scanline texture) is
  the consistent chrome across web, docs, and slides. Strip it and the
  brand evaporates.
- We ship the rule, not the exception. If it's not reusable, it's a
  one-off; one-offs don't go in the design system.

## What we are not

- We are not a general web host. See `.cursor/internal-brainstorming.md`
  — Linky is an agent delivery layer, not `here.now`.
- We are not a marketing site masquerading as a product. Copy respects
  the reader.
- We are not colorful. Introducing any new hue is a regression.
- We are not maximalist. If in doubt, remove it.

## Signature lines worth preserving

Small, durable fragments of voice we re-use across surfaces:

- "Paste your list, share the link."
- "For humans or agents alike."
- "Open source · Agent-first · MIT"
- "No signup, no credit card."
- "MIT-licensed — self-host anytime."
- "Your launch bundles."
- "Open All."

Treat these like proper nouns. They should feel the same everywhere they
appear.
