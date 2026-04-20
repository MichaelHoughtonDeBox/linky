import Link from "next/link";

import { MAX_URLS_PER_LINKY } from "@/lib/linky/urls";
import {
  MAX_CONDITION_DEPTH,
  MAX_RULES_PER_POLICY,
  MAX_TABS_PER_RULE,
} from "@/lib/linky/policy";

export default function DocsLimitsPage() {
  return (
    <>
      <p className="terminal-label">Reference — limits</p>
      <h1 className="display-title text-4xl leading-[0.95] font-semibold text-foreground sm:text-5xl">
        Limits & rate limits
      </h1>
      <p className="docs-lede">
        Hard caps that gate agent abuse. Numbers on this page are pulled from
        Linky itself at build time, so they always match what the API will
        actually accept.
      </p>

      <section className="docs-section">
        <p className="terminal-label">Per-Linky limits</p>
        <div className="docs-table-wrap">
          <table className="docs-table">
            <thead>
              <tr>
                <th>Limit</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>URLs per Linky</td>
                <td>{MAX_URLS_PER_LINKY}</td>
              </tr>
              <tr>
                <td>Max URL length</td>
                <td>2048 characters</td>
              </tr>
              <tr>
                <td>Supported protocols</td>
                <td>
                  <code>http:</code>, <code>https:</code>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          URLs outside these bounds are rejected with{" "}
          <code>400 INVALID_URLS</code>.
        </p>
      </section>

      <section className="docs-section">
        <p className="terminal-label">Policy limits</p>
        <div className="docs-table-wrap">
          <table className="docs-table">
            <thead>
              <tr>
                <th>Limit</th>
                <th>Value</th>
                <th>When it bites</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Rules per policy</td>
                <td>{MAX_RULES_PER_POLICY}</td>
                <td>Checked on every <code>POST</code> and <code>PATCH</code>.</td>
              </tr>
              <tr>
                <td>Tabs per rule</td>
                <td>{MAX_TABS_PER_RULE}</td>
                <td>Checked on create / edit.</td>
              </tr>
              <tr>
                <td>Condition nesting depth</td>
                <td>{MAX_CONDITION_DEPTH}</td>
                <td>
                  Compound <code>and</code> / <code>or</code> /{" "}
                  <code>not</code> bodies can&apos;t nest deeper. Checked on
                  create / edit.
                </td>
              </tr>
              <tr>
                <td>Condition string value length</td>
                <td>512 characters</td>
                <td>Per value in an <code>in</code> list or a scalar op. Checked on create / edit.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Exceed any of these and the API returns <code>400 BAD_REQUEST</code>.
          See <Link href="/docs/personalize">Personalize</Link> for how the
          caps interact with the DSL.
        </p>
      </section>

      <section className="docs-section">
        <p className="terminal-label">Plan defaults</p>
        <p>
          Every account currently uses these defaults.
        </p>
        <div className="docs-table-wrap">
          <table className="docs-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Max Linkies</th>
                <th>Max URLs per Linky</th>
                <th>Can edit</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>anonymous</code>
                </td>
                <td>50</td>
                <td>25</td>
                <td>No (anonymous Linkies are immutable).</td>
              </tr>
              <tr>
                <td>
                  <code>free</code> (signed-in user or org)
                </td>
                <td>100</td>
                <td>25</td>
                <td>Yes (per ownership rules).</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="docs-section">
        <p className="terminal-label">Anonymous create rate limit (IP)</p>
        <p>
          Applies to the unauthenticated <code>POST /api/links</code> path
          and the <code>POST /api/links/:slug/events</code> Open All ping,
          keyed by client IP. Authenticated callers use the per-key bucket
          below instead.
        </p>
        <div className="docs-table-wrap">
          <table className="docs-table">
            <thead>
              <tr>
                <th>Setting</th>
                <th>Default</th>
                <th>Self-host override</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Window</td>
                <td>60,000 ms (1 minute)</td>
                <td>
                  <code>LINKY_RATE_LIMIT_WINDOW_MS</code>
                </td>
              </tr>
              <tr>
                <td>Max requests per window</td>
                <td>30</td>
                <td>
                  <code>LINKY_RATE_LIMIT_MAX_REQUESTS</code>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Exceeding the limit returns <code>429 RATE_LIMITED</code>. Back off
          and retry — a retry-after strategy is recommended for agents
          running in a loop.
        </p>
      </section>

      <section className="docs-section">
        <p className="terminal-label">Per-key rate limit (bearer)</p>
        <p>
          Every authenticated request — HTTP, SDK, CLI, or MCP — counts
          against the API key&apos;s per-hour bucket. Keys are minted with
          a default of 1000 requests per 60-minute rolling window; the
          dashboard and <code>POST /api/me/keys</code> both accept a
          custom <code>rateLimitPerHour</code> at mint time.
        </p>
        <div className="docs-table-wrap">
          <table className="docs-table">
            <thead>
              <tr>
                <th>Setting</th>
                <th>Value</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Default</td>
                <td>1000 / hour</td>
                <td>
                  Sized so no legitimate agent workflow hits it, but a
                  runaway loop 429s within seconds.
                </td>
              </tr>
              <tr>
                <td>Minimum</td>
                <td>0</td>
                <td>
                  <code>0</code> disables the limit entirely. Reserve for
                  admin / internal keys you control end-to-end.
                </td>
              </tr>
              <tr>
                <td>Maximum</td>
                <td>100,000 / hour</td>
                <td>
                  Hard cap on <code>POST /api/me/keys</code>. Contact us
                  if you need higher in a hosted deployment.
                </td>
              </tr>
              <tr>
                <td>Window</td>
                <td>Rolling 60 minutes</td>
                <td>
                  Per-key bucket, independent of every other key. Each key
                  burns its own quota.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Exhausted keys get HTTP <code>429</code> with{" "}
          <code>code: &quot;RATE_LIMITED&quot;</code> and{" "}
          <code>retryAfterSeconds</code> in the JSON body (and the{" "}
          <code>Retry-After</code> response header). The MCP surface maps
          this to JSON-RPC error code <code>-32004</code> with the same
          payload. The SDK&apos;s <code>LinkyApiError</code> exposes{" "}
          <code>retryAfterSeconds</code> directly — switch on the code,
          sleep the seconds, retry.
        </p>
        <p>
          Self-hosted instances today share a single in-memory bucket per
          Node process; the numbers fragment across horizontally-scaled
          instances. A Redis-backed bucket is a Sprint 3 follow-up for the
          paid plan tiers.
        </p>
      </section>

      <nav className="docs-next" aria-label="Next steps">
        <span>Next:</span>
        <Link href="/docs/api">API reference</Link>
        <Link href="/docs/mcp">MCP</Link>
        <Link href="/docs/personalize">Personalize</Link>
      </nav>
    </>
  );
}
