# Typography

Two families. One does display, the other does everything else. That's
the entire typography system.

## Stack

| Role | Family | Weights | Notes |
|---|---|---|---|
| Display | **Bricolage Grotesque** (`--linky-font-display`) | 600 | H1, section H2s. Never body. |
| Everything | **IBM Plex Mono** (`--linky-font-mono`) | 400 / 500 / 600 | Body, UI, kickers, code, CLI transcripts, slide body. |

Both are loaded via `next/font/google` in `src/app/layout.tsx`. Fallback
stacks are `"Avenir Next", sans-serif` (display) and
`Menlo, Monaco, monospace` (mono).

## Scale

All sizes expressed in `rem` so slides can re-map the root to scale the
whole system at once.

| Token | rem | px (@16) | Use |
|---|---|---|---|
| `micro`   | 0.66 | 10.6 | Code-shell labels, terminal eyebrow text. |
| `xs`      | 0.72 | 11.5 | `.terminal-label` — uppercase kickers. |
| `sm`      | 0.82 | 13.1 | Docs body, sidebar links, chips. |
| `base`    | 0.88 | 14.1 | Long-form docs prose. |
| `body`    | 1.00 | 16.0 | Default site paragraph. |
| `lead`    | 1.25 | 20.0 | Hero lead, section lede. |
| `h3`      | 1.35 | 21.6 | Docs H2, component titles. |
| `h2`      | 1.875 | 30.0 | Section H2. |
| `h1`      | 3.00 | 48.0 | Hero H1 mobile baseline. |
| `display` | 3.75 | 60.0 | Hero H1 ≥sm. Slides use `5rem+`. |

## Tracking (letter-spacing)

- **Display** (`-0.02em`). Tightens Bricolage so it feels like a logotype.
- **Lead** (`-0.01em`). Tagline-style; reads as one beat instead of a wall
  of mono.
- **Kicker** (`0.16em`). ALL-CAPS eyebrows. Without this much tracking,
  uppercase mono reads jammed.
- **Chip** (`0.05em`). Small uppercase utility labels.
- **Body** (`0`). Mono doesn't need help; leave it alone.

## Leading

| Token | Value | Use |
|---|---|---|
| `tight`   | 0.9  | Hero H1 only. |
| `snug`    | 1.2  | H2 / H3. |
| `normal`  | 1.44 | Terminal code `<pre>`. |
| `relaxed` | 1.62 | Docs prose. Non-negotiable — anything tighter and
mono long-form is punishing. |

## Hierarchy, in one screenshot

```
Kicker (xs, uppercase, mute, track-kicker)
── H1 (display, display-face, ink, track-display, leading-tight)
Lead (lead, ink, track-lead, leading-snug)
Body (body, mute, leading-relaxed)
```

Anything beyond this and we're inventing a pattern. Don't invent patterns
in marketing copy.

## Rules

- **Never use display for body.** Bricolage at body sizes reads as
  marketing-energy. That's a regression.
- **Never use mono for display.** It's too even; mono at H1 size looks
  like ASCII art.
- **Italics: no.** No italics in mono (Plex Mono italics are distracting
  at UI sizes). No italics in display either — emphasise with weight.
- **ALL CAPS only for kickers and chips.** Mono at ALL CAPS for a
  paragraph is hostile.
- **Underlines are for links.** Don't decorate with underlines. Don't
  strip underlines from links.
- **Line length: 66ch max** for docs prose; the `.site-hero`,
  `.site-intro-flow`, and `.docs-lede` primitives already cap this.

## Slide recipe (Keynote / Google Slides / Figma Slides)

Render Linky slides with the same tokens. Set these master-slide defaults
once and the system carries:

| Slot | Family | Size | Weight | Tracking | Color |
|---|---|---|---|---|---|
| Kicker | IBM Plex Mono | 20pt | 500 | +1.8pt (≈`0.16em`) | `#666666` |
| H1 | Bricolage Grotesque | 120pt | 600 | -2pt (≈`-0.02em`) | `#111111` |
| Lead | IBM Plex Mono | 40pt | 500 | -0.4pt | `#111111` |
| Body | IBM Plex Mono | 28pt | 400 | 0 | `#111111` |
| Code | IBM Plex Mono | 24pt | 400 | 0 | `#111111` on `#fafafa` card |
| Footer | IBM Plex Mono | 14pt | 400 | +0.7pt (`0.05em`) | `#666666` |

Slides run on `#ffffff`. One horizontal rule (`1pt`, `#d9d9d9`) per slide,
used as a section spine. No shadows, no gradients, no decorative shapes.

## Loading performance

`next/font/google` already self-hosts Bricolage + IBM Plex Mono with
`font-display: swap` and preload. Do not re-import Google Fonts via
`<link>` in a `<Head>` — that's a double-load.

For surfaces outside Next.js (slide exports to HTML, marketing
microsites), self-host both families from
`/design/assets/fonts/` if they ship. At time of writing the only
surface this matters for is the printed press kit — see
`design/assets/README.md`.
