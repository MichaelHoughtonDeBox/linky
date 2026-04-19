import Link from "next/link";

import { CommandBlock } from "@/components/site/command-block";

const EX_BASIC =
  "linky create https://example.com https://example.org";

const EX_WITH_EMAIL =
  'linky create https://example.com --email alice@example.com --title "Standup bundle"';

const EX_WITH_POLICY =
  "linky create https://acme.com/docs --policy ./acme-team.policy.json";

const EX_STDIN =
  'echo "https://example.com" | linky create --stdin --json';

const EX_POLICY_STDIN = [
  "cat policy.json | linky create \\",
  "  https://acme.com/docs \\",
  "  --policy - \\",
  '  --email alice@acme.com',
].join("\n");

const EX_AUTH_SET_KEY = "linky auth set-key $LINKY_API_KEY";

const EX_UPDATE =
  'linky update abc123 --title "Release bundle v2" --policy ./policy.json';

const EX_WHOAMI = "linky auth whoami --json";

export default function DocsCliPage() {
  return (
    <>
      <p className="terminal-label">Reference — CLI</p>
      <h1 className="display-title text-4xl leading-[0.95] font-semibold text-foreground sm:text-5xl">
        CLI reference
      </h1>
      <p className="docs-lede">
        The package ships a <code>linky</code> command with zero runtime
        dependencies. Works identically in shells, CI, and agent tool
        wrappers.
      </p>

      <section className="docs-section">
        <p className="terminal-label">Usage</p>
        <pre className="docs-json">
          <code>{`linky create <url1> <url2> [url3] ... [options]
linky <url1> <url2> [url3] ... [options]
linky update <slug> [options]
linky list [--json] [--limit N] [--offset N]
linky get <slug> [--json]
linky history <slug> [--json]
linky insights <slug> [--range 7d|30d|90d] [--json]
linky delete <slug> --force
linky auth set-key <apiKey>
linky auth clear
linky auth whoami [options]
linky auth keys list [--json]
linky auth keys create <name> [--scopes links:read,links:write] [--rate-limit N]
linky auth keys revoke <id>
linky mcp`}</code>
        </pre>
        <p>
          The <code>create</code> subcommand is optional — any positional
          arguments that look like URLs are treated as a create call.
        </p>
        <p>
          Every authed read command supports <code>--json</code> so agents
          scripting the CLI directly get structured DTOs instead of the
          human-readable view. The wire shape matches the{" "}
          <Link href="/docs/api">HTTP API</Link>.
        </p>
      </section>

      <section className="docs-section">
        <p className="terminal-label">Read commands (Sprint 2.8)</p>
        <div className="docs-table-wrap">
          <table className="docs-table">
            <thead>
              <tr>
                <th>Command</th>
                <th>Purpose</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>linky list</code>
                </td>
                <td>List your Linky bundles, newest-updated first.</td>
                <td>
                  Org-context keys see org-owned bundles; user keys see
                  personal ones. <code>--limit</code> defaults to 20 (max 100);{" "}
                  <code>--offset</code> paginates.
                </td>
              </tr>
              <tr>
                <td>
                  <code>linky get &lt;slug&gt;</code>
                </td>
                <td>Show a single Linky in full detail.</td>
                <td>
                  Returns URLs, metadata, owner, and any attached
                  resolution policy.
                </td>
              </tr>
              <tr>
                <td>
                  <code>linky history &lt;slug&gt;</code>
                </td>
                <td>Show the append-only edit history.</td>
                <td>
                  Every PATCH appends a version. Newest-first;
                  <code>--json</code> dumps the full DTO array.
                </td>
              </tr>
              <tr>
                <td>
                  <code>linky insights &lt;slug&gt;</code>
                </td>
                <td>
                  Render totals, per-rule breakdown, and a daily
                  sparkline.
                </td>
                <td>
                  Sparkline is TTY-only;<code>--json</code> prints the
                  full DTO. Range defaults to 30d.
                </td>
              </tr>
              <tr>
                <td>
                  <code>linky delete &lt;slug&gt; --force</code>
                </td>
                <td>Soft-delete a Linky.</td>
                <td>
                  Requires <code>--force</code> as a typo-guard; no-op
                  without it. Requires admin role on org-owned bundles.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="docs-section">
        <p className="terminal-label">Key management (Sprint 2.8)</p>
        <div className="docs-table-wrap">
          <table className="docs-table">
            <thead>
              <tr>
                <th>Command</th>
                <th>Purpose</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>linky auth keys list</code>
                </td>
                <td>Show active + revoked API keys for the active subject.</td>
                <td>
                  Requires <code>keys:admin</code>. Prefix shown; secrets never
                  are.
                </td>
              </tr>
              <tr>
                <td>
                  <code>linky auth keys create &lt;name&gt;</code>
                </td>
                <td>Mint a new API key. Secret printed ONCE.</td>
                <td>
                  <code>--scopes links:read,links:write,keys:admin</code>{" "}
                  (comma-separated);{" "}
                  <code>--rate-limit N</code> (per-hour quota, 0 = unlimited,
                  default 1000, max 100000).
                </td>
              </tr>
              <tr>
                <td>
                  <code>linky auth keys revoke &lt;id&gt;</code>
                </td>
                <td>Revoke an active key by numeric id.</td>
                <td>Idempotent.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="docs-section">
        <p className="terminal-label">Create options</p>
        <div className="docs-table-wrap">
          <table className="docs-table">
            <thead>
              <tr>
                <th>Flag</th>
                <th>Value</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>--base-url</code>
                </td>
                <td>url</td>
                <td>
                  Linky API/web base URL. Defaults to{" "}
                  <code>$LINKY_BASE_URL</code> or{" "}
                  <code>https://getalinky.com</code>.
                </td>
              </tr>
              <tr>
                <td>
                  <code>--stdin</code>
                </td>
                <td>—</td>
                <td>Read additional URLs from stdin, one per line.</td>
              </tr>
              <tr>
                <td>
                  <code>--email</code>
                </td>
                <td>address</td>
                <td>
                  Anonymous create only. Flags the claim token for the named
                  recipient so they can bind ownership after signing in.
                </td>
              </tr>
              <tr>
                <td>
                  <code>--title</code>
                </td>
                <td>string</td>
                <td>Optional title stored with the Linky.</td>
              </tr>
              <tr>
                <td>
                  <code>--description</code>
                </td>
                <td>string</td>
                <td>Optional description stored with the Linky.</td>
              </tr>
              <tr>
                <td>
                  <code>--policy</code>
                </td>
                <td>path</td>
                <td>
                  JSON file containing a <code>resolutionPolicy</code>. Use{" "}
                  <code>-</code> to read policy JSON from stdin.
                </td>
              </tr>
              <tr>
                <td>
                  <code>--client</code>
                </td>
                <td>
                  &lt;tool&gt;/&lt;version&gt;
                </td>
                <td>
                  Client attribution sent as the <code>Linky-Client</code>{" "}
                  header. Malformed values are silently dropped by the server.
                </td>
              </tr>
              <tr>
                <td>
                  <code>--json</code>
                </td>
                <td>—</td>
                <td>
                  Machine-readable output. Includes <code>claimToken</code>{" "}
                  and <code>warning</code> on anonymous creates.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="docs-section">
        <p className="terminal-label">Update options</p>
        <div className="docs-table-wrap">
          <table className="docs-table">
            <thead>
              <tr>
                <th>Flag</th>
                <th>Value</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>--title</code>
                </td>
                <td>string</td>
                <td>Replace the Linky title.</td>
              </tr>
              <tr>
                <td>
                  <code>--description</code>
                </td>
                <td>string</td>
                <td>Replace the description.</td>
              </tr>
              <tr>
                <td>
                  <code>--description-null</code>
                </td>
                <td>—</td>
                <td>Clear the description.</td>
              </tr>
              <tr>
                <td>
                  <code>--url</code>
                </td>
                <td>url</td>
                <td>
                  Repeat to replace the full ordered URL list.
                </td>
              </tr>
              <tr>
                <td>
                  <code>--urls-file</code>
                </td>
                <td>path</td>
                <td>
                  Replace the URL list from a newline-delimited file.
                </td>
              </tr>
              <tr>
                <td>
                  <code>--policy</code>
                </td>
                <td>path</td>
                <td>Replace the full resolution policy from JSON.</td>
              </tr>
              <tr>
                <td>
                  <code>--clear-policy</code>
                </td>
                <td>—</td>
                <td>Clear the resolution policy.</td>
              </tr>
              <tr>
                <td>
                  <code>--api-key</code>
                </td>
                <td>key</td>
                <td>
                  Override the stored or env API key for this one command.
                </td>
              </tr>
              <tr>
                <td>
                  <code>--json</code>
                </td>
                <td>—</td>
                <td>Machine-readable response payload.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="docs-section">
        <p className="terminal-label">Automation auth</p>
        <p>
          Owner-only CLI commands authenticate with a bearer API key, not a
          browser session. Create a key in the dashboard, then provide it via:
        </p>
        <ol className="list-decimal space-y-1 pl-5 text-sm sm:text-base">
          <li>
            <code>--api-key</code>
          </li>
          <li>
            <code>$LINKY_API_KEY</code>
          </li>
          <li>
            stored config from <code>linky auth set-key</code>
          </li>
        </ol>
        <p>
          Keys carry a scope locked at mint:{" "}
          <code>links:read</code>, <code>links:write</code> (default), or{" "}
          <code>keys:admin</code>. The CLI currently ships with default
          write capability — pick a narrower scope in the dashboard
          when minting, for example if you&apos;re storing the key in an
          agent transcript and want the blast radius capped.{" "}
          <Link
            href="/docs/access-control"
            className="underline-offset-4 hover:underline"
          >
            See the scope matrix →
          </Link>
        </p>
      </section>

      <section className="docs-section">
        <p className="terminal-label">Examples</p>
        <CommandBlock
          title="Basic create"
          command={EX_BASIC}
          note="Anonymous. Prints the short URL and a claim URL in green."
        />
        <CommandBlock
          title="Flagged for a named recipient"
          command={EX_WITH_EMAIL}
          note="--email scopes the claim token; the recipient signs in to take ownership."
        />
        <CommandBlock
          title="Born personalized"
          command={EX_WITH_POLICY}
          note="Policy applies from the first click. Pair with --email on anonymous calls so the claim URL lands with the owner."
        />
        <CommandBlock
          title="Policy from stdin"
          command={EX_POLICY_STDIN}
          note="--policy - reads JSON from stdin. Useful for piping from jq or generators."
        />
        <CommandBlock
          title="URLs from stdin, machine-readable"
          command={EX_STDIN}
          note="Combine --stdin and --json for scripted pipelines."
        />
        <CommandBlock
          title="Store an API key locally"
          command={EX_AUTH_SET_KEY}
          note="Writes the key to ~/.config/linky/config.json with user-only permissions."
        />
        <CommandBlock
          title="Update an owned Linky"
          command={EX_UPDATE}
          note="Uses your stored or env API key and appends a new version to history."
        />
        <CommandBlock
          title="Check the active automation subject"
          command={EX_WHOAMI}
          note="Verifies the current API key and shows whether it authenticates as a user or org."
        />
      </section>

      <nav className="docs-next" aria-label="Next steps">
        <span>Next:</span>
        <Link href="/docs/sdk">SDK reference</Link>
        <Link href="/docs/api">API reference</Link>
      </nav>
    </>
  );
}
