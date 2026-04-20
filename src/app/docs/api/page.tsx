import Link from "next/link";

const POST_LINKS_REQ = `POST /api/links
content-type: application/json
Linky-Client: cursor/skill-v1        # optional

{
  "urls": ["https://example.com", "https://example.org"],
  "source": "agent",
  "title": "Release review bundle",
  "description": "Open everything needed for the 2026.04 standup.",
  "urlMetadata": [
    { "note": "PR under review", "tags": ["eng"] },
    { "note": "Preview deploy", "openPolicy": "desktop" }
  ],
  "email": "alice@example.com",
  "resolutionPolicy": {
    "version": 1,
    "rules": [
      {
        "name": "Engineering team",
        "when": { "op": "endsWith", "field": "emailDomain", "value": "acme.com" },
        "tabs": [{ "url": "https://linear.app/acme/my-issues" }]
      }
    ]
  }
}`;

const POST_LINKS_RES = `{
  "slug": "x8q2m4k",
  "url": "https://getalinky.com/l/x8q2m4k",
  "claimUrl": "https://getalinky.com/claim/B6p…",
  "claimToken": "B6p…",
  "claimExpiresAt": "2026-05-16T12:00:00.000Z",
  "warning": "Save claimToken and claimUrl now — they are returned only once and cannot be recovered."
}`;

const PATCH_LINKS_REQ = `PATCH /api/links/:slug
content-type: application/json
# owner-only — signed-in Linky session required

{
  "title": "Release review (v2)",
  "description": null,
  "urls": ["https://example.com"],
  "urlMetadata": [{ "note": "rebuilt" }],
  "resolutionPolicy": {
    "version": 1,
    "rules": [
      {
        "name": "Engineering team",
        "showBadge": true,
        "when": {
          "op": "and",
          "of": [
            { "op": "signedIn" },
            { "op": "endsWith", "field": "emailDomain", "value": "acme.com" }
          ]
        },
        "tabs": [
          { "url": "https://linear.app/acme/my-issues", "note": "Your queue" },
          { "url": "https://github.com/acme/app/pulls?q=author:@me" }
        ]
      }
    ]
  }
}`;

const ME_LINKS_RES = `{
  "items": [
    {
      "slug": "x8q2m4k",
      "title": "Release review bundle",
      "description": null,
      "urls": ["https://example.com", "https://example.org"],
      "urlMetadata": [{}, {}],
      "owner": { "type": "user", "userId": "user_…" },
      "createdAt": "2026-04-16T12:00:00.000Z",
      "updatedAt": "2026-04-16T12:00:00.000Z",
      "source": "agent"
    }
  ],
  "nextOffset": 20
}`;

const VERSIONS_RES = `{
  "items": [
    {
      "versionId": "ver_…",
      "createdAt": "2026-04-16T12:00:00.000Z",
      "title": "Release review bundle",
      "description": null,
      "urls": ["https://example.com"],
      "urlMetadata": [{}],
      "resolutionPolicy": { "version": 1, "rules": [] }
    }
  ]
}`;

const INSIGHTS_REQ = `GET /api/links/:slug/insights?range=30d
# any role with view access; read-only — no request body

# range accepts 7d, 30d (default), or 90d`;

const INSIGHTS_RES = `{
  "slug": "x8q2m4k",
  "range": {
    "from": "2026-03-19T00:00:00.000Z",
    "to":   "2026-04-18T00:00:00.000Z"
  },
  "totals": {
    "views": 412,
    "uniqueViewerDays": 287,
    "openAllClicks": 198,
    "openAllRate": 0.481
  },
  "byRule": [
    {
      "ruleId": "01J...",
      "ruleName": "Engineering team",
      "views": 164,
      "openAllClicks": 102,
      "openAllRate": 0.622
    },
    {
      "ruleId": null,
      "ruleName": "Fallthrough",
      "views": 186,
      "openAllClicks": 56,
      "openAllRate": 0.301
    }
  ],
  "series": [
    { "day": "2026-04-11", "views": 18, "openAllClicks": 9 },
    { "day": "2026-04-12", "views": 22, "openAllClicks": 12 }
  ]
}`;

const EVENTS_REQ = `POST /api/links/:slug/events
content-type: application/json

{
  "kind": "open_all",
  "matchedRuleId": "01J..."   # optional; pass null for fallthrough
}`;

const GET_ONE_RES = `{
  "slug": "x8q2m4k",
  "urls": ["https://example.com", "https://example.org"],
  "urlMetadata": [
    { "note": "PR under review", "tags": ["eng"] },
    { "note": "Preview deploy", "openPolicy": "desktop" }
  ],
  "title": "Release review bundle",
  "description": "Open everything needed for the 2026.04 standup.",
  "owner": { "type": "user", "userId": "user_…" },
  "createdAt": "2026-04-16T12:00:00.000Z",
  "updatedAt": "2026-04-16T12:00:00.000Z",
  "source": "agent",
  "metadata": null,
  "resolutionPolicy": { "version": 1, "rules": [] }
}`;

const KEYS_POST_REQ = `POST /api/me/keys
content-type: application/json
# org subjects: admin role required

{
  "name": "release-bot",
  "scopes": ["links:read"],       # optional; defaults to ["links:write"]
  "rateLimitPerHour": 200         # optional; 0 = unlimited, default 1000, cap 100000
}`;

const KEYS_POST_RES = `{
  "apiKey": {
    "id": 42,
    "name": "release-bot",
    "scope": "user",
    "scopes": ["links:read"],
    "keyPrefix": "lkyu_a1b2c3d4",
    "rateLimitPerHour": 200,
    "createdAt": "2026-04-18T12:00:00.000Z",
    "lastUsedAt": null,
    "revokedAt": null
  },
  "rawKey": "lkyu_a1b2c3d4.shown-once-cannot-be-recovered",
  "warning": "Save this API key now — it is shown only once and cannot be recovered."
}`;

const KEYS_GET_RES = `{
  "apiKeys": [
    {
      "id": 42,
      "name": "release-bot",
      "scope": "user",
      "scopes": ["links:read"],
      "keyPrefix": "lkyu_a1b2c3d4",
      "rateLimitPerHour": 200,
      "createdAt": "2026-04-18T12:00:00.000Z",
      "lastUsedAt": "2026-04-19T09:12:33.000Z",
      "revokedAt": null
    }
  ],
  "subject": { "type": "user", "userId": "user_…" }
}`;

const KEYS_DELETE_REQ = `DELETE /api/me/keys?id=42
# no request body — id is passed as a query parameter
# org subjects: admin role required; bearer callers need keys:admin scope`;

const KEYS_DELETE_RES = `{
  "apiKey": {
    "id": 42,
    "name": "release-bot",
    "scope": "user",
    "scopes": ["links:read"],
    "keyPrefix": "lkyu_a1b2c3d4",
    "rateLimitPerHour": 200,
    "createdAt": "2026-04-18T12:00:00.000Z",
    "lastUsedAt": "2026-04-19T09:12:33.000Z",
    "revokedAt": "2026-04-19T10:00:00.000Z"
  }
}`;

export default function DocsApiPage() {
  return (
    <>
      <p className="terminal-label">Reference — API</p>
      <h1 className="display-title text-4xl leading-[0.95] font-semibold text-foreground sm:text-5xl">
        API reference
      </h1>
      <p className="docs-lede">
        Every public Linky route lives under <code>/api</code>. All mutating
        routes return <code>Content-Type: application/json</code>; error
        bodies share a common <code>{"{ error, code }"}</code> shape.
      </p>

      <section className="docs-section">
        <p className="terminal-label">POST /api/links (public)</p>
        <p>
          Create a new Linky. Anonymous callers get a claim token; signed-in
          callers get a Linky attributed to their active Linky organization
          (or their user account, when no organization is active).
        </p>
        <pre className="docs-json">
          <code>{POST_LINKS_REQ}</code>
        </pre>
        <pre className="docs-json">
          <code>{POST_LINKS_RES}</code>
        </pre>
        <p>
          Signed-in responses omit every <code>claim*</code> field and the{" "}
          <code>warning</code>. See <Link href="/docs/create">Create</Link>{" "}
          for the full request-body table and error codes.
        </p>
      </section>

      <section className="docs-section">
        <p className="terminal-label">GET /api/links/:slug (view+)</p>
        <p>
          Read a single Linky by slug. Returns the full DTO including{" "}
          <code>urls</code>, <code>urlMetadata</code>, <code>owner</code>,{" "}
          <code>resolutionPolicy</code>, and timestamps. Any role with view
          access can read. Bearer callers need the <code>links:read</code>{" "}
          scope.
        </p>
        <pre className="docs-json">
          <code>{GET_ONE_RES}</code>
        </pre>
        <p>
          Anonymous viewers see nothing here — this route is owner-scoped,
          not the public launcher. The public read path is{" "}
          <code>GET /l/:slug</code> (HTML). Soft-deleted Linkies return
          404.
        </p>
      </section>

      <section className="docs-section">
        <p className="terminal-label">PATCH /api/links/:slug (editor+)</p>
        <p>
          Edit a Linky. All fields optional; at least one required. Every
          edit — including policy edits — is saved as a new version, so
          previous states are always recoverable via{" "}
          <code>GET /api/links/:slug/versions</code>.
        </p>
        <p>
          On org-owned bundles, editor and admin roles can PATCH; viewer
          cannot. Bearer callers need the <code>links:write</code> scope.
          See <Link href="/docs/access-control">Access control</Link> for
          the full matrix.
        </p>
        <pre className="docs-json">
          <code>{PATCH_LINKS_REQ}</code>
        </pre>
        <p>
          Send <code>&quot;resolutionPolicy&quot;: null</code> to clear the
          policy. Omit the field to leave it untouched. Anonymous Linkies
          (both owner columns NULL) always reject — claim first.
        </p>
      </section>

      <section className="docs-section">
        <p className="terminal-label">DELETE /api/links/:slug (admin-only)</p>
        <p>
          Soft-deletes the Linky. The public <code>/l/:slug</code> launcher
          returns 404 afterwards; the version history stays intact so you
          can audit what the bundle pointed at.
        </p>
        <p>
          On org-owned bundles, only the admin role can delete. Editors
          cannot. Bearer callers need the <code>links:write</code> scope
          plus admin role — an editor-scoped key never deletes.
        </p>
      </section>

      <section className="docs-section">
        <p className="terminal-label">GET /api/me/links (signed-in, view+)</p>
        <p>
          Paginated list of the active subject&apos;s launch bundles. Query
          params: <code>limit</code> (default 20, max 100),{" "}
          <code>offset</code> (default 0). Bearer callers need the{" "}
          <code>links:read</code> scope.
        </p>
        <pre className="docs-json">
          <code>{ME_LINKS_RES}</code>
        </pre>
      </section>

      <section className="docs-section">
        <p className="terminal-label">GET /api/links/:slug/versions (view+)</p>
        <p>
          Every edit is kept forever as a new version. This endpoint returns
          every prior snapshot for the Linky, newest first. Any role with
          view access can read this — editors don&apos;t need edit rights
          to see what changed.
        </p>
        <pre className="docs-json">
          <code>{VERSIONS_RES}</code>
        </pre>
      </section>

      <section id="insights" className="docs-section">
        <p className="terminal-label">GET /api/links/:slug/insights (view+)</p>
        <p>
          Owner-side analytics. Returns view + Open All counts, a daily
          series, and a per-rule breakdown so you can see whether your
          personalized Linky is reaching the right audience. Any role
          with view access can read — viewer / editor / admin all get the
          numbers. Bearer callers need the <code>links:read</code> scope.
        </p>
        <pre className="docs-json">
          <code>{INSIGHTS_REQ}</code>
        </pre>
        <pre className="docs-json">
          <code>{INSIGHTS_RES}</code>
        </pre>
        <ul>
          <li>
            <code>range</code> accepts <code>7d</code>, <code>30d</code>{" "}
            (default), or <code>90d</code>. Anything else silently
            clamps to the default.
          </li>
          <li>
            <code>uniqueViewerDays</code> counts distinct per-day viewer
            hashes. Cross-day identity is not recoverable by design — the
            daily salt rotates.
          </li>
          <li>
            <code>byRule</code> labels resolve from the current policy.
            A rule you deleted yesterday renders as{" "}
            <code>&quot;(removed rule)&quot;</code> so history survives
            policy edits. Fallthrough (no rule matched) is the bucket
            with <code>ruleId: null</code>.
          </li>
          <li>
            No viewer identity leaves the table. No destination-tab
            pings. See{" "}
            <Link href="/docs/access-control">Access control</Link> for
            the full trust posture.
          </li>
        </ul>
      </section>

      <section id="events" className="docs-section">
        <p className="terminal-label">POST /api/links/:slug/events (public)</p>
        <p>
          The launcher page fires this endpoint for every Open All click.
          You will rarely call it directly — documenting it here because
          it shows up in browser network traces and in rate-limit budgets.
          Returns <code>204 No Content</code> on every non-exceptional
          outcome (including unknown slugs — we don&apos;t leak existence
          through this route).
        </p>
        <pre className="docs-json">
          <code>{EVENTS_REQ}</code>
        </pre>
        <p>
          Rate-limited per IP, same bucket as{" "}
          <code>POST /api/links</code>. Best-effort: a DB outage drops the
          event and returns 204 anyway — the launcher&apos;s real job
          (opening tabs) has already happened by the time the ping lands.
        </p>
      </section>

      <section id="scoped-keys" className="docs-section">
        <p className="terminal-label">POST /api/me/keys — mint a scoped API key (keys:admin)</p>
        <p>
          Mint an API key for automation. Org admins mint team keys;
          individual users mint personal keys. Scope is locked at mint —
          to change it, revoke and re-issue. Three presets:
        </p>
        <ul>
          <li>
            <code>links:read</code> — list, view, read insights. Safe
            for LLM context.
          </li>
          <li>
            <code>links:write</code> (default) — everything read can do,
            plus PATCH. Cannot DELETE — that needs admin role.
          </li>
          <li>
            <code>keys:admin</code> — everything above, plus minting and
            revoking other keys. Treat like a root credential.
          </li>
        </ul>
        <p>
          <code>rateLimitPerHour</code> caps the authenticated requests
          this key can make per 60-minute window. Defaults to 1000; valid
          range 0–100000 where <code>0</code> disables the limit (reserve
          for admin / internal keys). Exhausted keys return HTTP 429 with{" "}
          <code>retryAfterSeconds</code> in the JSON body. See{" "}
          <Link href="/docs/limits">Limits</Link>.
        </p>
        <pre className="docs-json">
          <code>{KEYS_POST_REQ}</code>
        </pre>
        <pre className="docs-json">
          <code>{KEYS_POST_RES}</code>
        </pre>
        <p>
          The <code>rawKey</code> is returned once. Paste it into your
          secret store immediately — no endpoint reveals it again.
        </p>
      </section>

      <section className="docs-section">
        <p className="terminal-label">GET /api/me/keys — list + whoami (keys:admin)</p>
        <p>
          Returns every key owned by the caller (user or active org),
          plus the resolved subject descriptor. Revoked keys are included
          with <code>revokedAt</code> populated so you can audit past
          credentials. Raw secrets are never re-returned. The CLI&apos;s{" "}
          <code>linky auth whoami</code> uses this endpoint as the auth
          probe.
        </p>
        <pre className="docs-json">
          <code>{KEYS_GET_RES}</code>
        </pre>
      </section>

      <section className="docs-section">
        <p className="terminal-label">DELETE /api/me/keys — revoke a key (keys:admin)</p>
        <p>
          Revokes the named key by numeric <code>id</code>, passed as a
          query parameter (not a path segment). Idempotent: already-revoked
          keys return their existing <code>revokedAt</code>. Ownership is
          enforced server-side — you can only revoke keys your own subject
          owns.
        </p>
        <pre className="docs-json">
          <code>{KEYS_DELETE_REQ}</code>
        </pre>
        <pre className="docs-json">
          <code>{KEYS_DELETE_RES}</code>
        </pre>
      </section>

      <section className="docs-section">
        <p className="terminal-label">POST /api/mcp — agent-facing transport</p>
        <p>
          Every authed route in this reference is also exposed as an MCP
          tool via Streamable-HTTP at <code>/api/mcp</code>. Agents in
          Cursor, Claude Desktop, Codex, Continue, and Cline connect with
          a bearer token in the <code>Authorization</code> header; no
          additional plumbing is needed. See{" "}
          <Link href="/docs/mcp">MCP</Link> for the tool catalog and
          paste-ready <code>mcp.json</code> config for each harness.
        </p>
      </section>

      <section className="docs-section">
        <p className="terminal-label">Webhooks</p>
        <p>
          <code>POST /api/webhooks/clerk</code> and{" "}
          <code>POST /api/webhooks/stripe</code> are signature-verified
          service endpoints called by Clerk and Stripe respectively. They
          reject unsigned requests with <code>401</code>. Do not call them
          from your own code — you&apos;ll never need to.
        </p>
      </section>

      <section className="docs-section">
        <p className="terminal-label">Error codes</p>
        <div className="docs-table-wrap">
          <table className="docs-table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Code</th>
                <th>Typical cause</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>400</td>
                <td>
                  <code>INVALID_URLS</code>
                </td>
                <td>Bad URL shape, unsupported protocol, too many URLs.</td>
              </tr>
              <tr>
                <td>400</td>
                <td>
                  <code>BAD_REQUEST</code>
                </td>
                <td>Malformed body, bad policy, invalid pagination.</td>
              </tr>
              <tr>
                <td>400</td>
                <td>
                  <code>INVALID_JSON</code>
                </td>
                <td>Request body was not parsable JSON.</td>
              </tr>
              <tr>
                <td>401</td>
                <td>
                  <code>AUTH_REQUIRED</code>
                </td>
                <td>Route requires a signed-in Linky session.</td>
              </tr>
              <tr>
                <td>403</td>
                <td>
                  <code>FORBIDDEN</code>
                </td>
                <td>
                  Not the owner, wrong role (e.g. viewer trying to
                  PATCH, editor trying to DELETE), or missing scope on
                  the API key. The error message names the missing
                  dimension.
                </td>
              </tr>
              <tr>
                <td>404</td>
                <td>
                  <code>NOT_FOUND</code>
                </td>
                <td>Unknown slug, or Linky was soft-deleted.</td>
              </tr>
              <tr>
                <td>429</td>
                <td>
                  <code>RATE_LIMITED</code>
                </td>
                <td>
                  Either the anonymous create IP rate limit, or a bearer
                  key&apos;s per-hour <code>rateLimitPerHour</code> bucket
                  was exhausted. The response body includes{" "}
                  <code>retryAfterSeconds</code>; SDK callers read{" "}
                  <code>LinkyApiError.retryAfterSeconds</code> directly.
                  See <Link href="/docs/limits">Limits</Link>.
                </td>
              </tr>
              <tr>
                <td>500</td>
                <td>
                  <code>INTERNAL_ERROR</code>
                </td>
                <td>Server / database issue; safe to retry.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <nav className="docs-next" aria-label="Next steps">
        <span>Next:</span>
        <Link href="/docs/cli">CLI reference</Link>
        <Link href="/docs/sdk">SDK reference</Link>
      </nav>
    </>
  );
}
