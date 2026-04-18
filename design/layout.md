# Layout

Linky uses a single full-width shell with internal rhythm driven by
`clamp()` section gaps. There is no complex grid system — the content
width caps do the work.

## The shell

Every primary surface is wrapped in `.site-shell` (or, for embedded
blocks, `.terminal-shell`). The shell is:

- Width-capped at **`max-w-6xl`** (~72rem / 1152px) via Tailwind on the
  page container.
- Padded at **`clamp(1.25rem, 3vw, 1.75rem)`** on the horizontal axis
  (the `p-5 sm:p-6 lg:p-7` compositions you'll see in `page.tsx`).
- Placed at **page center** by the outer `terminal-stage` wrapper.

The shell animates in once via `shell-rise` (460ms `ease-out`) and then
never moves.

## Rhythm

Section gaps use `clamp()` so the cadence compresses on mobile and
breathes on desktop, without media-query forks.

```css
--linky-section-gap-small: clamp(1.75rem, 4vw,  2.75rem); /* topbar ↓ hero */
--linky-section-gap:       clamp(3.25rem, 8vw,  6rem);    /* section ↔ section */
--linky-section-gap-large: clamp(4.25rem, 10vw, 7rem);    /* demo, hero CTA frame */
```

Existing class hooks: `.site-topbar` (`margin-bottom: --linky-section-gap-small`),
`.site-section` (`margin-top: --linky-section-gap`),
`.site-demo-section` (`margin-top: --linky-section-gap-large`). Use them
instead of reinventing margins.

## Content caps

Reading measure matters more than pixel-perfect grids. Defaults:

| Slot | Max-width | Rationale |
|---|---|---|
| Hero (`.site-hero`) | **46rem** | ~64ch at `body` size. The H1 + lead + sub-lead read in 5 beats. |
| Intro flow (`.site-intro-flow`) | **42rem** | Body paragraphs. |
| Section lede (`.site-section-lede`) | **42rem** | Kicker + H2 + optional sub-lede. |
| Docs lede (`.docs-lede`) | **48rem** | Long-form overview. |
| Demo section lede (`.site-demo-lede`) | **38rem** | Tighter — the demo input below it is the real content. |
| Docs body paragraph | **66ch** | Enforced via `.docs-content` rules. |
| Two-step grid (`.site-two-step-grid`) | **42rem** | Steps stack on mobile; columns ≥780px. |

## Grids

Three that ship today:

1. **Terminal grid** (`.terminal-grid`) — 1 column mobile, split to
   `1.08fr / 0.92fr` ≥1080px. Used in dashboards and /docs quick-start.
2. **Site command grid** (`.site-command-grid`) — 1 column mobile,
   2 columns ≥780px. Used to lay out install snippets side-by-side.
3. **Docs grid** (`.docs-grid`) — sidebar (14–16rem) + content, pinned
   ≥900px. See `docs/layout.tsx`.

Anything else: compose with CSS grid inline and keep the shape one of
{1 col, 2 col, sidebar-content}.

## Breakpoints

| Token | px | Where it bites |
|---|---|---|
| `sm`   | 640  | Tailwind's default; H1 scales `text-5xl → text-6xl`. |
| `md`   | 780  | `.site-command-grid`, `.site-use-case-grid`, `.site-logo-grid` split to columns. |
| `docs` | 900  | `.docs-grid` pins the sidebar. |
| `lg`   | 1080 | `.terminal-grid` splits left + aside. |
| `xl`   | 1280 | Reserved (no usage yet). |

**Avoid adding breakpoints.** If a new layout needs one, check whether
it can instead use `clamp()` or a `minmax()` grid column.

## Scanline texture

Applied via `body::before` (`--linky-color-scrim` at 3px period, 0.24
opacity, multiply blend). Always on. Do not turn it off per-page.

If a slide / export context doesn't support `mix-blend-mode`, fall back
to a flat `1px 3px` horizontal gradient at 0.03 alpha. Same effect,
lower fidelity.

## Panels

The repeating "container with a 1px border and a ton of padding" pattern
is called a _panel_ or _card_ in code:

- `.terminal-card` — square, 1px `line`, `paper` background.
- `.terminal-code-shell` — same shape plus a head-strip for language
  labels.
- `.terminal-input` — form control; same border + focus ring.
- `.site-command-panel` — looser variant for standalone code blocks in
  the marketing site.

Default panel padding: **`1rem`** (`--linky-space-4`). Compact variants
use `0.66rem` (see `.terminal-code-pre`).

## Lists and dividers

- `.site-divider-list` — parent. Sets the top hairline.
- `.site-divider-item` — children. Bottom hairline, `1.15rem` vertical
  padding.

Use this instead of borders on individual `<li>` — the group class
handles empty states cleanly (no trailing rule).

## Asides + sticky

`.terminal-aside` becomes `position: sticky` at `lg+`. Top offset is
`1.25rem`. Don't stack multiple sticky elements — the docs sidebar
already claims that budget on `/docs`.

## Reference composition

```jsx
<div className="terminal-stage flex flex-1 items-start justify-center px-5 py-5 sm:py-6">
  <main className="site-shell w-full max-w-6xl p-5 sm:p-6 lg:p-7">
    <SiteHeader currentPath="/" />

    <section className="site-hero">
      <p className="terminal-label mb-4">Open source · Agent-first · MIT</p>
      <h1 className="display-title text-5xl leading-[0.9] font-semibold sm:text-6xl">
        Many URLs. One Linky.
      </h1>
    </section>

    <section className="site-section">…</section>
    <section className="site-section">…</section>
  </main>
</div>
```

If a new page doesn't start with this skeleton, it's wrong.
