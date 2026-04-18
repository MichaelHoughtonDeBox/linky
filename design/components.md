# Components

Catalog of every reusable primitive Linky ships. If a pattern isn't in
here, either (a) it's a one-off and should not be abstracted, or (b) it
belongs here and this doc is out of date — file a PR.

## Class naming

Two prefixes:

- **`.terminal-*`** — embedded chrome (code shells, inputs, action
  buttons, cards). The darker / denser primitives.
- **`.site-*`** — marketing-site layout and rhythm primitives (heroes,
  sections, grids, logo strips).

There is deliberate overlap: `.site-shell` and `.terminal-shell` are the
same animation, different chrome. The marketing site uses the
transparent variant; embedded views use the filled one.

## Shell

- **`.site-shell`** — transparent, no border, no shadow. Wraps every
  marketing-site page. Carries the `shell-rise` entrance.
- **`.terminal-shell`** — filled variant with `1px` hairline, dark
  shell-shadow, backdrop blur. Used inside embeds and playgrounds.

## Topbar + nav

- **`.site-topbar`** — flex row, horizontal nav. `margin-bottom: clamp(…)`.
- **`.site-brand`** — logo mark + wordmark lockup.
- **`.site-nav`** — nav link row.
- **`.site-nav-link`** — nav links. Underlined on hover, border-bottom
  when `.is-active`.

## Hero

- **`.site-hero`** — max-width `46rem`, bottom margin `clamp(…)`.
- **`.site-hero-lead`** — the large tagline under H1. Tracking `-0.01em`.
- **`.site-hero-cta-row`** — CTA flex-wrap with `padding-top: 0.25rem`.

Paired with Tailwind classes for type sizing:

```html
<p class="terminal-label mb-4">Open source · Agent-first · MIT</p>
<h1 class="display-title mb-5 text-5xl leading-[0.9] font-semibold sm:text-6xl">
  Many URLs. One Linky.
</h1>
<p class="site-hero-lead max-w-3xl text-xl leading-snug font-medium sm:text-2xl">
  One short link that opens every tab — for humans or agents alike.
</p>
```

## Section rhythm

- **`.site-section`** — top margin `--linky-section-gap`.
- **`.site-demo-section`** — larger top margin (`--linky-section-gap-large`).
- **`.site-section-lede`** — kicker + H2 + optional sub-lede block. Max
  `42rem`.
- **`.site-simple-lede`** — single-paragraph lede with bottom margin.
- **`.site-inline-callout`** — 1px left rule, `0.9rem` left pad. Low-key
  pull-quote.

## Divider list

- **`.site-divider-list`** — top hairline container.
- **`.site-divider-item`** — 1.15rem vertical padding, bottom hairline.

Use for FAQs, use-case lists, sidebar meta, anything where the row
structure does the layout work.

## Terminal label + display title

- **`.terminal-label`** — kicker. Mono, uppercase, `0.72rem`,
  `track-kicker`, `mute`.
- **`.display-title`** — display family, `track-display`.

## Inputs

- **`.terminal-input`** — square textarea / input. Hairline border,
  `paper` fill. Focus lifts 1px, rings with `--linky-shadow-focus`, and
  switches border to `ink`.

## Buttons

Three flavors, all square, all 1px border.

- **`.terminal-action`** — primary. 1px `ink` border, `paper` fill,
  `ink` text, weight 600. Hover lifts 1px and adds `--linky-shadow-cta`.
- **`.terminal-secondary`** — secondary. 1px `line` border, `paper`
  fill. Hover darkens border to `ink` and lifts 1px.
- **`.terminal-copy-action`** — copy-to-clipboard variant. 1px `ink`
  border, carries `--linky-shadow-copy` at rest, lifts + strengthens on
  hover.

Disabled state: `opacity: 0.52`, `cursor: not-allowed`, no lift.

## Cards

- **`.terminal-card`** — square, 1px `line`, `paper`. `min-width: 0` so
  grid children collapse gracefully.
- **`.terminal-stack`** — grid-based vertical spacing, `gap: 1rem`.
- **`.terminal-grid`** — main split layout. Single column mobile, splits
  to `1.08fr / 0.92fr` ≥1080px.

## Code blocks

Three shapes, pick by context:

- **`.terminal-code-shell`** — panel with the macOS-ish "dot"
  head-strip. The default embedded code container.
  - Head: `.terminal-code-head` + `.terminal-code-dots` + `.terminal-code-dot`
    + `.terminal-code-label`.
  - Body: `.terminal-code-pre` + `<code>`.
- **`.site-code-block`** — simpler code block for marketing
  surfaces. No head-strip. Min-height `8.75rem` so adjacent cells
  don't jump during hydration.
- **`.site-command-panel`** — compact single-line command container.

Inline code (in prose): rendered via `.docs-content code:not(pre code)`.
Background `code-fill`, 1px `line` border, padding `0.02rem 0.32rem`.

## Chips + metrics

- **`.terminal-metrics`** — flex-wrap container for chip rows, `gap: 0.45rem`.
- **`.terminal-chip`** — 1px `line`, `panel-soft` fill, `0.7rem` mono,
  `track-chip`, uppercase.

## Link lists

- **`.terminal-link-list-item`** — square, 1px `line`, hover lifts 1px
  and darkens border.

## Step grids

- **`.site-two-step-grid`** — two-column grid ≥780px.
- **`.site-step-kicker`** — step number + kicker row.
- **`.site-step-number`** — 0.82rem, `track-chip`.
- **`.site-step-example`** — 1px left rule, `0.9rem` left pad.
- **`.site-example-link`** — hairline-border inline anchor with
  `word-break: break-all` (URLs don't wrap cleanly otherwise).

## Logo strip

- **`.site-logo-grid`** — 2 cols mobile, 4 cols ≥780px.
- **`.site-logo-chip`** — opacity 0.72 at rest, 1.0 on hover.
- **`.site-logo-image`** — `filter: invert(1)` so uploaded SVGs normalize
  to ink. Any logo added here must read correctly through that invert.

## Docs surface

Exclusive to `/docs/**`:

- `.docs-grid`, `.docs-sidebar`, `.docs-sidebar-list`, `.docs-sidebar-group`,
  `.docs-sidebar-group-heading`, `.docs-sidebar-link` (with `.is-active`),
  `.docs-mobile-nav`, `.docs-mobile-nav-body`.
- `.docs-content` — body type scale + link treatment.
- `.docs-lede` — opening paragraph in muted body.
- `.docs-section` — section grouping.
- `.docs-next` — "next in series" link row at doc tail.
- `.docs-table-wrap` + `.docs-table` — tables with hairline rules.
- `.docs-json` — formatted JSON blocks.

## Composition rules

- **Never layer `.terminal-shell` inside `.site-shell`.** They carry the
  same entrance animation and double it up visually.
- **Never add a second entrance animation.** If you need movement on a
  specific element, cue it to interaction (see `motion.md`).
- **Never reach for a Tailwind utility where a `.terminal-*`/`.site-*`
  class exists.** The primitives exist to keep the brand consistent;
  utilities bypass that.
- **Write the Tailwind inside the primitive, not around it.** If
  `.site-hero` needs different bottom-margin on a specific page, add a
  modifier class, not a `mb-12` override.

## Launcher attribution footer (spec)

Not yet built in code. When it ships on `/l/[slug]`, it uses this exact
shape — derived from
`.agents/product-marketing-context.md` → "Launch Plan → Attribution
policy (locked in — Option C)".

```
[Open All button]
┌────────────────────────────────────────┐
│ Made with Linky · getalinky.com        │
└────────────────────────────────────────┘
```

- Text: `Made with Linky · getalinky.com`. Exact. Capital L on Linky.
  Middle-dot separator. No em-dash, no pipe.
- Family: `--linky-font-mono`.
- Size: `--linky-size-xs` (0.72rem).
- Color: `--linky-color-mute`.
- Tracking: `--linky-track-chip`.
- Spacing: `--linky-space-4` top-margin from the Open All block.
- Border: none. No box, no pill. Just the line of text.
- Alignment: centered inside the launcher card, matching Open All.
- Hover: tooltip / title = "Linky does not track your clicks."
- Anchor: `getalinky.com` wraps a link to `https://getalinky.com`.
  Underline on hover only (`text-decoration: underline`). No external
  link icon.

### When the footer appears

| Surface | Footer? |
|---|---|
| Hosted anonymous launcher | **Always.** No toggle. |
| Hosted signed-in, free plan | **Yes** by default. |
| Hosted signed-in, paid plan | **No** (entitlement `hide_launcher_attribution`). |
| Self-hosted launcher | Configurable. Default **off** — self-hosters can flip on via `LINKY_LAUNCHER_ATTRIBUTION=on` or per-subject entitlement. |
| Destination tabs | Never. Technically impossible (Same-Origin Policy), but also not allowed. |
| JSON API response, CLI output, SDK return value | Never. Launcher-page concern only. |

Do not ever tuck a tracking pixel, redirect wrapper, or cookie into
this footer. It is visual-only by contract.

## When to add a new primitive

1. The pattern repeats in ≥3 places.
2. Tailwind utility composition would be ≥4 classes long.
3. The pattern has semantic meaning ("step example", "divider list"),
   not purely visual.

If (1) and (2) hold but (3) doesn't — it's a utility combination,
leave it inline.
