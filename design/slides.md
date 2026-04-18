# Slides

Linky slides use the same tokens, the same type stack, and the same
constraints as the product. A slide that looks like marketing is wrong.

## Supported tools

- **Keynote** — primary. Template exports to `design/assets/slides/linky.kth`
  when it ships.
- **Google Slides** — fallback for live collaboration. Imports the
  Keynote template, loses some type tracking; re-apply manually.
- **Figma Slides** — preferred for design-led decks. Tokens imported via
  Figma Tokens Studio from `design/tokens.json`.
- **Reveal.js / Spectacle** — for web-first decks. Import
  `design/tokens.css` at the top of the presentation and use the
  `--linky-*` custom properties directly.

## Canvas

| Property | Value |
|---|---|
| Aspect ratio | **16:9** |
| Nominal size | 1920×1080 |
| Background | `#ffffff` (`paper`) |
| Texture | Scanline overlay at 0.24 opacity (optional on slides; hard-keep on video cuts) |
| Safe area | 80px padding on all sides |
| Margins | 160px left/right when used with a sidebar rail |

## Grid

Two layouts carry 90% of decks:

### 1. Full-bleed hero

```
┌────────────────────────────────────────────────┐
│  KICKER                                        │
│                                                │
│   Many URLs.                                   │
│   One Linky.                                   │
│                                                │
│   One short link that opens every tab.         │
│                                                │
│   ───────────────────────────────────          │
│   getalinky.com                                │
└────────────────────────────────────────────────┘
```

Use for: opening slide, section breakers, closing slide.

### 2. Explanatory 2/3 + 1/3

```
┌──────────────────────────────┬───────────────┐
│  KICKER                      │               │
│  H2 in Bricolage 72pt        │  Aside note   │
│                              │  14pt muted   │
│  body text, Plex Mono 28pt   │               │
│                              │               │
│  — bullet 1                  │               │
│  — bullet 2                  │               │
│  — bullet 3                  │               │
└──────────────────────────────┴───────────────┘
```

Use for: product walkthroughs, engineering deep-dives.

## Type

See `design/typography.md` → "Slide recipe" for the exact pt + tracking
table. Slides enlarge the site scale proportionally; they don't invent
new sizes.

The shortcut:

- **Kicker**: Plex Mono, 20pt, 500, +1.8pt tracking, `mute`.
- **H1**: Bricolage, 120pt, 600, -2pt tracking, `ink`.
- **H2**: Bricolage, 72pt, 600, -1.5pt tracking, `ink`.
- **Body**: Plex Mono, 28pt, 400, `ink`.
- **Caption / footer**: Plex Mono, 14pt, 400, +0.7pt tracking, `mute`.

## Color discipline

Slides are ink on paper. Code blocks may use `#fafafa` (`surface-soft`)
cards with 1px `line` borders. `danger` appears only on slides
explicitly about failure modes.

No brand color on slides. If a pitch deck needs "something colorful" to
break up monotony, the answer is a slash mark, an ASCII diagram, or a
full-bleed monochrome photo — not a hue.

## Motion

Keynote / Google Slides default transitions: **none**. Use "instant"
transitions between every slide. No dissolves, no pushes, no cubes.

Intra-slide animation, where unavoidable:

- Magic Move / Automatic Animate: allowed, only for "build-up" slides
  where bullets appear sequentially.
- Duration: **200ms** max. (Matches our `--linky-duration-base`.)
- Easing: ease-out.
- Never loop. Never reverse.

## Building blocks

Copy these from the template (or build them from the class catalog in
`design/components.md`):

- **Horizontal rule** — 1pt, `#d9d9d9`. Used as a section spine below
  each slide's H1/H2.
- **Wordmark lockup** — slash + "Linky", bottom-left corner, 40px
  wordmark, always present after slide 1.
- **Progress footer** — `1 / 24`, Plex Mono 14pt, bottom-right, `mute`.
- **Code card** — rounded 0, 1pt `#d9d9d9`, 24pt Plex Mono body,
  `#fafafa` fill, 40px padding.
- **Stat block** — Bricolage 180pt figure + Plex Mono 24pt caption. One
  stat per slide, centered.

## Slide types + when to use each

| Type | Use |
|---|---|
| **Cover** | Title only. Hero layout. Always ends with `getalinky.com`. |
| **Section** | Full-bleed H2 with a kicker. Separates major topics. |
| **Concept** | H2 + 3-beat body, 2/3 + 1/3 layout. |
| **Diagram** | Full-bleed ASCII-style diagram in Plex Mono. Use monospace box-drawing characters; render at 32pt. |
| **Code** | Single code card centered on slide. ≤16 lines. ≤80ch. |
| **Stat** | One big number, one caption. |
| **Quote** | Plex Mono 36pt italic-off, em-dashed attribution line in `mute`. |
| **Closing** | Same as Cover with a CTA fragment ("Create a Linky.") |

## ASCII diagrams > illustrations

When a slide needs a picture of "how the product works", reach for ASCII
first:

```
Skill / CLI / SDK / curl / agent
              │
              ▼
        POST /api/links ──► Postgres
              │
              ▼
         /l/[slug] launcher
              │
              ▼
       Open All → every tab fires
```

Rendered in Plex Mono at 32pt, centered, `ink`. This is both
on-brand and infinitely-editable (no PSD round-trip).

## Exporting

- **PDF** for distribution. Use "Best" quality, embed fonts.
- **PNG per slide** for social cuts. 2880×1620 (Retina 1440p).
- **MP4** for video cuts. See `design/animation.md` for encode settings.

Drop exports under `design/assets/slides/` and tag them with a date:
`launch-2026-04-18.pdf`.

## Template checklist

Before shipping a deck:

- [ ] Every slide has 80px safe-area.
- [ ] Every slide uses only sanctioned type sizes.
- [ ] Every slide uses only ink / paper / mute / line / danger.
- [ ] Wordmark lockup is present on every non-cover slide.
- [ ] Progress footer is present on every non-cover slide.
- [ ] No slide uses a Keynote stock illustration. None.
- [ ] The cover slide's H1 matches the deck's one-sentence thesis.
- [ ] The closing slide ends with `getalinky.com` on its own line.

If any box is unchecked, the deck isn't ready to send.
