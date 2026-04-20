import Link from "next/link";

// ---------------------------------------------------------------------------
// SDK reference. Sprint 2.8 widened the SDK from two top-level functions
// (`createLinky`, `updateLinky`) to a full `LinkyClient` class that mirrors
// every authed HTTP route. We document both surfaces — the top-level
// functions stay for anonymous creates + one-shot updates (zero-config
// common case), and the client class is for anything beyond that.
//
// Authoritative types live in `sdk/client.d.ts`. Every shape block here
// is copied verbatim from that file so autocomplete + docs never drift.
// ---------------------------------------------------------------------------

const TOP_LEVEL_TYPES = `export type CreateLinkyOptions = {
  urls: string[];
  baseUrl?: string;
  source?: string;
  metadata?: Record<string, unknown>;
  email?: string;
  title?: string;
  description?: string;
  urlMetadata?: UrlMetadata[];
  client?: string;
  resolutionPolicy?: ResolutionPolicy;
  fetchImpl?: typeof fetch;
};

export type CreateLinkyResult = {
  slug: string;
  url: string;
  claimUrl?: string;
  claimToken?: string;
  claimExpiresAt?: string;
  warning?: string;
  resolutionPolicy?: ResolutionPolicy;
};

export type UpdateLinkyOptions = {
  slug: string;
  baseUrl?: string;
  title?: string | null;
  description?: string | null;
  urls?: string[];
  urlMetadata?: UrlMetadata[];
  resolutionPolicy?: ResolutionPolicy | null;
  client?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
};

export type UpdateLinkyResult = {
  slug: string;
  urls: string[];
  urlMetadata: UrlMetadata[];
  title: string | null;
  description: string | null;
  resolutionPolicy?: ResolutionPolicy;
  updatedAt?: string;
};`;

const CLIENT_SIGNATURE = `import { LinkyClient, LinkyApiError } from "@linky/linky/sdk";

export class LinkyClient {
  constructor(options?: {
    baseUrl?: string;      // defaults to $LINKY_BASE_URL, then https://getalinky.com
    apiKey?: string;       // defaults to $LINKY_API_KEY
    client?: string;       // Linky-Client header; convention <tool>/<version>
    fetchImpl?: typeof fetch;
  });

  // Linkies
  createLinky(input):       Promise<CreateLinkyResponseDto>;
  getLinky(slug):           Promise<LinkyDto>;
  listLinkies(params?):     Promise<LinkyListResponseDto>;
  updateLinky(slug, patch): Promise<UpdateLinkyResponseDto>;
  deleteLinky(slug):        Promise<DeleteLinkyResponseDto>;
  getVersions(slug):        Promise<LinkyVersionsResponseDto>;
  getInsights(slug, params?): Promise<LauncherInsightsDto>;

  // Auth + keys (require keys:admin)
  whoami():                 Promise<KeyListResponseDto>;
  listKeys():               Promise<KeyListResponseDto>;
  createKey(input):         Promise<CreatedKeyResponseDto>;
  revokeKey(id):            Promise<RevokedKeyResponseDto>;
}`;

const CLIENT_BASIC = `import { LinkyClient } from "@linky/linky/sdk";

const linky = new LinkyClient({
  apiKey: process.env.LINKY_API_KEY,
  client: "release-bot/1.0",
});

// Create
const { slug, url } = await linky.createLinky({
  urls: ["https://linear.app/acme", "https://github.com/acme/pulls"],
  title: "Release review",
});

// Read
const detail = await linky.getLinky(slug);
const page = await linky.listLinkies({ limit: 20, offset: 0 });

// Update
await linky.updateLinky(slug, {
  title: "Release review — v2",
});

// Insights (Sprint 2.7)
const insights = await linky.getInsights(slug, { range: "7d" });
console.log(insights.totals);  // { views, uniqueViewerDays, openAllClicks, openAllRate }

// Delete (admin role on org-owned Linkies)
await linky.deleteLinky(slug);`;

const CLIENT_KEYS = `import { LinkyClient } from "@linky/linky/sdk";

const linky = new LinkyClient({ apiKey: process.env.LINKY_API_KEY });

// Mint a narrow, rate-limited key for an agent. RAW KEY IS SHOWN ONCE.
const { apiKey, rawKey, warning } = await linky.createKey({
  name: "agent-release-notes",
  scopes: ["links:read"],        // narrowest scope — safe for LLM context
  rateLimitPerHour: 200,         // 0 = unlimited (reserve for internal)
});

console.warn(warning);
console.log(rawKey);             // persist immediately

// List (revoked keys included, with revokedAt set)
const { apiKeys } = await linky.listKeys();

// Revoke by numeric id
await linky.revokeKey(apiKey.id);`;

const CLIENT_ERRORS = `import { LinkyClient, LinkyApiError } from "@linky/linky/sdk";

const linky = new LinkyClient({ apiKey: process.env.LINKY_API_KEY });

try {
  await linky.updateLinky("abc123", { title: "new" });
} catch (error) {
  if (error instanceof LinkyApiError) {
    // error.code       — server-stable string: "FORBIDDEN", "NOT_FOUND",
    //                     "BAD_REQUEST", "RATE_LIMITED", "UNAUTHORIZED", etc.
    // error.statusCode — HTTP status from the response.
    // error.details    — optional structured payload on BAD_REQUEST.
    // error.retryAfterSeconds — present on RATE_LIMITED (Sprint 2.8 Chunk D).
    if (error.code === "RATE_LIMITED") {
      await sleep((error.retryAfterSeconds ?? 60) * 1000);
      // …retry
    }
  }
  throw error;
}`;

const TOP_LEVEL_BASIC = `const { createLinky } = require("@linky/linky");

const result = await createLinky({
  urls: ["https://example.com", "https://example.org"],
  source: "agent",
  title: "Release review",
});

console.log(result.url);
if (result.claimUrl) {
  console.warn(result.warning);
  console.log(result.claimUrl);
}`;

const TOP_LEVEL_POLICY = `const { createLinky } = require("@linky/linky");

await createLinky({
  urls: ["https://acme.com/docs", "https://acme.com/status"],
  source: "agent",
  title: "Acme standup",
  email: "alice@acme.com",           // lands the claim URL with a human
  resolutionPolicy: {
    version: 1,
    rules: [
      {
        name: "Engineering team",
        when: { op: "endsWith", field: "emailDomain", value: "acme.com" },
        tabs: [{ url: "https://linear.app/acme/my-issues" }],
      },
    ],
  },
});`;

const TOP_LEVEL_UPDATE = `const { updateLinky } = require("@linky/linky");

await updateLinky({
  slug: "abc123",
  apiKey: process.env.LINKY_API_KEY,
  title: "Release bundle v2",
  resolutionPolicy: {
    version: 1,
    rules: [
      {
        name: "Engineering team",
        when: { op: "endsWith", field: "emailDomain", value: "acme.com" },
        tabs: [{ url: "https://linear.app/acme/my-issues" }],
      },
    ],
  },
});`;

export default function DocsSdkPage() {
  return (
    <>
      <p className="terminal-label">Reference — SDK</p>
      <h1 className="display-title text-4xl leading-[0.95] font-semibold text-foreground sm:text-5xl">
        SDK reference
      </h1>
      <p className="docs-lede">
        <code>@linky/linky</code> ships two entry points: a pair of top-level
        convenience functions for one-shot creates and updates, and a full{" "}
        <code>LinkyClient</code> class that mirrors every authed HTTP route.
        Both are plain JS with zero runtime dependencies; the client uses{" "}
        <code>globalThis.fetch</code>.
      </p>

      <section className="docs-section">
        <p className="terminal-label">Install</p>
        <pre className="docs-json">
          <code>npm install @linky/linky</code>
        </pre>
      </section>

      <section className="docs-section">
        <p className="terminal-label">Pick your entry point</p>
        <div className="docs-table-wrap">
          <table className="docs-table">
            <thead>
              <tr>
                <th>Import</th>
                <th>Use when</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>import &#123; createLinky &#125; from &quot;@linky/linky&quot;</code>
                </td>
                <td>
                  One-shot creates (anonymous or authed). Zero-config: no
                  client instance, no plumbing.
                </td>
              </tr>
              <tr>
                <td>
                  <code>import &#123; updateLinky &#125; from &quot;@linky/linky&quot;</code>
                </td>
                <td>
                  Top-level convenience for a single update call. Requires{" "}
                  <code>apiKey</code> in options.
                </td>
              </tr>
              <tr>
                <td>
                  <code>import &#123; LinkyClient &#125; from &quot;@linky/linky/sdk&quot;</code>
                </td>
                <td>
                  Anything beyond create/update — <code>getLinky</code>,{" "}
                  <code>listLinkies</code>, <code>getInsights</code>, key
                  management, typed <code>LinkyApiError</code>, reusable
                  config. This is the full surface.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="docs-section">
        <p className="terminal-label">LinkyClient — class shape</p>
        <pre className="docs-json">
          <code>{CLIENT_SIGNATURE}</code>
        </pre>
        <p>
          Every method returns a typed DTO or throws{" "}
          <code>LinkyApiError</code>. The client reuses config across calls —
          instantiate once per process, not per request.
        </p>
      </section>

      <section className="docs-section">
        <p className="terminal-label">LinkyClient — common patterns</p>
        <pre className="docs-json">
          <code>{CLIENT_BASIC}</code>
        </pre>
      </section>

      <section className="docs-section">
        <p className="terminal-label">LinkyClient — key management</p>
        <p>
          Requires a bearer with the <code>keys:admin</code> scope. Keys are
          owned by the calling subject (user or active org); org-admin role
          is additionally required for org-owned keys. See{" "}
          <Link href="/docs/access-control">Access control</Link>.
        </p>
        <pre className="docs-json">
          <code>{CLIENT_KEYS}</code>
        </pre>
      </section>

      <section className="docs-section">
        <p className="terminal-label">LinkyClient — error handling</p>
        <p>
          Every non-2xx response throws a <code>LinkyApiError</code> with a
          stable <code>code</code> you can switch on without string-matching
          the message.
        </p>
        <pre className="docs-json">
          <code>{CLIENT_ERRORS}</code>
        </pre>
      </section>

      <section className="docs-section">
        <p className="terminal-label">Top-level wrapper — types</p>
        <pre className="docs-json">
          <code>{TOP_LEVEL_TYPES}</code>
        </pre>
        <p>
          DSL types (<code>ResolutionPolicy</code>, <code>PolicyRule</code>,{" "}
          <code>PolicyCondition</code>, <code>PolicyViewerField</code>) ship
          with the package, so your editor gets full autocomplete on policy
          objects with no extra install.
        </p>
      </section>

      <section className="docs-section">
        <p className="terminal-label">Top-level wrapper — options</p>
        <div className="docs-table-wrap">
          <table className="docs-table">
            <thead>
              <tr>
                <th>Option</th>
                <th>Type</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>urls</code>
                </td>
                <td>string[]</td>
                <td>Required. Same constraints as the API.</td>
              </tr>
              <tr>
                <td>
                  <code>baseUrl</code>
                </td>
                <td>string</td>
                <td>
                  Defaults to <code>$LINKY_BASE_URL</code> if set, otherwise{" "}
                  <code>https://getalinky.com</code>.
                </td>
              </tr>
              <tr>
                <td>
                  <code>source</code>
                </td>
                <td>string</td>
                <td>Free-form caller label for ops.</td>
              </tr>
              <tr>
                <td>
                  <code>title</code>, <code>description</code>
                </td>
                <td>string</td>
                <td>Optional labels.</td>
              </tr>
              <tr>
                <td>
                  <code>urlMetadata</code>
                </td>
                <td>UrlMetadata[]</td>
                <td>
                  Optional per-URL notes / tags / openPolicy aligned with{" "}
                  <code>urls</code>.
                </td>
              </tr>
              <tr>
                <td>
                  <code>email</code>
                </td>
                <td>string</td>
                <td>
                  Anonymous only. Flags the claim token for the named
                  recipient.
                </td>
              </tr>
              <tr>
                <td>
                  <code>client</code>
                </td>
                <td>string</td>
                <td>
                  <code>Linky-Client</code> header value. Convention:{" "}
                  <code>&lt;tool&gt;/&lt;version&gt;</code>.
                </td>
              </tr>
              <tr>
                <td>
                  <code>resolutionPolicy</code>
                </td>
                <td>ResolutionPolicy</td>
                <td>
                  Optional. Lock the Linky down from the first click. See{" "}
                  <Link href="/docs/personalize">Personalize</Link>.
                </td>
              </tr>
              <tr>
                <td>
                  <code>fetchImpl</code>
                </td>
                <td>typeof fetch</td>
                <td>
                  Override for tests or non-global-fetch runtimes. Defaults
                  to <code>globalThis.fetch</code>.
                </td>
              </tr>
              <tr>
                <td>
                  <code>apiKey</code>
                </td>
                <td>string</td>
                <td>
                  Required for <code>updateLinky()</code>. Bearer token
                  created from the dashboard&apos;s API-keys page. User-scoped
                  keys edit personal launch bundles; org-scoped keys edit
                  team-owned bundles. Keys carry one of three scopes —{" "}
                  <code>links:read</code>, <code>links:write</code>,{" "}
                  <code>keys:admin</code> — locked at mint. A{" "}
                  <code>links:read</code> key cannot call{" "}
                  <code>updateLinky()</code>; pick <code>links:write</code>{" "}
                  or higher in the dashboard when minting. See{" "}
                  <Link
                    href="/docs/access-control"
                    className="underline-offset-4 hover:underline"
                  >
                    Access control
                  </Link>
                  .
                </td>
              </tr>
              <tr>
                <td>
                  <code>metadata</code>
                </td>
                <td>Record&lt;string, unknown&gt;</td>
                <td>
                  Free-form caller metadata. <code>_linky.*</code> is
                  server-reserved and stripped.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="docs-section">
        <p className="terminal-label">Top-level wrapper — result</p>
        <p>
          <code>claimUrl</code>, <code>claimToken</code>,{" "}
          <code>claimExpiresAt</code>, and <code>warning</code> are present
          only on anonymous creates. <code>resolutionPolicy</code> is present
          when a policy was attached at create time — the server echoes the
          parsed form (with minted rule ids) so you don&apos;t need a second
          fetch.
        </p>
        <p className="mt-3">
          <code>updateLinky()</code> returns the updated Linky shape (slug,
          urls, metadata, title, description, policy, updatedAt). Policy clears
          use <code>resolutionPolicy: null</code>.
        </p>
      </section>

      <section className="docs-section">
        <p className="terminal-label">Top-level wrapper — basic create</p>
        <pre className="docs-json">
          <code>{TOP_LEVEL_BASIC}</code>
        </pre>
      </section>

      <section className="docs-section">
        <p className="terminal-label">Top-level wrapper — create with policy</p>
        <pre className="docs-json">
          <code>{TOP_LEVEL_POLICY}</code>
        </pre>
      </section>

      <section className="docs-section">
        <p className="terminal-label">Top-level wrapper — authenticated update</p>
        <pre className="docs-json">
          <code>{TOP_LEVEL_UPDATE}</code>
        </pre>
      </section>

      <section className="docs-section">
        <p className="terminal-label">Rate limits</p>
        <p>
          Every authenticated request counts against the key&apos;s per-hour
          bucket (default 1000/hour, configurable at mint time). When a
          bucket is exhausted the SDK throws <code>LinkyApiError</code> with{" "}
          <code>code: &quot;RATE_LIMITED&quot;</code> and{" "}
          <code>retryAfterSeconds</code>. See{" "}
          <Link href="/docs/limits">Limits</Link> for the full picture.
        </p>
      </section>

      <nav className="docs-next" aria-label="Next steps">
        <span>Next:</span>
        <Link href="/docs/mcp">MCP</Link>
        <Link href="/docs/limits">Limits</Link>
        <Link href="/docs/api">API reference</Link>
      </nav>
    </>
  );
}
