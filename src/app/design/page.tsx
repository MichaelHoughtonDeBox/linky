import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";

import { SiteHeader } from "@/components/site/site-header";

import designTokens from "../../../design/tokens.json";

/*
  Living style guide for Linky. Renders from the canonical tokens at
  design/tokens.json so this page cannot drift from the shipped product.
  Every swatch, type specimen, and component demo below is produced by
  the exact classes the product uses — if the product changes, this
  page tracks automatically, and if this page looks wrong the product
  looks wrong.

  Kept intentionally as a single server component: no client-side state,
  no Framer Motion, no interactive controls. The design system's whole
  point is that nothing needs to be animated to be legible.
*/

export const metadata: Metadata = {
  title: "Linky design system",
  description:
    "The canonical brand, tokens, components, and motion rules that Linky ships with. Rendered live from design/tokens.json.",
};

type DesignToken = {
  $value: string;
  $type: string;
  $description?: string;
};

/*
  tokens.json carries sibling `$description` strings alongside the token
  entries themselves, which makes TypeScript widen every map to
  `Record<string, string | DesignToken>`. We want to render just the
  tokens, so `toTokenEntries` filters out the `$`-prefixed metadata keys
  and narrows the result type back to `DesignToken` in one step. One
  helper, no `any`, no per-section cast.
*/
function toTokenEntries(
  input: Record<string, unknown>,
): [string, DesignToken][] {
  return Object.entries(input).flatMap(([key, value]) => {
    if (key.startsWith("$")) return [];
    if (typeof value !== "object" || value === null) return [];
    return [[key, value as DesignToken]];
  });
}

const COLOR_ENTRIES = toTokenEntries(designTokens.color);
const FONT_SIZE_ENTRIES = toTokenEntries(designTokens.fontSize);
const SPACE_ENTRIES = toTokenEntries(designTokens.space);
const RADIUS_ENTRIES = toTokenEntries(designTokens.radius);
const SHADOW_ENTRIES = toTokenEntries(designTokens.shadow);
const DURATION_ENTRIES = toTokenEntries(designTokens.motion.duration);
const EASING_ENTRIES = toTokenEntries(designTokens.motion.easing);

const SECTION_LINKS = [
  { href: "#brand", label: "Brand" },
  { href: "#color", label: "Color" },
  { href: "#typography", label: "Typography" },
  { href: "#space", label: "Space + Radius" },
  { href: "#motion", label: "Motion" },
  { href: "#logo", label: "Logo" },
  { href: "#components", label: "Components" },
  { href: "#patterns", label: "Patterns" },
  { href: "#voice", label: "Voice" },
];

const SANCTIONED_TAGLINES = [
  {
    label: "H1",
    text: "Many URLs. One Linky.",
    note: "Canonical since PR #10. The many→one parallel IS the product.",
  },
  {
    label: "Hero lead",
    text: "One short link that opens every tab — for humans or agents alike.",
    note: "Outcome sentence; names the audience.",
  },
  {
    label: "Hero sub-lead",
    text: "Paste your list, share the link. Works the same in any browser, CLI, or agent prompt.",
    note: "How + where.",
  },
  {
    label: "Sub-CTA microcopy",
    text: "No signup, no credit card. MIT-licensed — self-host anytime.",
    note: "Anxiety-reducers at the conversion moment.",
  },
  {
    label: "Demo heading",
    text: "Paste a few URLs. Get one Linky back.",
    note: "Imperative, concrete.",
  },
];

const RETIRED_COPY = [
  {
    text: "One Linky to open them all.",
    reason:
      "LOTR reference tax + ambiguous \"them\" + cleverness over clarity.",
  },
  {
    text: "Agent-first launch orchestration.",
    reason:
      "Abstract category jargon; doesn't tell a first-time reader which shelf Linky sits on.",
  },
  {
    text: "Give Linky a list of URLs and get back one short launcher link. Purpose-built for agents, workflows, and fast context handoffs.",
    reason: "\"Fast context handoffs\" is vague filler.",
  },
];

export default function DesignSystemPage() {
  return (
    <div className="terminal-stage flex flex-1 items-start justify-center px-5 py-5 sm:py-6">
      <main className="site-shell w-full max-w-6xl p-5 sm:p-6 lg:p-7">
        <SiteHeader currentPath="/design" />

        <section className="site-hero">
          <p className="terminal-label mb-4">Design system · v0.1.0</p>
          <h1 className="display-title mb-5 text-5xl leading-[0.9] font-semibold text-foreground sm:text-6xl">
            The Linky design system.
          </h1>
          <p className="site-hero-lead max-w-3xl text-xl leading-snug font-medium text-foreground sm:text-2xl">
            One source of truth for how Linky looks, speaks, and moves.
          </p>
          <p className="terminal-muted mt-3 max-w-3xl text-base leading-relaxed sm:text-lg">
            Rendered live from{" "}
            <code className="border border-[var(--panel-border)] bg-[var(--linky-color-code-fill)] px-[0.32rem] py-[0.02rem] text-[0.82em]">
              design/tokens.json
            </code>
            . If you&apos;re about to hard-code a hex, size, or duration,
            use a token from this page instead.
          </p>

          <nav
            className="site-hero-cta-row mt-7 flex flex-wrap gap-2"
            aria-label="Design system sections"
          >
            {SECTION_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="terminal-secondary px-3 py-1.5 text-xs"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </section>

        {/* ───────────── Brand ───────────── */}
        <section id="brand" className="site-section">
          <div className="site-section-lede mb-5">
            <p className="terminal-label mb-2">Brand</p>
            <h2 className="display-title text-2xl font-semibold text-foreground sm:text-3xl">
              Many URLs. One Linky.
            </h2>
            <p className="terminal-muted mt-3 text-sm leading-relaxed sm:text-base">
              Positioning, personas, customer language, and launch plan
              live in{" "}
              <code className="border border-[var(--panel-border)] bg-[var(--linky-color-code-fill)] px-[0.32rem] py-[0.02rem] text-[0.82em]">
                .agents/product-marketing-context.md
              </code>
              . The rules below are how that strategy shows up in the
              product.
            </p>
          </div>

          <div className="site-divider-list">
            <article className="site-divider-item">
              <h3 className="mb-2 text-sm font-semibold text-foreground sm:text-base">
                Sanctioned copy
              </h3>
              <ul className="mt-2 space-y-3">
                {SANCTIONED_TAGLINES.map((item) => (
                  <li
                    key={item.text}
                    className="terminal-card p-3 sm:p-4"
                  >
                    <p className="terminal-label mb-1">{item.label}</p>
                    <p className="text-sm leading-relaxed text-foreground sm:text-base">
                      {item.text}
                    </p>
                    <p className="terminal-muted mt-1 text-xs sm:text-sm">
                      {item.note}
                    </p>
                  </li>
                ))}
              </ul>
            </article>

            <article className="site-divider-item">
              <h3 className="mb-2 text-sm font-semibold text-foreground sm:text-base">
                Retired — do not resurrect
              </h3>
              <ul className="mt-2 space-y-3">
                {RETIRED_COPY.map((item) => (
                  <li key={item.text} className="terminal-card p-3 sm:p-4">
                    <p className="text-sm text-[var(--linky-color-mute)] line-through decoration-[1px]">
                      {item.text}
                    </p>
                    <p className="terminal-muted mt-1 text-xs sm:text-sm">
                      {item.reason}
                    </p>
                  </li>
                ))}
              </ul>
            </article>

            <article className="site-divider-item">
              <h3 className="mb-2 text-sm font-semibold text-foreground sm:text-base">
                Product language (strict)
              </h3>
              <div className="docs-table-wrap">
                <table className="docs-table">
                  <thead>
                    <tr>
                      <th>Term</th>
                      <th>Use for</th>
                      <th>Never</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <strong>Linky</strong> (singular)
                      </td>
                      <td>The brand, the short URL, the verb.</td>
                      <td>—</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>launch bundle(s)</strong>
                      </td>
                      <td>The plural in prose.</td>
                      <td>
                        <code>Linkies</code> in UI / docs
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <strong>launcher page</strong>
                      </td>
                      <td>
                        <code>/l/[slug]</code> — Open All lives here.
                      </td>
                      <td>&quot;Linky page&quot;, &quot;the landing&quot;</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>claim URL / claim flow</strong>
                      </td>
                      <td>Agent → human handoff.</td>
                      <td>
                        &quot;activation link&quot;, &quot;bind URL&quot;
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>
          </div>
        </section>

        {/* ───────────── Color ───────────── */}
        <section id="color" className="site-section">
          <div className="site-section-lede mb-5">
            <p className="terminal-label mb-2">Color</p>
            <h2 className="display-title text-2xl font-semibold text-foreground sm:text-3xl">
              Monochrome by design.
            </h2>
          </div>

          <div
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            role="list"
          >
            {COLOR_ENTRIES.map(([key, token]) => (
              <article
                key={key}
                role="listitem"
                className="terminal-card overflow-hidden"
              >
                <div
                  aria-hidden="true"
                  className="border-b border-[var(--panel-border)]"
                  style={{
                    background: token.$value,
                    height: "88px",
                  }}
                />
                <div className="p-3 sm:p-4">
                  <p className="text-sm font-semibold text-foreground">
                    --linky-color-{key}
                  </p>
                  <p className="terminal-muted mt-0.5 text-xs">
                    {token.$value}
                  </p>
                  {token.$description ? (
                    <p className="terminal-muted mt-2 text-xs leading-relaxed">
                      {token.$description}
                    </p>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ───────────── Typography ───────────── */}
        <section id="typography" className="site-section">
          <div className="site-section-lede mb-5">
            <p className="terminal-label mb-2">Typography</p>
            <h2 className="display-title text-2xl font-semibold text-foreground sm:text-3xl">
              Two families. One system.
            </h2>
          </div>

          <div className="site-divider-list">
            <article className="site-divider-item">
              <p className="terminal-label mb-2">Display — Bricolage Grotesque</p>
              <p className="display-title text-5xl leading-[0.9] font-semibold text-foreground sm:text-6xl">
                Many URLs. One Linky.
              </p>
              <p className="terminal-muted mt-2 text-xs sm:text-sm">
                Bricolage 600 · tracking -0.02em · leading 0.9 · hero
                only.
              </p>
            </article>

            <article className="site-divider-item">
              <p className="terminal-label mb-2">
                Mono body — IBM Plex Mono 500
              </p>
              <p className="site-hero-lead text-xl leading-snug font-medium text-foreground sm:text-2xl">
                One short link that opens every tab — for humans or
                agents alike.
              </p>
              <p className="terminal-muted mt-3 text-sm leading-relaxed sm:text-base">
                Paste your list, share the link. Works the same in any
                browser, CLI, or agent prompt.
              </p>
            </article>

            <article className="site-divider-item">
              <p className="terminal-label mb-2">Type scale</p>
              <div className="docs-table-wrap">
                <table className="docs-table">
                  <thead>
                    <tr>
                      <th>Token</th>
                      <th>rem</th>
                      <th>Specimen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FONT_SIZE_ENTRIES.map(([key, token]) => (
                      <tr key={key}>
                        <td>
                          <code>{key}</code>
                        </td>
                        <td>
                          <code>{token.$value}</code>
                        </td>
                        <td>
                          <span style={{ fontSize: token.$value }}>
                            Many URLs. One Linky.
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          </div>
        </section>

        {/* ───────────── Space + Radius ───────────── */}
        <section id="space" className="site-section">
          <div className="site-section-lede mb-5">
            <p className="terminal-label mb-2">Space + Radius</p>
            <h2 className="display-title text-2xl font-semibold text-foreground sm:text-3xl">
              The rhythm is square and 1px.
            </h2>
          </div>

          <div className="site-divider-list">
            <article className="site-divider-item">
              <p className="terminal-label mb-3">Spacing scale</p>
              <ul className="space-y-2">
                {SPACE_ENTRIES.map(([key, token]) => (
                  <li
                    key={key}
                    className="flex items-center gap-3 text-xs sm:text-sm"
                  >
                    <code className="w-20 shrink-0 text-[var(--linky-color-mute)]">
                      space-{key}
                    </code>
                    <code className="w-24 shrink-0 text-[var(--linky-color-mute)]">
                      {token.$value}
                    </code>
                    <div
                      aria-hidden="true"
                      className="h-4 bg-[var(--linky-color-ink)]"
                      style={{ width: token.$value }}
                    />
                  </li>
                ))}
              </ul>
            </article>

            <article className="site-divider-item">
              <p className="terminal-label mb-3">Radius</p>
              <div className="flex flex-wrap items-end gap-4">
                {RADIUS_ENTRIES.map(([key, token]) => (
                  <div key={key} className="text-center">
                    <div
                      aria-hidden="true"
                      className="h-20 w-20 border border-[var(--linky-color-ink)] bg-white"
                      style={{ borderRadius: token.$value }}
                    />
                    <p className="terminal-label mt-2">{key}</p>
                    <p className="terminal-muted text-[0.72rem]">
                      {token.$value}
                    </p>
                  </div>
                ))}
              </div>
              <p className="terminal-muted mt-3 text-xs sm:text-sm">
                Terminal aesthetic is square. 0 is the default and 99%
                of surfaces. <code>pill</code> requires design review.
              </p>
            </article>

            <article className="site-divider-item">
              <p className="terminal-label mb-3">Shadow</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {SHADOW_ENTRIES.map(([key, token]) => (
                  <div key={key} className="text-xs sm:text-sm">
                    <div
                      aria-hidden="true"
                      className="flex h-24 items-center justify-center border border-[var(--panel-border)] bg-white"
                      style={{ boxShadow: token.$value }}
                    >
                      <span className="terminal-label">{key}</span>
                    </div>
                    {token.$description ? (
                      <p className="terminal-muted mt-2 leading-relaxed">
                        {token.$description}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>

        {/* ───────────── Motion ───────────── */}
        <section id="motion" className="site-section">
          <div className="site-section-lede mb-5">
            <p className="terminal-label mb-2">Motion</p>
            <h2 className="display-title text-2xl font-semibold text-foreground sm:text-3xl">
              Short, scoped, cued to action.
            </h2>
            <p className="terminal-muted mt-3 text-sm leading-relaxed sm:text-base">
              Hover the samples to see the transition fire. Nothing
              loops. Nothing moves on its own.
            </p>
          </div>

          <div className="site-divider-list">
            <article className="site-divider-item">
              <p className="terminal-label mb-3">Duration</p>
              <div className="docs-table-wrap">
                <table className="docs-table">
                  <thead>
                    <tr>
                      <th>Token</th>
                      <th>Value</th>
                      <th>Use</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DURATION_ENTRIES.map(([key, token]) => (
                      <tr key={key}>
                        <td>
                          <code>{key}</code>
                        </td>
                        <td>
                          <code>{token.$value}</code>
                        </td>
                        <td>{token.$description ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="site-divider-item">
              <p className="terminal-label mb-3">Easing</p>
              <div className="docs-table-wrap">
                <table className="docs-table">
                  <thead>
                    <tr>
                      <th>Token</th>
                      <th>Value</th>
                      <th>Use</th>
                    </tr>
                  </thead>
                  <tbody>
                    {EASING_ENTRIES.map(([key, token]) => (
                      <tr key={key}>
                        <td>
                          <code>{key}</code>
                        </td>
                        <td>
                          <code>{token.$value}</code>
                        </td>
                        <td>{token.$description ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="site-divider-item">
              <p className="terminal-label mb-3">Interactions</p>
              <div className="flex flex-wrap items-start gap-3">
                <button
                  type="button"
                  className="terminal-action px-4 py-2 text-sm"
                >
                  Primary action
                </button>
                <button
                  type="button"
                  className="terminal-secondary px-4 py-2 text-sm"
                >
                  Secondary action
                </button>
                <button
                  type="button"
                  className="terminal-copy-action px-4 py-2 text-sm"
                >
                  Copy command
                </button>
              </div>
              <p className="terminal-muted mt-3 text-xs sm:text-sm">
                Each button lifts by{" "}
                <code>--linky-lift</code> (1px) on hover over{" "}
                <code>--linky-duration-fast</code> (120ms). Anything
                more is a regression.
              </p>
            </article>
          </div>
        </section>

        {/* ───────────── Logo ───────────── */}
        <section id="logo" className="site-section">
          <div className="site-section-lede mb-5">
            <p className="terminal-label mb-2">Logo</p>
            <h2 className="display-title text-2xl font-semibold text-foreground sm:text-3xl">
              One slash. Square caps. Nothing else.
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[16, 32, 64, 128, 240].map((size) => (
              <div key={size} className="terminal-card p-4 text-center">
                <div className="flex h-48 items-center justify-center">
                  <Image
                    src="/logo-mark.svg"
                    alt="Linky mark"
                    width={size}
                    height={size}
                    className="border border-[var(--linky-color-ink)] bg-white"
                  />
                </div>
                <p className="terminal-label mt-2">{size}×{size}</p>
              </div>
            ))}

            <div className="terminal-card flex items-center justify-center p-4">
              <div className="flex items-center gap-4">
                <Image
                  src="/logo-mark.svg"
                  alt=""
                  width={40}
                  height={40}
                  className="border border-[var(--linky-color-ink)] bg-white"
                />
                <span className="display-title text-3xl leading-none font-semibold text-foreground">
                  Linky
                </span>
              </div>
            </div>

            <div className="terminal-card p-4">
              <p className="terminal-label mb-2">Do / don&apos;t</p>
              <ul className="space-y-2 text-xs leading-relaxed sm:text-sm">
                <li>— Stroke is square. Never round.</li>
                <li>— Angle is 26° from vertical. No rotation.</li>
                <li>— Ink on paper only. No recolor, no gradient.</li>
                <li>— Keep clear space ≥ one mark-height on all sides.</li>
                <li>— Don&apos;t wordmark alone; slash is required.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ───────────── Components ───────────── */}
        <section id="components" className="site-section">
          <div className="site-section-lede mb-5">
            <p className="terminal-label mb-2">Components</p>
            <h2 className="display-title text-2xl font-semibold text-foreground sm:text-3xl">
              Terminal primitives. Site primitives.
            </h2>
          </div>

          <div className="site-divider-list">
            <article className="site-divider-item">
              <p className="terminal-label mb-3">Buttons</p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="terminal-action px-4 py-2 text-sm"
                >
                  terminal-action
                </button>
                <button
                  type="button"
                  className="terminal-secondary px-4 py-2 text-sm"
                >
                  terminal-secondary
                </button>
                <button
                  type="button"
                  className="terminal-copy-action px-4 py-2 text-sm"
                >
                  terminal-copy-action
                </button>
                <button
                  type="button"
                  className="terminal-action px-4 py-2 text-sm"
                  disabled
                >
                  disabled
                </button>
              </div>
            </article>

            <article className="site-divider-item">
              <p className="terminal-label mb-3">Input</p>
              <input
                type="text"
                placeholder="https://example.com"
                className="terminal-input w-full text-sm"
                aria-label="Demo URL input"
                defaultValue=""
              />
            </article>

            <article className="site-divider-item">
              <p className="terminal-label mb-3">Chips</p>
              <div className="terminal-metrics">
                <span className="terminal-chip">Source: agent</span>
                <span className="terminal-chip">Team-owned</span>
                <span className="terminal-chip">Policy attached</span>
                <span className="terminal-chip">Anonymous</span>
              </div>
            </article>

            <article className="site-divider-item">
              <p className="terminal-label mb-3">Code shell</p>
              <div className="terminal-code-shell">
                <div className="terminal-code-head">
                  <span className="terminal-code-dots">
                    <span className="terminal-code-dot" />
                    <span className="terminal-code-dot" />
                    <span className="terminal-code-dot" />
                  </span>
                  <span className="terminal-code-label">bash</span>
                </div>
                <pre className="terminal-code-pre">
                  <code>{`npx getalinky create \\\n  https://example.com \\\n  https://example.org \\\n  --title "Design review"`}</code>
                </pre>
              </div>
            </article>

            <article className="site-divider-item">
              <p className="terminal-label mb-3">Divider list + card</p>
              <div className="site-divider-list">
                <div className="site-divider-item">
                  <p className="text-sm leading-relaxed text-foreground sm:text-base">
                    Hand off full context packs between agents and
                    teammates — one URL replaces a wall of links.
                  </p>
                </div>
                <div className="site-divider-item">
                  <p className="text-sm leading-relaxed text-foreground sm:text-base">
                    Give every agent task a clean ending: one Linky
                    instead of 10+ URLs in chat.
                  </p>
                </div>
              </div>
            </article>
          </div>
        </section>

        {/* ───────────── Patterns ───────────── */}
        <section id="patterns" className="site-section">
          <div className="site-section-lede mb-5">
            <p className="terminal-label mb-2">Patterns</p>
            <h2 className="display-title text-2xl font-semibold text-foreground sm:text-3xl">
              Composing pages out of the primitives.
            </h2>
          </div>

          <div className="site-divider-list">
            <article className="site-divider-item">
              <p className="terminal-label mb-3">Hero composition</p>
              <div className="border border-[var(--panel-border)] bg-white p-5">
                <p className="terminal-label mb-4">
                  Open source · Agent-first · MIT
                </p>
                <p className="display-title mb-5 text-4xl leading-[0.9] font-semibold text-foreground sm:text-5xl">
                  Many URLs. One Linky.
                </p>
                <p className="site-hero-lead max-w-3xl text-lg leading-snug font-medium text-foreground sm:text-xl">
                  One short link that opens every tab — for humans or
                  agents alike.
                </p>
                <p className="terminal-muted mt-3 text-sm sm:text-base">
                  Paste your list, share the link.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="terminal-action px-4 py-2 text-sm"
                  >
                    Try it now ↓
                  </button>
                  <button
                    type="button"
                    className="terminal-secondary px-4 py-2 text-sm"
                  >
                    Read docs
                  </button>
                </div>
                <p className="terminal-muted mt-3 text-xs sm:text-sm">
                  No signup, no credit card. MIT-licensed — self-host
                  anytime.
                </p>
              </div>
            </article>

            <article className="site-divider-item">
              <p className="terminal-label mb-3">
                Launcher attribution footer (spec)
              </p>
              <div className="border border-[var(--panel-border)] bg-white p-5 text-center">
                <button
                  type="button"
                  className="terminal-action px-5 py-2.5 text-sm"
                >
                  Open All (3 tabs)
                </button>
                <p
                  className="terminal-muted mt-6 text-[0.72rem]"
                  style={{ letterSpacing: "0.05em" }}
                  title="Linky does not track your clicks."
                >
                  Made with Linky ·{" "}
                  <a
                    href="https://getalinky.com"
                    className="underline-offset-2 hover:underline"
                  >
                    getalinky.com
                  </a>
                </p>
              </div>
              <p className="terminal-muted mt-3 text-xs leading-relaxed sm:text-sm">
                Hosted free + anonymous launchers only. Hosted paid tier
                removes it; self-hosters configure their own default.
                Hover the footer text for the low-surveillance
                reassurance line.
              </p>
            </article>
          </div>
        </section>

        {/* ───────────── Voice ───────────── */}
        <section id="voice" className="site-section">
          <div className="site-section-lede mb-5">
            <p className="terminal-label mb-2">Voice</p>
            <h2 className="display-title text-2xl font-semibold text-foreground sm:text-3xl">
              Stark. Agent-first. No fluff.
            </h2>
          </div>

          <div className="docs-table-wrap">
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Before</th>
                  <th>After</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Welcome to Linky! Ready to get started?</td>
                  <td>Paste your list, share the link.</td>
                </tr>
                <tr>
                  <td>Oops, something went wrong.</td>
                  <td>
                    Linky is temporarily unavailable. Try again in a few
                    seconds.
                  </td>
                </tr>
                <tr>
                  <td>Your Linkies</td>
                  <td>Your launch bundles</td>
                </tr>
                <tr>
                  <td>Unlock custom domains</td>
                  <td>Custom domains ship with accounts.</td>
                </tr>
                <tr>
                  <td>Supercharge your agent workflow</td>
                  <td>
                    Your agent returns one URL instead of ten.
                  </td>
                </tr>
                <tr>
                  <td>Powered by Linky</td>
                  <td>Made with Linky · getalinky.com</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="terminal-muted mt-6 text-sm leading-relaxed sm:text-base">
            Full seven-sweep editing framework lives in{" "}
            <code className="border border-[var(--panel-border)] bg-[var(--linky-color-code-fill)] px-[0.32rem] py-[0.02rem] text-[0.82em]">
              .agents/skills/copy-editing/SKILL.md
            </code>
            . Run it on every copy change before shipping — especially
            on the landing page and hero.
          </p>
        </section>

        {/* ───────────── Meta ───────────── */}
        <section className="site-section">
          <div className="site-section-lede mb-5">
            <p className="terminal-label mb-2">Meta</p>
            <h2 className="display-title text-2xl font-semibold text-foreground sm:text-3xl">
              Where this lives.
            </h2>
          </div>

          <ul className="site-divider-list">
            {[
              {
                path: "design/tokens.json",
                note: "Canonical tokens. W3C DTCG format; imports cleanly into Figma Tokens Studio, Style Dictionary, and agent tooling.",
              },
              {
                path: "design/tokens.css",
                note: "Same tokens as CSS custom properties, imported by globals.css and the /design route.",
              },
              {
                path: "design/*.md",
                note: "Brand, color, typography, logo, motion, components, layout, writing, slides, animation, accessibility guidance.",
              },
              {
                path: ".agents/product-marketing-context.md",
                note: "Source of truth for strategy. The design system derives from it.",
              },
              {
                path: ".agents/skills/copy-editing/SKILL.md",
                note: "Seven-sweep editing framework for all copy changes.",
              },
            ].map((item) => (
              <li key={item.path} className="site-divider-item">
                <p className="text-sm font-semibold text-foreground sm:text-base">
                  <code>{item.path}</code>
                </p>
                <p className="terminal-muted mt-1 text-xs leading-relaxed sm:text-sm">
                  {item.note}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
