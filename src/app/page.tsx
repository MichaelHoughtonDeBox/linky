"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import type { CreateLinkyResponse } from "@/lib/linky/types";

type ApiError = {
  error?: string;
  code?: string;
};

function buildAgentSetupInstructions(baseUrl: string): string {
  return `I'd like you to set up ${baseUrl}, the short-link launcher for AI agents.

Install as a skill if I have npm: npx skills add https://github.com/MichaelHoughtonDeBox/linky --skill linky -g

If not, do this instead: curl -X POST "${baseUrl}/api/links" -H "content-type: application/json" --data-binary '{"urls":["https://example.com","https://example.org"],"source":"agent"}'

--`;
}

function quoteForShell(value: string): string {
  // Single-quote shell escaping keeps preview commands copy/paste-safe.
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function parseUrlsFromInput(input: string): string[] {
  // Trim and drop empty lines so pasting from notes and chat works cleanly.
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function buildCliPreviewCommand(urls: string[], baseUrl: string): string {
  const previewUrls =
    urls.length > 0 ? urls : ["https://example.com", "https://example.org"];
  const urlArgs = previewUrls.map((url) => quoteForShell(url)).join(" ");

  return `npx @linky/linky create ${urlArgs} --base-url ${quoteForShell(baseUrl)} --json`;
}

function buildCurlPreviewCommand(urls: string[], baseUrl: string): string {
  const previewUrls =
    urls.length > 0 ? urls : ["https://example.com", "https://example.org"];
  const payload = JSON.stringify({
    urls: previewUrls,
    source: "agent",
  });

  return [
    `curl -X POST ${quoteForShell(`${baseUrl}/api/links`)} \\`,
    `  -H ${quoteForShell("content-type: application/json")} \\`,
    `  --data-binary ${quoteForShell(payload)}`,
  ].join("\n");
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
  const [agentSetupCopied, setAgentSetupCopied] = useState(false);
  const [previewBaseUrl, setPreviewBaseUrl] = useState("https://getalinky.com");
  const [createdLinky, setCreatedLinky] = useState<CreateLinkyResponse | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  const parsedUrls = useMemo(() => parseUrlsFromInput(input), [input]);
  const cliPreviewCommand = useMemo(
    () => buildCliPreviewCommand(parsedUrls, previewBaseUrl),
    [parsedUrls, previewBaseUrl],
  );
  const curlPreviewCommand = useMemo(
    () => buildCurlPreviewCommand(parsedUrls, previewBaseUrl),
    [parsedUrls, previewBaseUrl],
  );

  useEffect(() => {
    // Use current origin so copied and previewed commands run in local and hosted environments.
    setPreviewBaseUrl(window.location.origin);
  }, []);

  const handleCreate = async () => {
    setErrorMessage(null);
    setCopied(false);

    if (parsedUrls.length === 0) {
      setErrorMessage("Add at least one URL before creating a Linky.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/links", {
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

  const handleCopyAgentSetup = async () => {
    try {
      await navigator.clipboard.writeText(
        buildAgentSetupInstructions(previewBaseUrl),
      );
      setAgentSetupCopied(true);
      setErrorMessage(null);
    } catch {
      setErrorMessage(
        "Could not copy setup instructions. Please copy the text manually.",
      );
    }
  };

  return (
    <div className="terminal-stage flex flex-1 items-start justify-center px-5 py-5 sm:py-6">
      <main className="terminal-shell w-full max-w-6xl p-5 sm:p-6 lg:p-7">
        <header className="mb-5">
          <div className="mb-3 flex items-center gap-3">
            <Image
              src="/logo-mark.svg"
              alt="Linky logo mark"
              width={28}
              height={28}
              className="border border-foreground bg-white"
              priority
            />
            <p className="terminal-label">CLI-FIRST LINK ORCHESTRATOR</p>
          </div>
          <h1 className="display-title mb-2 text-5xl leading-[0.9] font-semibold text-foreground sm:text-6xl">
            {/* Prefix slash ties the hero lockup to the core logo mark. */}
            <span aria-hidden="true" className="mr-2 inline-block">
              /
            </span>
            Linky
          </h1>
          <p className="terminal-muted max-w-3xl text-sm leading-relaxed sm:text-base">
            Build one short launch URL for a full working set of tabs. Perfect for
            standups, incident response, and agent handoffs.
          </p>
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={handleCopyAgentSetup}
              className="terminal-copy-action text-xs sm:text-sm"
            >
              <span>Copy setup for my agent</span>
              <span aria-hidden="true" className="terminal-copy-icon">
                {/* Simple copy glyph keeps the call-to-action visually obvious. */}
                <svg
                  viewBox="0 0 24 24"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                >
                  <rect x="9" y="9" width="12" height="12" rx="0" />
                  <rect x="3" y="3" width="12" height="12" rx="0" />
                </svg>
              </span>
            </button>
            <p className="terminal-muted text-[11px] sm:text-xs">
              {agentSetupCopied
                ? "Copied."
                : "npm + curl fallback."}
            </p>
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
              className="terminal-input min-h-[8.5rem] max-h-[14rem] resize-y overflow-x-auto text-sm leading-relaxed"
              spellCheck={false}
            />
            <p className="terminal-muted mt-3 text-xs sm:text-sm">
              Paste one URL per line. Duplicate URLs are normalized and de-duped
              server-side.
            </p>
            <div className="terminal-command-grid mt-4">
              <div className="terminal-card overflow-hidden p-3">
                <p className="terminal-label mb-2">CLI PREVIEW</p>
                <code className="block overflow-x-auto whitespace-pre-wrap break-all text-xs text-foreground sm:text-sm">
                  {cliPreviewCommand}
                </code>
              </div>
              <div className="terminal-card overflow-hidden p-3">
                <p className="terminal-label mb-2">CURL PREVIEW</p>
                <code className="block overflow-x-auto whitespace-pre-wrap break-all text-xs text-foreground sm:text-sm">
                  {curlPreviewCommand}
                </code>
              </div>
            </div>

            <button
              onClick={handleCreate}
              disabled={isSubmitting}
              className="terminal-action mt-4 w-full px-6 py-3 text-sm sm:text-base"
            >
              {isSubmitting ? "Creating Linky..." : "Create Linky"}
            </button>

            <p className="terminal-muted mt-3 text-xs">
              Primary action generates one short launch URL from your bundle.
            </p>

            {errorMessage ? (
              <section
                className="terminal-card mt-3 px-4 py-3 text-sm"
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
              <section className="terminal-card mt-3 p-4">
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
          </section>
        </div>
      </main>
    </div>
  );
}
