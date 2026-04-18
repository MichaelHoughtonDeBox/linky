# Motion

Motion in Linky is short, scoped, and cued to user action. No ambient
animation. No loops. No decorative parallax.

## Principles

1. **Every animation confirms an intent.** The user moved, the user
   focused, the user landed on the page. If nothing happened, nothing
   moves.
2. **≤460ms, and usually ≤160ms.** The longest animation we ship is the
   page-entrance shell rise. Hover and focus transitions are 120–160ms.
3. **One axis, one property.** Move either `transform` _or_ `opacity`.
   Not both. Not `box-shadow`. Layering transitions across many
   properties reads as busy.
4. **No bounces.** We use `ease`, `ease-out`, and a gentle
   `cubic-bezier(0.2, 0.9, 0.3, 1)` for confirmation beats. No overshoot.
5. **`prefers-reduced-motion` disables the entrance.** Hover + focus
   stay (they're functional). The shell-rise animation goes away.

## Durations

| Token | Value | Use |
|---|---|---|
| `instant`  | 80ms  | Copy-button flash, chip focus. |
| `fast`     | 120ms | Hover transitions (border, opacity, color). |
| `base`     | 160ms | Input focus lift + ring. |
| `entrance` | 460ms | Shell rise on first paint. |

## Easings

| Token | Value | Use |
|---|---|---|
| `standard`   | `ease` | Default for hover/focus. |
| `out`        | `ease-out` | Entrance animations. |
| `in-out`     | `cubic-bezier(0.4, 0, 0.2, 1)` | Rare — two-phase moves. |
| `spring-ish` | `cubic-bezier(0.2, 0.9, 0.3, 1)` | Confirmation beats (button press, copy success). |

## Recipes

### Shell entrance

```css
@keyframes shell-rise {
  from { opacity: 0; transform: translateY(12px) scale(0.995); }
  to   { opacity: 1; transform: translateY(0)    scale(1); }
}

.site-shell,
.terminal-shell {
  animation: shell-rise var(--linky-duration-entrance) var(--linky-ease-out) both;
}

@media (prefers-reduced-motion: reduce) {
  .site-shell,
  .terminal-shell { animation: none; }
}
```

Entrance is the only ambient-ish animation we ship, and it plays exactly
once per navigation.

### Hover lift

```css
.terminal-action {
  transition:
    transform var(--linky-duration-fast) var(--linky-ease-standard),
    box-shadow var(--linky-duration-fast) var(--linky-ease-standard);
}

.terminal-action:hover {
  transform: translateY(calc(var(--linky-lift) * -1));
  box-shadow: var(--linky-shadow-cta);
}
```

1px. Not 2px. Not 4px.

### Focus ring + lift

```css
.terminal-input:focus {
  outline: none;
  border-color: var(--linky-color-line-strong);
  box-shadow: var(--linky-shadow-focus);
  transform: translateY(calc(var(--linky-lift) * -1));
  transition:
    border-color var(--linky-duration-base) var(--linky-ease-standard),
    box-shadow var(--linky-duration-base) var(--linky-ease-standard),
    transform var(--linky-duration-base) var(--linky-ease-standard);
}
```

### Copy confirmation

Swap the label ("Copy" → "Copied"). Hold the new label for 1100ms, then
fade back. Movement is discouraged — the text change is the confirmation.

## Framer Motion recipes

For client components that need more than a CSS transition:

```tsx
import { motion } from "framer-motion";
import tokens from "../../design/tokens.json";

const fast = parseInt(tokens.motion.duration.fast.$value, 10) / 1000;

<motion.div
  initial={{ opacity: 0, y: 4 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: fast, ease: [0.2, 0.9, 0.3, 1] }}
/>
```

Rules:

- Durations always resolved from `tokens.json`. Don't hard-code seconds.
- `y` offset never exceeds `12px`.
- `scale` changes never exceed `0.995 → 1`.
- No `rotate`. No infinite animation loops. No `repeatType: "mirror"`.

## After Effects / Rive recipes

When cutting social videos or hero animations outside the web stack:

- Base frame rate: **30fps**. Cuts are short, not cinematic.
- Background: `#ffffff`. Scanline overlay baked at 0.24 opacity.
- Hero slash draws in over 12 frames (`0.4s`) with a square-cap pencil
  at 64px stroke.
- Wordmark fades in at frame 14, `y: 4 → 0` over 8 frames.
- Hold the composed frame for 1s, then cut.

Export settings:

- **MP4** (h.264, 12Mbps, 1080p30 or 2160p30) for social.
- **WebM** (vp9, 8Mbps) for inline `/design` route previews.
- **GIF** is a last resort; dither kills the scanline.

## CLI motion

The CLI uses TTY color (`chalk`-style) but no animation. If we add
spinners, match the terminal aesthetic:

```
|/-\
```

Classic ASCII spinner, ~100ms per frame, square-capped characters only.
No emoji spinners. No braille spinners. This is a deliberate constraint.

## What not to ship

- No scroll-driven animations.
- No "magic" parallax on the hero.
- No "floating" chips or cards that bob.
- No gradient shimmers, no rainbow borders, no CSS tricks that rely on
  color.
- No JavaScript animations that a CSS transition could handle.
