"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type OpenSummary = {
  opened: number;
  blocked: number;
};

type LinkyLauncherProps = {
  slug: string;
  urls: string[];
  createdAt: string;
  baseUrl: string;
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
}: LinkyLauncherProps) {
  const [openSummary, setOpenSummary] = useState<OpenSummary | null>(null);
  const createdDateLabel = useMemo(() => {
    return new Date(createdAt).toLocaleString();
  }, [createdAt]);

  return (
    <div className="terminal-stage flex flex-1 items-center justify-center px-6 py-14">
      <main className="terminal-shell w-full max-w-4xl p-7 sm:p-10">
        <header className="mb-7">
          <p className="terminal-label mb-3">LAUNCH DECK</p>
          <h1 className="display-title mb-2 text-4xl font-semibold text-foreground sm:text-5xl">
            Linky
          </h1>
          <p className="terminal-muted text-sm sm:text-base">
            Open the full bundle in one action, then fall back to individual links
            if your browser blocks popups.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="terminal-chip">{urls.length} links</span>
            <span className="terminal-chip">slug: {slug}</span>
            <span className="terminal-chip">created: {createdDateLabel}</span>
          </div>
        </header>

        <div className="terminal-card mb-5 p-4">
          <button
            onClick={() => setOpenSummary(openAllUrls(urls))}
            className="terminal-action w-full px-6 py-3 text-sm sm:text-base"
          >
            {OPEN_LINK_KEY} ({urls.length})
          </button>
          <p className="terminal-muted mt-3 text-xs sm:text-sm">
            Browsers require a user click before opening multiple tabs.
          </p>
        </div>

        {openSummary ? (
          <p className="terminal-card mb-5 px-4 py-3 text-sm text-foreground">
            Opened {openSummary.opened} of {urls.length} link
            {urls.length === 1 ? "" : "s"}.
            {openSummary.blocked > 0
              ? " Your browser blocked the rest, so use the manual links below."
              : " All tabs were opened successfully."}
          </p>
        ) : null}

        <section className="terminal-card mb-5 p-4 sm:p-5">
          <p className="terminal-label mb-2">ENABLE POPUPS (ONE TIME)</p>
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

        <ul className="space-y-2">
          {urls.map((url, index) => (
            <li key={url} className="terminal-link-list-item">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 text-sm text-foreground"
              >
                <span className="terminal-chip shrink-0">{index + 1}</span>
                <span className="truncate">{url}</span>
              </a>
            </li>
          ))}
        </ul>

        <Link href="/" className="terminal-secondary mt-6 inline-block px-4 py-2 text-sm">
          Create another Linky
        </Link>
      </main>
    </div>
  );
}
