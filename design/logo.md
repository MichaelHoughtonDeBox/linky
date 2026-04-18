# Logo

The Linky logo is a **single forward slash** (`/`) — 64px stroke, 26°
rotation, square caps. It's the URL character that everyone reads as
"path", which is the entire product in a glyph.

## The mark

```
  /
```

Canonical SVG: `public/logo-mark.svg`.

```svg
<svg width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="white" />
  <line x1="188" y1="396" x2="324" y2="116"
        stroke="black" stroke-width="64" stroke-linecap="square" />
</svg>
```

- Stroke: **64px at 512×512**, scale proportionally. Minimum viable
  stroke is 2px (16×16 favicon).
- Cap: **square**. Never `round`. Round cap reads as a typographic
  slash; square cap reads as a terminal slash — that's the brand.
- Angle: **26° from vertical** (equivalent line from `(188, 396)` to
  `(324, 116)`). Off-axis: do not rotate.
- Background: always `paper` (`#ffffff`). Never ink-on-paper inverted
  without design review.
- Border treatment: in the product we wrap the favicon / nav mark in a
  1px `ink` frame — see `src/components/site/site-header.tsx`. Framed
  version is the default for in-context use; unframed is for
  stand-alone marks (README hero, social card, OpenGraph).

## Wordmark

- "Linky", display family (Bricolage Grotesque), weight 600,
  letter-spacing `-0.02em`.
- Sits to the **right** of the slash mark with a gap equal to the mark's
  height ÷ 4 (roughly `0.65rem` at nav scale, `40px` at hero scale).
- In the nav: mark ~28×28, wordmark ~18px. In the GitHub header: mark
  ~300×300, wordmark ~132px.

## Clear space

Leave at least **one mark-height** of clear space on every side. If the
mark is 28×28, give it 28px of breathing room.

In tight layouts (mobile nav, CLI TTY), **half a mark-height** is the
absolute minimum.

## Minimum sizes

| Context | Mark size | Notes |
|---|---|---|
| Favicon | 16×16 | Stroke thickens relatively; see `src/app/icon.tsx`. |
| Nav + inline | 20–32 | 28 is the default. |
| Heading lockup | 64–120 | Keep the wordmark ≤1.5× mark height. |
| Hero / GitHub header | 200–360 | Pair with heavy display wordmark. |
| Social card | ≥128 | OpenGraph is 1200×630; mark sits at ~160–200. |

## Misuse

Do:

- Put the mark on `paper` (`#ffffff`).
- Keep the stroke square-capped.
- Pair with the wordmark in Bricolage.

Don't:

- Don't recolor. No gradient slashes. No colored slashes.
- Don't stretch horizontally or vertically — aspect must be preserved.
- Don't replace with a backslash (`\`), double-slash (`//`), or any
  other URL punctuation. Those are explored alternatives
  (`public/logo-option-*.svg`) and they did not ship.
- Don't outline (convert the fill to a stroke). The mark IS a stroke.
- Don't emboss, bevel, glow, or drop-shadow.
- Don't wordmark-only. "Linky" in Bricolage alone is not the logo; the
  slash has to be present in every brand lockup.
- Don't invert to white-on-black unless the background is a full ink
  slab — and even then, prefer the framed variant.

## Alternatives we explored (and why they didn't ship)

See `public/logo-options.html` and `public/logo-option-*.svg`.

- **Option A — Single slash.** ← shipped.
- **Option B — Double slash (`//`)**. Reads as "comment" in most
  programming languages and that's a mis-signal.
- **Option C — Linked chain (capsules)**. Cute, but competes with every
  other URL-shortener mark in market.

Keep the file around; sometimes a client asks "did you consider
alternatives?" and it's useful to show receipts.

## Asset inventory

| File | Use |
|---|---|
| `public/logo-mark.svg` | Runtime favicon / nav / inline mark. |
| `public/github-header.svg` | README hero (full width). |
| `public/github-header-minimal.svg` | Current README hero. |
| `public/github-header-compact.svg` | Social embed / narrow README. |
| `src/app/icon.tsx` | Favicon via `@vercel/og` (runtime PNG). |
| `src/app/apple-icon.tsx` | Apple touch icon. |
| `src/app/opengraph-image.tsx` | 1200×630 social card. |
| `src/app/twitter-image.tsx` | Twitter card (same output shape). |
| `design/assets/logos/` | Source files + export variants (press kit). |

## Export sizes (press kit)

When asked for "the logo":

- **SVG** (the canonical mark — scales losslessly).
- **PNG @ 1024, 512, 256, 128** on transparent background.
- **PNG @ 1024, 512, 256, 128** on `#ffffff`.
- **SVG with wordmark** at 3 aspect ratios (mark-only, horizontal, stacked).

Drop all variants under `design/assets/logos/press-kit/` and update
`design/assets/README.md` when shipping.
