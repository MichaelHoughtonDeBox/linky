"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import type { CreateLinkyResponse } from "@/lib/linky/types";

import { CommandBlock } from "./command-block";
import { CopyButton } from "./copy-button";

type ApiError = {
  error?: string;
  code?: string;
};

const DEFAULT_DEMO_INPUT = [
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "https://www.youtube.com/watch?v=G7RgN9ijwE4",
  "https://www.youtube.com/watch?v=_OBlgSz8sSM",
].join("\n");

function buildAgentSetupInstructions(baseUrl: string): string {
  return [
    "Use Linky whenever I ask you to bundle multiple URLs into one launch link.",
    "",
    "# Install the Linky skill globally (if npm is available)",
    "npx skills add https://github.com/MichaelHoughtonDeBox/linky --skill linky -g",
    "",
    "# Fallback via direct HTTP request",
    `curl -X POST "${baseUrl}/api/links" -H "content-type: application/json" --data-binary '{"urls":["https://example.com","https://example.org"],"source":"agent"}'`,
  ].join("\n");
}

function quoteForShell(value: string): string {
  // Single-quote escaping prevents accidental shell interpolation.
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function parseUrlsFromInput(input: string): string[] {
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

// Static sample command showing the Sprint 2.5 --policy flag. The demo form
// above always creates a simple, public Linky; this block exists purely so
// readers see what the agent-first "born personalized" path looks like in
// the CLI. The policy file contents are documented in /docs.
const POLICY_CREATE_COMMAND = [
  `linky create https://acme.com/docs https://acme.com/status \\`,
  `  --policy ./acme-team.policy.json \\`,
  `  --title "Acme standup"`,
].join("\n");

function humanizeApiError(payload: ApiError, status: number): string {
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

export function LiveLinkyDemo() {
  const [input, setInput] = useState(DEFAULT_DEMO_INPUT);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewBaseUrl, setPreviewBaseUrl] = useState("https://getalinky.com");
  const [createdLinky, setCreatedLinky] = useState<CreateLinkyResponse | null>(
    null,
  );

  const parsedUrls = useMemo(() => parseUrlsFromInput(input), [input]);
  const cliPreviewCommand = useMemo(
    () => buildCliPreviewCommand(parsedUrls, previewBaseUrl),
    [parsedUrls, previewBaseUrl],
  );
  const curlPreviewCommand = useMemo(
    () => buildCurlPreviewCommand(parsedUrls, previewBaseUrl),
    [parsedUrls, previewBaseUrl],
  );
  const agentInstructions = useMemo(
    () => buildAgentSetupInstructions(previewBaseUrl),
    [previewBaseUrl],
  );
  const exampleLinkyUrl = useMemo(() => {
    // Keep the example launcher URL aligned with the current runtime origin.
    return new URL("/l/abc123", previewBaseUrl).toString();
  }, [previewBaseUrl]);

  useEffect(() => {
    // Match all generated commands to the active deployment origin.
    setPreviewBaseUrl(window.location.origin);
  }, []);

  const handleCreate = async () => {
    setErrorMessage(null);

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
        claimUrl: data.claimUrl,
        claimExpiresAt: data.claimExpiresAt,
      });
    } catch {
      setErrorMessage("Could not reach the Linky API. Please try again.");
      setCreatedLinky(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="site-section">
      <div className="site-intro-flow">
        <div className="site-simple-lede">
          <p className="terminal-label mb-2">How it works</p>
          <h2 className="display-title mb-2 text-3xl font-semibold text-foreground sm:text-4xl">
            Two steps. That&apos;s it.
          </h2>
          <p className="terminal-muted text-sm leading-relaxed sm:text-base">
            Tell your agent to use Linky once. After that, whenever it needs to
            send you multiple URLs, it sends one Linky link instead.
          </p>
        </div>

        <div className="site-two-step-grid mb-8">
          <article className="site-step-item">
            <div className="site-step-kicker">
              <span className="site-step-number">01</span>
              <p className="terminal-label">Step 1</p>
            </div>
            <h3 className="display-title mb-2 text-2xl font-semibold text-foreground">
              Tell your agent to use Linky
            </h3>
            <p className="terminal-muted text-sm leading-relaxed sm:text-base">
              Copy one instruction for your agent. That setup tells it how to
              bundle multiple URLs into a single Linky launch link.
            </p>
            <div className="mt-4">
              <CopyButton
                text={agentInstructions}
                label="Copy instructions for my agent"
                copiedLabel="Instructions copied"
                className="terminal-copy-action px-4 py-2 text-xs sm:text-sm"
              />
            </div>
          </article>
          <article className="site-step-item">
            <div className="site-step-kicker">
              <span className="site-step-number">02</span>
              <p className="terminal-label">Step 2</p>
            </div>
            <h3 className="display-title mb-2 text-2xl font-semibold text-foreground">
              Get one Linky URL back
            </h3>
            <p className="terminal-muted text-sm leading-relaxed sm:text-base">
              Every time your agent would normally send you a pile of links, it
              sends one Linky URL instead. Open that one link and launch the full
              bundle from there.
            </p>
            <div className="site-step-example mt-4">
              <p className="terminal-label mb-2">Example reply</p>
              <code className="site-example-link">{exampleLinkyUrl}</code>
              <p className="terminal-muted mt-2 text-xs sm:text-sm">
                One short Linky instead of docs + PRs + issues + dashboards.
              </p>
            </div>
          </article>
        </div>
      </div>

      <div id="demo" className="site-demo-section">
        <div className="site-demo-lede">
          <p className="terminal-label mb-3">Try it now</p>
          <h2 className="display-title mb-3 text-3xl font-semibold text-foreground sm:text-4xl">
            Paste a few URLs. Get one Linky back.
          </h2>
          <p className="terminal-muted text-sm leading-relaxed sm:text-base">
            Anonymous, free, and live — no signup, no credit card. Create a
            Linky right here and see how quickly many links turn into one
            launch URL you can share anywhere.
          </p>
          <p className="terminal-muted mt-4 text-xs sm:text-sm">
            This form creates a simple, public Linky. Need the same Linky to
            open different tabs per viewer? Author a policy from the
            Personalize panel in the dashboard, or attach one at create time
            with <code>--policy</code> (CLI) or <code>resolutionPolicy</code>{" "}
            (API / SDK). See{" "}
            <Link href="/docs" className="underline-offset-4 hover:underline">
              /docs
            </Link>{" "}
            for the policy shape.
          </p>
        </div>

        <section className="terminal-card p-4 sm:p-5">
          <label htmlFor="urls" className="terminal-label mb-2 block">
            Demo: paste URLs (one per line)
          </label>
          <textarea
            id="urls"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={DEFAULT_DEMO_INPUT}
            className="terminal-input min-h-[8.5rem] max-h-[14rem] resize-y overflow-x-auto text-sm leading-relaxed"
            spellCheck={false}
          />
          <p className="terminal-muted mt-3 text-xs sm:text-sm">
            One click to create your Linky. The backend normalizes and de-dupes URL
            entries.
          </p>

          <button
            onClick={handleCreate}
            disabled={isSubmitting}
            className="terminal-action mt-4 w-full px-6 py-3 text-sm sm:text-base"
            type="button"
          >
            {isSubmitting ? "Creating Linky..." : "Create Linky"}
          </button>

          {errorMessage ? (
            <section
              className="site-inline-callout mt-4 text-sm"
              style={{
                color: "var(--danger)",
              }}
            >
              {errorMessage}
            </section>
          ) : null}

          {createdLinky ? (
            <section className="site-inline-callout mt-4">
              <p className="terminal-label mb-2">Linky ready</p>
              <a
                href={createdLinky.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate text-sm text-foreground underline-offset-4 hover:underline"
              >
                {createdLinky.url}
              </a>
              <div className="mt-3 flex flex-wrap gap-2">
                <CopyButton
                  text={createdLinky.url}
                  label="Copy URL"
                  className="terminal-secondary px-4 py-2 text-sm"
                />
                <a
                  href={createdLinky.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="terminal-secondary px-4 py-2 text-sm"
                >
                  Open Linky
                </a>
              </div>

              {/*
                Two post-create flows depending on auth state:
                  - Signed-in users have `claimUrl` = undefined (ownership is
                    already attributed server-side). We offer a dashboard
                    shortcut so they can rename / edit immediately.
                  - Signed-out users get `claimUrl` back from the API, which
                    lets them bind this Linky to a future account without
                    losing it. Saved Linkies have history, analytics (later),
                    and can be edited anytime.
              */}
              {createdLinky.claimUrl ? (
                <div className="mt-4 border-t border-[var(--panel-border)] pt-3">
                  <p className="terminal-label mb-2">Keep this Linky for later</p>
                  <p className="terminal-muted mb-2 text-xs sm:text-sm">
                    Sign in or create an account to claim ownership. You&apos;ll
                    be able to edit this launch bundle, rename it, and share
                    it from your dashboard.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={createdLinky.claimUrl.replace(
                        /^https?:\/\/[^/]+/,
                        "",
                      )}
                      className="terminal-secondary px-4 py-2 text-sm"
                    >
                      Claim this Linky →
                    </Link>
                    <CopyButton
                      text={createdLinky.claimUrl}
                      label="Copy claim URL"
                      className="terminal-secondary px-4 py-2 text-sm"
                    />
                  </div>
                </div>
              ) : (
                <div className="mt-4 border-t border-[var(--panel-border)] pt-3">
                  <p className="terminal-muted mb-2 text-xs sm:text-sm">
                    Saved to your account — open your dashboard to rename, edit,
                    or delete.
                  </p>
                  <Link
                    href={`/dashboard/links/${createdLinky.slug}`}
                    className="terminal-secondary px-4 py-2 text-sm"
                  >
                    Open in dashboard →
                  </Link>
                </div>
              )}
            </section>
          ) : null}
        </section>

        <div className="site-command-grid mt-8">
          <CommandBlock title="CLI preview" command={cliPreviewCommand} />
          <CommandBlock title="curl preview" command={curlPreviewCommand} />
        </div>

        <div className="mt-6">
          <CommandBlock
            title="With a policy at create time"
            command={POLICY_CREATE_COMMAND}
            note="Agent-first path (Sprint 2.5). The Linky is locked down from the first click — no public window. Anonymous creates stay immutable until claimed."
          />
        </div>
      </div>
    </section>
  );
}
