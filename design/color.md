# Color

Linky is monochrome. That's a deliberate constraint, not an oversight.

## Palette

| Token | Hex | Role |
|---|---|---|
| `ink` | `#111111` | Primary foreground. Text, wordmark, slash mark, primary button fill. |
| `paper` | `#ffffff` | Canonical background. No off-whites, no gradients. |
| `mute` | `#666666` | Secondary text. Leads, muted captions, table meta. |
| `line` | `#d9d9d9` | Hairline rule. Borders, dividers, terminal panels. |
| `line-strong` | `#111111` | Active focus border, primary CTA outline. Same ink as text. |
| `surface-soft` | `#fafafa` | Faint surface lift for docs tables + zebra blocks. Sparingly. |
| `code-fill` | `#f4f4f4` | Inline-code background. |
| `danger` | `#9a2f24` | Destructive + hard errors only. Not decoration. |
| `scrim` | `rgba(17,17,17,0.03)` | Scanline texture overlay. |

Consumed via `design/tokens.css` (CSS custom properties) or
`design/tokens.json` (everywhere else).

## Contrast

Every supported combination clears WCAG AA for normal text:

| Foreground | Background | Ratio |
|---|---|---|
| `ink` on `paper` | `#111` on `#fff` | **18.66:1** (AAA) |
| `mute` on `paper` | `#666` on `#fff` | **5.74:1** (AA large text; AAA with ≥14px bold or ≥18px regular) |
| `ink` on `surface-soft` | `#111` on `#fafafa` | **18.02:1** (AAA) |
| `ink` on `code-fill` | `#111` on `#f4f4f4` | **17.13:1** (AAA) |
| `paper` on `ink` | `#fff` on `#111` | **18.66:1** (AAA) |
| `paper` on `danger` | `#fff` on `#9a2f24` | **7.77:1** (AAA) |

`mute` is the one that bears watching. Use it only for supporting text at
`≥0.82rem`. Do not set `mute` on `line` backgrounds — the ratio drops
below AA.

## Do / don't

### Do
- Use `ink` on `paper` for anything that carries meaning.
- Use `line` for every hairline border. `line-strong` (= `ink`) only on
  focus, primary CTAs, and docs-content links.
- Reach for `mute` to de-emphasize supporting copy, not to decorate.
- Let the page breathe — negative space is the palette's sixth color.

### Don't
- Don't introduce a brand hue. The answer is no.
- Don't use `danger` for warnings, validation hints, or badges. It's
  reserved for destructive confirms and hard failures.
- Don't apply `surface-soft` to stacked cards — the 1px line difference
  is too subtle to justify the extra rule. Reserve for docs tables.
- Don't gradient. Don't shadow-as-color. Don't invert the palette per
  theme without a design decision (dark mode is explicitly deferred;
  when it ships it will live as its own complete palette in `tokens.json`,
  not as an inversion).

## Dark mode

Deferred, on purpose. The product is currently paper-on-ink only. When we
ship dark mode:

1. Add `color.dark.*` tokens to `tokens.json`.
2. Mirror to `tokens.css` under `@media (prefers-color-scheme: dark)` or
   `[data-theme="dark"]`.
3. Update every doc that pins a hex literal.

Do not ship a dark mode by inverting `ink` and `paper` in CSS. That
breaks the scanline texture, the shell shadow, and the docs zebra.

## Assets that reference color

When exporting SVGs for slides, social cards, or favicons, use the
**literal hex** (`#111111`, `#ffffff`). Token references (`var(--...)`)
do not resolve inside static SVGs viewed outside a browser context
(Keynote, After Effects, etc).

Inline SVGs embedded in React components can use tokens — see
`src/app/opengraph-image.tsx` for the pattern (it hard-codes
`#000000` / `#ffffff` because `@vercel/og` renders server-side without
our CSS).
