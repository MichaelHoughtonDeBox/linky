# Linky Design System

One source of truth for everything Linky looks like, speaks like, and moves
like. Used by the product (`src/app/**`), the marketing site, README assets,
slide decks, animated social cuts, CLI TTY styling, and any agent that needs
to render Linky-branded output.

> **Why a design system at all?**
> Linky is monochrome, agent-first, and terminal-shaped. That's only a brand
> if it's _consistent_. Consistency needs one place that decides — and this
> is that place.

---

## How it ships

Linky's design system is **a folder in the repo**, not a Storybook, not a
Figma Library, not a published npm package. Reasons:

1. **Agents read it.** Tokens + voice + component rules sit next to the
   codebase, so Cursor, Claude Code, Codex, and any other tool that clones
   the repo gets the system for free.
2. **Slides, emails, and social cuts can pull from the same file.** Keynote
   templates, After Effects motion scripts, and OpenGraph generators all
   consume `design/tokens.json`.
3. **No version drift.** When a color or type scale changes, one PR updates
   the product, the docs, the slide template, and the README in lock-step.

### Shape

```
design/
├── README.md            ← you are here
├── tokens.json          ← canonical tokens (W3C DTCG compatible)
├── tokens.css           ← same tokens as CSS custom properties
├── brand.md             ← product language, voice, tone
├── color.md             ← palette, usage, do / don't
├── typography.md        ← display + mono stack, scale, slide recipes
├── logo.md              ← slash mark, wordmark, clear space, misuse
├── iconography.md       ← icon rules (we prefer type + hairlines)
├── layout.md            ← grid, rhythm, section primitives, breakpoints
├── motion.md            ← duration, easing, entrance / interaction recipes
├── components.md        ← catalog of every terminal-* and site-* primitive
├── writing.md           ← copy patterns, empty states, error messages
├── slides.md            ← Keynote / Google Slides / Figma Slides recipe
├── animation.md         ← After Effects / Rive / Framer Motion recipes
├── accessibility.md     ← contrast, focus, motion-reduce, reading order
└── assets/              ← raw SVGs, social cards, logo packs
    ├── logos/
    └── stack/
```

And a **live style guide** at `/design` in the running app — every token and
component rendered from the same CSS the product ships with, so
documentation drift is impossible.

---

## Who changes what

| File | Primary editor | Review by |
|---|---|---|
| `tokens.json` + `tokens.css` | design | engineering (breaking) |
| `brand.md`, `writing.md`     | product marketing | design |
| `color.md`, `typography.md`, `logo.md`, `iconography.md`, `layout.md`, `motion.md` | design | product marketing |
| `components.md` | engineering | design |
| `/design` route | engineering | design |
| `assets/` | design | — |

Anyone can open a PR. The reviewer columns are for merge authority only.

---

## Rules that never bend

- **Monochrome.** Ink (`#111`) on paper (`#fff`). No gradients, no brand
  hue beyond ink + paper. `danger` (`#9a2f24`) is the only sanctioned
  accent and it exists for destructive / hard-error UI only.
- **Terminal shape.** Radius is `0`. Borders are `1px` hairlines. Buttons
  are square. Inputs are square. Cards are square.
- **Mono-first.** Body is mono. Display is `Bricolage Grotesque`. Nothing
  else ships to the runtime without design review.
- **Typography carries weight, not color.** We emphasise by size + weight
  + letter-spacing, not by painting things.
- **Brand is built from constraints, not decoration.** Every ornament is a
  rule, a hairline, or a monospace label. That's the look.
- **No ambient motion.** Animations are short (≤460ms), scoped, and cued
  to user action. Nothing loops. Nothing breathes. The terminal texture
  (scanlines) is the only always-on visual effect.

If you're about to violate one, the rule itself is wrong — open a PR
against the rule before writing the exception.

---

## Consuming tokens

**From CSS** (product, marketing surfaces, slide templates exported to
HTML):

```css
@import "./design/tokens.css";

.my-custom-surface {
  border: var(--linky-border-hair) solid var(--linky-color-line);
  color: var(--linky-color-ink);
  font-family: var(--linky-font-mono);
  transition: transform var(--linky-duration-fast) var(--linky-ease-standard);
}
```

**From JS / TS** (React, After Effects scripts, Node tools):

```ts
import tokens from "@/../../design/tokens.json";
// or relative: import tokens from "../../design/tokens.json";

const ink = tokens.color.ink.$value;           // "#111111"
const fast = tokens.motion.duration.fast.$value; // "120ms"
```

**From Figma Tokens Studio**: point at `design/tokens.json` via GitHub
sync. The file is W3C DTCG-shaped so it imports with no transform.

**From Style Dictionary / Theo**: `design/tokens.json` as the sole
source. Generate per-platform bundles in CI if iOS / Android surfaces
ever ship.

---

## Consuming voice + copy rules

Read `brand.md` before writing _any_ user-facing string. The
"Linky (singular) vs launch bundles (plural)" rule is enforced in PR
review — there is no automated linter for it yet.

---

## Why these specific choices

See individual docs. Each decision is tagged with the rationale so future
edits can judge whether the constraint still holds. If a doc just says
"because we said so", that's a bug — file it.

---

## Updating the system

1. Open a branch. Name it `design/<change>` or `design/<area>-<change>`.
2. Update `tokens.json` and `tokens.css` in the **same commit**. They are
   not allowed to drift.
3. Update any `.md` doc that cites the changed token by name.
4. Run `npm run check` — the `/design` route must still build, and any
   existing tests that pin colors or type must be updated together.
5. Commit with a message that explains **why**, not just **what**. Design
   changes are harder to diff than code — prose helps future-you.
6. Ship.

---

## Related

- **`.agents/product-marketing-context.md`** — the source of truth for
  positioning, personas, competitive framing, customer language,
  monetization voice, attribution policy, and launch plan. This design
  system derives its voice rules from that doc; if they ever disagree,
  PMC wins.
- **`.agents/skills/product-marketing-context/SKILL.md`** — the agent
  skill that generates / refreshes PMC. Run it when the product
  meaningfully shifts (new sprint, new pricing, new audience).
- **`.agents/skills/copy-editing/SKILL.md`** — seven-sweep editing
  framework. Use it on every copy change before shipping, especially on
  the landing page and hero.
- `AGENTS.md` — repo-wide agent rules.
- `.cursor/skills/linky-codebase/SKILL.md` — brand language +
  Next.js 16 conventions. The voice section here derives from it.
- `.cursor/internal-brainstorming.md` — product strategy notes that
  shape where the design system is heading (custom domains, claim
  flow, etc).
- `README.md` — product overview and runtime surfaces.
