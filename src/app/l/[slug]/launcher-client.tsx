"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { SiteHeader } from "@/components/site/site-header";

type OpenSummary = {
  opened: number;
  blocked: number;
};

type LinkyLauncherProps = {
  slug: string;
  urls: string[];
  createdAt: string;
  baseUrl: string;
  // Sprint 2 — identity-aware resolution props. Defaults preserve the
  // pre-Sprint-2 render for Linkies without a policy attached (the server
  // component sets `policyActive: false` for those).
  policyActive?: boolean;
  viewerIsAnonymous?: boolean;
  viewerLabel?: string | null;
  matchedRuleId?: string | null;
  matchedRuleName?: string | null;
};

const OPEN_LINK_KEY = "Open All";

function openAllUrls(urls: string[]): OpenSummary {
  let opened = 0;
  let blocked = 0;

  urls.forEach((url) => {
    const popup = window.open("", "_blank");

    if (!popup) {
      blocked += 1;
      return;
    }

    // Clearing the opener relationship protects the destination tab from back-navigation attacks.
    popup.opener = null;
    popup.location.replace(url);
    opened += 1;
  });

  return { opened, blocked };
}

export function LinkyLauncher({
  slug,
  urls,
  createdAt,
  baseUrl,
  policyActive = false,
  viewerIsAnonymous = true,
  viewerLabel = null,
  matchedRuleId = null,
  matchedRuleName = null,
}: LinkyLauncherProps) {
  const [openSummary, setOpenSummary] = useState<OpenSummary | null>(null);

  // Sprint 2.7 Chunk A — Open All analytics ping.
  //
  // Fire-and-forget POST to /api/links/:slug/events. We deliberately don't
  // await it or surface failures to the user: the button's real job was
  // already done (tabs opened) by the time this runs. The endpoint is
  // rate-limited server-side and swallows DB errors.
  //
  // `sendBeacon` would be marginally more reliable during tab unload, but
  // browsers cap its payload size and some adblockers shadow-block it. A
  // plain keepalive fetch is the dependable path for our tiny JSON body.
  const reportOpenAllClick = () => {
    try {
      fetch(`/api/links/${encodeURIComponent(slug)}/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "open_all",
          matchedRuleId: matchedRuleId ?? null,
        }),
        keepalive: true,
      }).catch(() => {
        // Network blip / adblock / offline — analytics are best-effort.
      });
    } catch {
      // Older browsers without keepalive. Not worth a fallback path.
    }
  };

  const handleOpenAll = () => {
    reportOpenAllClick();
    setOpenSummary(openAllUrls(urls));
  };

  // Locale-dependent formatting is the classic hydration-mismatch trap:
  // `toLocaleString()` without an explicit locale uses the runtime default,
  // which differs between Node (often en-US) and the browser (user config).
  // We pin locale AND timezone to produce a byte-identical string on server
  // and client. UTC is an acceptable display choice for a public launcher
  // chip — precise local time is not the value being communicated here.
  const createdDateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "UTC",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(createdAt)),
    [createdAt],
  );

  return (
    <div className="terminal-stage flex flex-1 items-start justify-center px-5 py-5 sm:py-6">
      <main className="site-shell w-full max-w-5xl p-5 sm:p-6 lg:p-7">
        <SiteHeader currentPath="/l" />

        <header className="site-hero">
          <p className="terminal-label mb-3">Launch deck</p>
          <h1 className="display-title mb-2 text-4xl font-semibold text-foreground sm:text-5xl">
            Open this Linky in one click
          </h1>
          <p className="terminal-muted text-sm leading-relaxed sm:text-base">
            Trigger the full bundle instantly, then use manual links if popup
            settings block part of the launch.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="terminal-chip">{urls.length} links</span>
            <span className="terminal-chip">slug: {slug}</span>
            <span className="terminal-chip">created: {createdDateLabel} UTC</span>
            {policyActive ? (
              <span className="terminal-chip">personalized</span>
            ) : null}
          </div>
        </header>

        {matchedRuleId ? (
          <section className="site-inline-callout mb-5">
            <p className="terminal-label mb-1">Personalized</p>
            <p className="terminal-muted text-xs leading-relaxed sm:text-sm">
              {viewerLabel ? (
                <>
                  Tuned for <code className="text-foreground">{viewerLabel}</code>
                </>
              ) : (
                <>Tuned for your signed-in identity</>
              )}
              {matchedRuleName ? (
                <>
                  {" "}
                  — matched rule:{" "}
                  <span className="text-foreground">{matchedRuleName}</span>
                </>
              ) : null}
              .
            </p>
          </section>
        ) : null}

        {policyActive && viewerIsAnonymous ? (
          <section
            className="site-inline-callout mb-5 border-l-2"
            style={{ borderLeftColor: "var(--foreground)" }}
          >
            <p className="terminal-label mb-1">This Linky is personalized</p>
            <p className="text-xs leading-relaxed text-foreground sm:text-sm">
              The owner set rules for who sees what. Without signing in you
              will only see the public bundle below — your tailored tabs stay
              hidden until Linky knows who you are.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={`/signin?redirect_url=${encodeURIComponent(`/l/${slug}`)}`}
                className="terminal-action inline-block px-4 py-2 text-xs sm:text-sm"
              >
                Sign in to see your tabs
              </Link>
              <Link
                href={`/signup?redirect_url=${encodeURIComponent(`/l/${slug}`)}`}
                className="terminal-secondary inline-block px-4 py-2 text-xs sm:text-sm"
              >
                Create a free account
              </Link>
            </div>
          </section>
        ) : null}

        <section className="terminal-card mb-5 p-4">
          <button
            onClick={handleOpenAll}
            className="terminal-action w-full px-6 py-3 text-sm sm:text-base"
            type="button"
          >
            {OPEN_LINK_KEY} ({urls.length})
          </button>
          <p className="terminal-muted mt-3 text-xs sm:text-sm">
            Browsers require a user click before opening multiple tabs.
          </p>
        </section>

        {openSummary ? (
          <p className="site-inline-callout mb-5 text-sm text-foreground">
            Opened {openSummary.opened} of {urls.length} link
            {urls.length === 1 ? "" : "s"}.
            {openSummary.blocked > 0
              ? " Your browser blocked the rest, so use the manual links below."
              : " All tabs were opened successfully."}
          </p>
        ) : null}

        <section className="site-inline-callout mb-5">
          <p className="terminal-label mb-2">Enable popups (one time)</p>
          <ol className="terminal-muted list-decimal space-y-1 pl-5 text-xs leading-relaxed sm:text-sm">
            <li>
              Open Linky at <code>{baseUrl}</code>.
            </li>
            <li>
              Click <strong>{OPEN_LINK_KEY}</strong> once (let it get blocked).
            </li>
            <li>In the address bar, click the popup-blocked icon.</li>
            <li>
              Select{" "}
              <strong>
                Always allow pop-ups and redirects from this site
              </strong>
              .
            </li>
            <li>
              Reload the page and click <strong>{OPEN_LINK_KEY}</strong> again.
            </li>
          </ol>
        </section>

        <section className="site-section">
          <p className="terminal-label mb-3">Manual links</p>
          <ul className="site-divider-list">
            {urls.map((url, index) => (
              <li key={url} className="site-divider-item">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-sm text-foreground"
                >
                  <span className="terminal-chip shrink-0">{index + 1}</span>
                  <span className="truncate">{url}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/" className="terminal-secondary inline-block px-4 py-2 text-sm">
            Create another Linky
          </Link>
          <Link href="/docs" className="terminal-secondary inline-block px-4 py-2 text-sm">
            Docs
          </Link>
        </div>
      </main>
    </div>
  );
}
