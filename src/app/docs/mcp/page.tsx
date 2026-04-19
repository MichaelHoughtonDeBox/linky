import Link from "next/link";

import { toolDefinitions } from "@/app/api/mcp/tools/definitions";

export const metadata = {
  title: "Agent integration (MCP) · Linky docs",
  description:
    "Linky exposes every authed route as an MCP tool. Paste one mcp.json snippet into Cursor, Claude Desktop, Codex, Continue, or Cline to give your agent native create / list / update / insights / key-management access.",
};

// ============================================================================
// /docs/mcp — Sprint 2.8 Chunk E.
//
// The public anchor for every partner / HN / Product Hunt moment this
// sprint unlocks. Intentionally agent-framed ("your agent can create
// Linkies", "your Claude session becomes a teammate") and NOT
// infra-framed ("we support the MCP spec"). The audience cares about
// outcomes; the infra framing reads as a feature list.
//
// Five sections mirror the sprint plan's scope for this page:
//   1. What this is
//   2. Create a read-only key
//   3. Paste into your agent (5 harnesses)
//   4. Verify with mcp-inspector
//   5. Self-host
//   6. Tool reference (auto-generated from definitions.ts at build time)
// ============================================================================

const HOSTED_URL = "https://getalinky.com/api/mcp";

// Deterministic JSON formatting at render time so the copy-paste
// snippets stay stable across deploys. We emit the snippets as
// pre-formatted strings rather than stringifying a JS object on every
// request — JSON.stringify can drift in subtle ways (key order, comma
// placement) that would show up as diffs in copy-paste documentation.
const SNIPPET_CURSOR = `{
  "mcpServers": {
    "linky": {
      "url": "${HOSTED_URL}",
      "headers": {
        "Authorization": "Bearer lkyu_YOUR_PREFIX.YOUR_SECRET"
      }
    }
  }
}`;

const SNIPPET_CLAUDE = `{
  "mcpServers": {
    "linky": {
      "command": "npx",
      "args": ["-y", "@linky/linky", "mcp"],
      "env": {
        "LINKY_API_KEY": "lkyu_YOUR_PREFIX.YOUR_SECRET",
        "LINKY_BASE_URL": "https://getalinky.com"
      }
    }
  }
}`;

const SNIPPET_CODEX = `[mcp_servers.linky]
command = "npx"
args = ["-y", "@linky/linky", "mcp"]

[mcp_servers.linky.env]
LINKY_API_KEY = "lkyu_YOUR_PREFIX.YOUR_SECRET"
LINKY_BASE_URL = "https://getalinky.com"`;

const SNIPPET_CONTINUE = `{
  "mcpServers": [
    {
      "name": "linky",
      "transport": {
        "type": "streamable-http",
        "url": "${HOSTED_URL}",
        "headers": { "Authorization": "Bearer lkyu_YOUR_PREFIX.YOUR_SECRET" }
      }
    }
  ]
}`;

const SNIPPET_CLINE = `{
  "mcpServers": {
    "linky": {
      "url": "${HOSTED_URL}",
      "headers": { "Authorization": "Bearer lkyu_YOUR_PREFIX.YOUR_SECRET" }
    }
  }
}`;

// mcp-inspector is the easiest "did it work?" probe. One line, no
// config. We print the hosted URL explicitly — self-hosters swap the
// URL inline without needing to read the self-host section.
const INSPECTOR_COMMAND =
  `npx @modelcontextprotocol/inspector \\\n  --url ${HOSTED_URL} \\\n  --header "Authorization: Bearer lkyu_YOUR_PREFIX.YOUR_SECRET"`;

type HarnessTab = {
  id: string;
  label: string;
  configPath: string;
  snippet: string;
  format: "JSON" | "TOML";
  note?: string;
};

const HARNESSES: HarnessTab[] = [
  {
    id: "cursor",
    label: "Cursor",
    configPath: ".cursor/mcp.json",
    snippet: SNIPPET_CURSOR,
    format: "JSON",
    note: "Cursor speaks Streamable-HTTP natively; no local bridge required.",
  },
  {
    id: "claude",
    label: "Claude Desktop",
    configPath: "~/Library/Application Support/Claude/claude_desktop_config.json",
    snippet: SNIPPET_CLAUDE,
    format: "JSON",
    note: "Claude Desktop uses the stdio bridge shipped in @linky/linky.",
  },
  {
    id: "codex",
    label: "Codex CLI",
    configPath: "~/.codex/config.toml",
    snippet: SNIPPET_CODEX,
    format: "TOML",
  },
  {
    id: "continue",
    label: "Continue",
    configPath: ".continue/config.json",
    snippet: SNIPPET_CONTINUE,
    format: "JSON",
  },
  {
    id: "cline",
    label: "Cline",
    configPath: "cline_mcp_settings.json",
    snippet: SNIPPET_CLINE,
    format: "JSON",
  },
];

export default function DocsMcpPage() {
  return (
    <>
      <p className="terminal-label">Agents</p>
      <h1 className="display-title text-4xl leading-[0.95] font-semibold text-foreground sm:text-5xl">
        Give your agent native Linky access
      </h1>
      <p className="docs-lede">
        Paste one <code>mcp.json</code> snippet into Cursor, Claude
        Desktop, Codex, Continue, or Cline. Your agent sees all{" "}
        {toolDefinitions.length} Linky tools — create, list, update,
        read insights, manage keys — without leaving the harness.
      </p>

      <section className="docs-section">
        <p className="terminal-label">What this is</p>
        <p>
          Linky speaks the <strong>Model Context Protocol</strong> over
          the Streamable-HTTP transport. Authentication is a standard
          bearer API key, so the same key that works with the{" "}
          <Link href="/docs/cli">CLI</Link> or{" "}
          <Link href="/docs/sdk">SDK</Link> works with every MCP harness.
          Scopes ship from{" "}
          <Link href="/docs/access-control">access control</Link>:{" "}
          <code>links:read</code> is safe to drop into an agent&apos;s
          context;{" "}
          <code>links:write</code> lets an agent create and edit bundles;{" "}
          <code>keys:admin</code> can manage keys (rare).
        </p>
        <p>
          Self-hosters get the same endpoint at{" "}
          <code>/api/mcp</code> on their deployment. No separate service.
        </p>
      </section>

      <section className="docs-section">
        <p className="terminal-label">1 · Create a read-only key</p>
        <p>
          Go to{" "}
          <Link href="/dashboard/api-keys">
            /dashboard/api-keys
          </Link>
          , pick <strong>Read-only</strong>, set a rate limit (default
          1000/hr is fine — it&apos;s a per-key cap on throughput), and
          copy the raw key. Read-only is the right starting scope for
          any agent that&apos;s just summarizing or linking to existing
          bundles — it can&apos;t delete, patch, or mint new keys.
        </p>
        <p>
          Use <code>links:write</code> if you want the agent to create{" "}
          or update Linkies. Every key has its own rate-limit bucket so
          a runaway agent burns its own quota, not yours.
        </p>
      </section>

      <section className="docs-section">
        <p className="terminal-label">2 · Paste into your agent</p>
        <p>
          Five snippets. Every snippet lists the default config path for
          the harness so you know where to drop it. Replace{" "}
          <code>lkyu_YOUR_PREFIX.YOUR_SECRET</code> with the key you
          just minted.
        </p>
        <div className="space-y-4">
          {HARNESSES.map((harness) => (
            <article
              key={harness.id}
              className="terminal-card space-y-2 p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-base font-semibold sm:text-lg">
                  {harness.label}
                </h3>
                <span className="terminal-chip text-xs">
                  {harness.format}
                </span>
              </div>
              <p className="terminal-muted text-xs sm:text-sm">
                Config path: <code>{harness.configPath}</code>
              </p>
              {harness.note ? (
                <p className="terminal-muted text-xs sm:text-sm">
                  {harness.note}
                </p>
              ) : null}
              <pre className="docs-json overflow-x-auto text-xs sm:text-sm">
                <code>{harness.snippet}</code>
              </pre>
            </article>
          ))}
        </div>
      </section>

      <section className="docs-section">
        <p className="terminal-label">3 · Verify with mcp-inspector</p>
        <p>
          Before wiring an agent harness, confirm the endpoint is
          reachable and your key works. The official{" "}
          <code>@modelcontextprotocol/inspector</code> lists every tool
          and lets you call each one interactively.
        </p>
        <pre className="docs-json">
          <code>{INSPECTOR_COMMAND}</code>
        </pre>
      </section>

      <section className="docs-section">
        <p className="terminal-label">4 · Self-host</p>
        <p>
          Replace <code>https://getalinky.com</code> with your
          deployment&apos;s URL anywhere it appears above. No separate
          config, no extra service — <code>/api/mcp</code> ships in the
          same Next.js app that serves the dashboard. You can also kill
          the surface at runtime by setting{" "}
          <code>LINKY_MCP_ENABLED=false</code> (the route returns 503
          with a clear message).
        </p>
      </section>

      <section className="docs-section">
        <p className="terminal-label">
          Tool reference ({toolDefinitions.length})
        </p>
        <p>
          Every tool mirrors one authed HTTP route. Scopes + roles are
          enforced server-side; an agent holding a <code>links:read</code>{" "}
          key will see all {toolDefinitions.length} tools but get a
          <code>-32002 Forbidden</code> error if it tries one that
          requires write or admin.
        </p>
        <div className="docs-table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Tool</th>
                <th scope="col">Description</th>
              </tr>
            </thead>
            <tbody>
              {toolDefinitions.map((tool) => (
                <tr key={tool.name}>
                  <td>
                    <code>{tool.name}</code>
                  </td>
                  <td>{tool.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="docs-section">
        <p className="terminal-label">Troubleshooting</p>
        <ul className="docs-list">
          <li>
            <strong>401 on connect</strong> — the bearer header is
            missing or the key was revoked. Mint a new one at{" "}
            <Link href="/dashboard/api-keys">/dashboard/api-keys</Link>.
          </li>
          <li>
            <strong>-32002 Forbidden on a tool call</strong> — the key
            lacks the required scope. Mint a new key with the scope the
            error message names, or use a higher-scope key.
          </li>
          <li>
            <strong>-32004 Rate limited</strong> — the per-key hourly
            bucket is spent. The error&apos;s <code>data</code> block
            carries <code>retryAfterSeconds</code>. Either wait it out
            or raise the limit by revoking and re-minting.
          </li>
          <li>
            <strong>503 MCP_DISABLED</strong> — the operator flipped{" "}
            <code>LINKY_MCP_ENABLED=false</code>. Not a client-side
            bug; contact the operator.
          </li>
        </ul>
      </section>
    </>
  );
}
