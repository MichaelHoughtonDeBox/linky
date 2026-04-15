"use client";

import { useMemo, useState } from "react";

import type { CreateLinkyResponse } from "@/lib/linky/types";

type ApiError = {
  error?: string;
  code?: string;
};

function parseUrlsFromInput(input: string): string[] {
  // Trim and drop empty lines so pasting from notes and chat works cleanly.
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function buildCliPreviewCommand(urlCount: number): string {
  const urlArgs =
    urlCount > 0
      ? Array.from({ length: Math.min(urlCount, 2) }, (_, i) => `https://url-${i + 1}.com`).join(" ")
      : "https://url-1.com https://url-2.com";

  return `npx @linky/linky create ${urlArgs} --json`;
}

function humanizeApiError(payload: ApiError, status: number): string {
  // Keep infrastructure details out of the primary UX message.
  if (payload.code === "RATE_LIMITED") {
    return "Too many create requests right now. Please wait a moment and retry.";
  }

  if (payload.code === "INVALID_URLS") {
    return payload.error ?? "Please check your URL list format.";
  }

  if (status >= 500) {
    return "Linky is temporarily unavailable. Try again in a few seconds.";
  }

  return payload.error ?? "Failed to create Linky.";
}

export default function Home() {
  const [input, setInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createdLinky, setCreatedLinky] = useState<CreateLinkyResponse | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  const parsedUrls = useMemo(() => parseUrlsFromInput(input), [input]);
  const cliPreviewCommand = useMemo(() => buildCliPreviewCommand(parsedUrls.length), [parsedUrls.length]);

  const handleCreate = async () => {
    setErrorMessage(null);
    setCopied(false);

    if (parsedUrls.length === 0) {
      setErrorMessage("Add at least one URL before creating a Linky.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/linkies", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          urls: parsedUrls,
          source: "web",
        }),
      });

      const data = (await response.json()) as CreateLinkyResponse & ApiError;

      if (!response.ok) {
        setErrorMessage(humanizeApiError(data, response.status));
        setCreatedLinky(null);
        return;
      }

      setCreatedLinky({
        slug: data.slug,
        url: data.url,
      });
    } catch {
      setErrorMessage("Could not reach the Linky API. Please try again.");
      setCreatedLinky(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!createdLinky) {
      return;
    }

    try {
      await navigator.clipboard.writeText(createdLinky.url);
      setCopied(true);
    } catch {
      setErrorMessage("Clipboard copy failed. You can copy the URL manually.");
    }
  };

  return (
    <div className="terminal-stage flex flex-1 items-start justify-center px-6 py-10 sm:py-12">
      <main className="terminal-shell w-full max-w-6xl p-6 sm:p-8 lg:p-10">
        <header className="mb-7">
          <p className="terminal-label mb-3">CLI-FIRST LINK ORCHESTRATOR</p>
          <h1 className="display-title mb-2 text-5xl leading-[0.9] font-semibold text-foreground sm:text-6xl">
            Linky
          </h1>
          <p className="terminal-muted max-w-3xl text-sm leading-relaxed sm:text-base">
            Build one short launch URL for a full working set of tabs. Perfect for
            standups, incident response, and agent handoffs.
          </p>
          <div className="terminal-metrics mt-4">
            <span className="terminal-chip">
              {parsedUrls.length} URL{parsedUrls.length === 1 ? "" : "s"} queued
            </span>
            <span className="terminal-chip">slug: auto-generated</span>
          </div>
        </header>

        <div className="terminal-stack">
          <section className="terminal-card p-4 sm:p-5 lg:p-6">
            <label htmlFor="urls" className="terminal-label mb-2 block">
              URL BUNDLE INPUT
            </label>
            <textarea
              id="urls"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={"https://github.com/org/repo/pull/1\nhttps://github.com/org/repo/pull/2\nhttps://linear.app/org/issue/ABC-123"}
              className="terminal-input min-h-[17rem] resize-y overflow-x-auto text-sm leading-relaxed"
              spellCheck={false}
            />
            <p className="terminal-muted mt-3 text-xs sm:text-sm">
              Paste one URL per line. Duplicate URLs are normalized and de-duped
              server-side.
            </p>
            <div className="terminal-card mt-4 overflow-hidden p-3">
              <p className="terminal-label mb-2">CLI PREVIEW</p>
              <code className="block overflow-x-auto text-xs text-foreground sm:text-sm">
                {cliPreviewCommand}
              </code>
            </div>
          </section>

          <section className="terminal-card p-4 sm:p-5 lg:p-6">
            <p className="terminal-label mb-2 block">CREATE SHORT LINKY</p>
            <p className="terminal-muted mb-5 text-xs sm:text-sm">
              Keep it simple for now: Linky always auto-generates a unique slug.
            </p>

            <button
              onClick={handleCreate}
              disabled={isSubmitting}
              className="terminal-action w-full px-6 py-3 text-sm sm:text-base"
            >
              {isSubmitting ? "Creating Linky..." : "Create Linky"}
            </button>

            <p className="terminal-muted mt-3 text-xs">
              Primary action generates one short launch URL from your bundle.
            </p>
          </section>

          {errorMessage ? (
            <section
              className="terminal-card px-4 py-3 text-sm"
              style={{
                borderColor:
                  "color-mix(in srgb, var(--danger) 52%, var(--panel-border) 48%)",
                color: "var(--danger)",
              }}
            >
              {errorMessage}
            </section>
          ) : null}

          {createdLinky ? (
            <section className="terminal-card p-4 sm:p-5">
              <p className="terminal-label mb-2">LINKY READY</p>
              <a
                href={createdLinky.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate text-sm text-foreground underline-offset-4 hover:underline"
              >
                {createdLinky.url}
              </a>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={handleCopy}
                  className="terminal-secondary px-4 py-2 text-sm"
                >
                  {copied ? "Copied" : "Copy URL"}
                </button>
                <a
                  href={createdLinky.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="terminal-secondary px-4 py-2 text-sm"
                >
                  Open Linky
                </a>
              </div>
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}
