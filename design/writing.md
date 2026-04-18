# Writing patterns

Every string in the product should sound like it came from the same
person. That person is agent-native, mildly sardonic, short on words,
and allergic to marketing.

## The one rule

If you'd roll your eyes reading it in someone else's product, don't ship
it.

## Structure

### Hero

```
[kicker: three proof-anchors, mono, uppercase, muted]
[H1:    four words max, display, ink]
[lead:  outcome sentence, body+ size, ink]
[sub:   how + where sentence, body size, muted]
[CTAs:  primary + 1–2 secondary]
[sub-microcopy: anxiety reducers]
```

Working example (`src/app/page.tsx`):

```
Open source · Agent-first · MIT
Many URLs. One Linky.
One short link that opens every tab — for humans or agents alike.
Paste your list, share the link. Works the same in any browser, CLI, or agent prompt.
[Try it now ↓] [Read docs] [Sign up free]
No signup, no credit card. MIT-licensed — self-host anytime.
```

### Section lede

```
[kicker]        ← one-word category ("Who it's for", "FAQ", "Install")
[H2]            ← 5–8 words, display family
[optional sub] ← body paragraph, only when the H2 alone is ambiguous
```

### Use-case line

One sentence. Start with a verb in imperative. Limit to 18 words.

Good: "Give every agent task a clean ending: one Linky instead of 10+
URLs in chat."

Bad: "Linky enables you to easily share a collection of links with your
team, unlocking new levels of productivity."

### FAQ

Each answer: 2–3 sentences. First sentence answers the literal question.
Second sentence gives nuance. Third sentence (optional) points at a
deeper doc or an escape hatch (self-host, API, CLI).

### Empty state

Never apologetic. State what the user needs to do next:

Good: `No launch bundles yet. Create one with \`linky create <url> <url>\` or
use the form above.`

Bad: `Oops! Looks like you don't have any launch bundles. Let's fix that!`

### Errors

Three levels:

1. **Soft**: user can fix it themselves. State the fix, not the cause.
   "Add at least one URL to continue."
2. **Hard**: system failure. "Linky is temporarily unavailable. Try again
   in a few seconds."
3. **Destructive**: dangerous. Name the action explicitly.
   "This deletes the launch bundle for everyone. Anyone with the URL will
   see a not-found page. Type DELETE to confirm."

Never say "Oops" or "Something went wrong". Those are excuses, not
errors.

## Microcopy

- **CTAs**: imperative verb, ≤3 words. "Try it now", "Read docs",
  "Open dashboard", "Create a Linky".
- **Labels**: noun, often a single word. "URLs", "Policy", "Expires".
- **Placeholders**: show, don't tell. `https://example.com` in a URL
  input, not "Enter a URL here".
- **Chip labels**: ALL CAPS with `track-chip` tracking. Three words
  max. "SOURCE: AGENT", "TEAM-OWNED".

## Punctuation

- **Em dashes** (`—`) for breaks. No spaced hyphens, no double hyphens.
- **Middle dots** (`·`) in the kicker for separation:
  `Open source · Agent-first · MIT`.
- **No exclamation marks.** Ever. (The one place they're allowed is in
  code samples where the source uses them — don't introduce new ones.)
- **Backticks** around any code identifier, URL path, env var, or file
  path. In UI, backticks render as `.docs-content code` inline style.
- **Arrows**: `→` for forward flow (`create → claim → custom domain`),
  `↓` for "scroll down" only. `←` and `↑` are reserved and usually a
  sign the copy is explaining something the UI should make obvious.

## Words to cut

Always:

- "seamless", "seamlessly"
- "powerful", "robust", "flexible"
- "game-changing", "cutting-edge", "next-gen"
- "leverage" (use "use")
- "delight", "delightful"
- "easy" (show, don't claim)
- "simple" (show, don't claim)
- "elevate your workflow"
- "unlock powerful workflows"
- "supercharge"
- "the #1 way to..." (ranking claims)

Usually:

- "just" — "just paste your URLs" reads as minimising.
- "really" — filler.
- "super" — as an intensifier. Acceptable only in "superuser" / "superset".

## Forbidden terms (brand landmines)

From `.agents/product-marketing-context.md` → "Customer Language":

- **"Linkies"** (plural) — internal name only. Never in UI / docs /
  marketing. Public plural is **launch bundles**.
- **"URL shortener"** — technically wrong (we bundle, not shorten) and
  anchors us on the wrong shelf. Use "launcher", "launch link", or
  describe the action ("bundles URLs into one short link").
- **"Tracker", "analytics", "attribution"** — off-brand for the
  low-surveillance position. If you genuinely need analytics copy,
  route it through the "answers owner questions, not viewer
  questions" framing in the trust docs.
- **"Account required"** — anonymous creation is the default. Even the
  signed-in version is "sign in to edit", not "account required".
- **"Linky page", "the landing", "activation link", "bind URL"** —
  wrong terminology. The page is the **launcher page**, the handoff
  primitive is the **claim URL**.
- **"Click here to get started!"** — imperative but hollow.
- **Corporate "we"** on a solo-founder project — sounds false. Use "I"
  in founder voice or a passive construction in product voice.

## Capitalization

- **Linky**: always capitalized. Even mid-sentence. It's a brand.
- **launch bundle(s)**: always lowercase. It's a common noun.
- **Sentence case** for UI. We don't Title Case button labels.
- **ALL CAPS** only for kickers and chips (tracked `0.05em`–`0.16em`).

## Numbers + dates

- **ISO dates** in code, humanised in UI: `2026-04-18` → `Apr 18, 2026`.
- **Durations**: "24 hours", not "1 day" (matches the API contract).
- **Counts**: "10 URLs" up to twenty, "32 launch bundles" above. Not
  "ten" / "thirty-two".

## Tone matrix

| Context | Formality | Warmth | Density |
|---|---|---|---|
| Hero | Low | Medium | Low |
| FAQ | Medium | Medium | Medium |
| Docs | Medium | Low | High |
| Errors | Medium | Low | Low |
| CLI help | Low | Low | High |
| Email / receipts | Medium | Medium | Medium |
| Legal (terms, privacy) | High | Low | Low |

Density means information-per-word. Docs are dense. The hero is not.

## Agent-facing strings

Everything a CLI or agent reads should also work in a flat `--json`
output:

- CLI success: one line, plain English. `Linky created: https://getalinky.com/l/abc123`
- CLI claim reminder: one line, plus the URL.
- JSON shape: stable, versioned, documented in `/docs/api`. Never put
  human prose in a JSON value that an agent must parse.

## Example rewrites

| Before | After |
|---|---|
| "Welcome to Linky! Ready to get started?" | "Paste your list, share the link." |
| "Oops, something went wrong." | "Linky is temporarily unavailable. Try again in a few seconds." |
| "Your Linkies" | "Your launch bundles" |
| "Click here to claim" | "Claim this Linky" |
| "Unlock custom domains" | "Custom domains ship with accounts." |
| "Enter your URLs below" | `https://example.com` (placeholder only) |
| "The #1 agent-first URL bundler" | "One short link that opens every tab." |
| "Supercharge your agent workflow" | "Your agent returns one URL instead of ten." |
| "One Linky to open them all." *(retired)* | "Many URLs. One Linky." |
| "Agent-first launch orchestration." *(retired kicker)* | "Open source · Agent-first · MIT" |
| "Powered by Linky" | "Made with Linky · getalinky.com" |

## Final check

Before shipping copy:

1. Would a Claude / Cursor agent parse this and emit a reasonable
   follow-up action?
2. Would a senior IC send this string to a friend without editing it
   first?
3. Have I said anything the product doesn't literally do?

If any is "no", rewrite.
