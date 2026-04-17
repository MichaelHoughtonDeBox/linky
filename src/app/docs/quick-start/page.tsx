import Link from "next/link";

import { CommandBlock } from "@/components/site/command-block";

const BASE_URL =
  process.env.NEXT_PUBLIC_LINKY_BASE_URL ??
  process.env.LINKY_BASE_URL ??
  "https://getalinky.com";

const STEP_1_CURL = [
  `curl -X POST "${BASE_URL}/api/links" \\`,
  '  -H "content-type: application/json" \\',
  "  --data-binary '{",
  '    "urls": [',
  '      "https://example.com",',
  '      "https://example.org"',
  "    ],",
  '    "source": "agent"',
  "  }'",
].join("\n");

const STEP_2_LAUNCH = `open "${BASE_URL}/l/<slug-from-step-1>"`;

const STEP_3_CLAIM = `open "${BASE_URL}/claim/<token-from-step-1>"`;

const STEP_4_POLICY = [
  `curl -X PATCH "${BASE_URL}/api/links/<slug>" \\`,
  '  -H "content-type: application/json" \\',
  "  --data-binary '{",
  '    "resolutionPolicy": {',
  '      "version": 1,',
  '      "rules": [',
  "        {",
  '          "name": "Engineering team",',
  '          "when": {',
  '            "op": "endsWith",',
  '            "field": "emailDomain",',
  '            "value": "acme.com"',
  "          },",
  '          "tabs": [',
  '            { "url": "https://linear.app/acme/my-issues" }',
  "          ]",
  "        }",
  "      ]",
  "    }",
  "  }'",
].join("\n");

export default function DocsQuickStartPage() {
  return (
    <>
      <p className="terminal-label">Quick start</p>
      <h1 className="display-title text-4xl leading-[0.95] font-semibold text-foreground sm:text-5xl">
        Zero to a shared Linky
      </h1>
      <p className="docs-lede">
        Create anonymously, open the launcher, optionally claim ownership,
        optionally attach a policy. The whole loop runs without an account.
      </p>

      <section className="docs-section">
        <p className="terminal-label">1. Create a Linky</p>
        <p>
          One <code>POST</code>, two URLs, anonymous. The response gives you
          back a <code>slug</code>, the public launcher URL, and a
          {" "}<code>claimToken</code> you can use later to bind ownership.
        </p>
        <CommandBlock title="Anonymous create" command={STEP_1_CURL} />
        <p>
          Anonymous creates return <code>claimToken</code>,{" "}
          <code>claimUrl</code>, and a <code>warning</code>. Save them — the
          token is returned once and cannot be recovered.
        </p>
      </section>

      <section className="docs-section">
        <p className="terminal-label">2. Open the launcher</p>
        <p>
          Visit <code>/l/&lt;slug&gt;</code> in any browser and click{" "}
          <strong>Open All</strong>. Popup-blocker fallbacks appear when the
          browser refuses the batch.
        </p>
        <CommandBlock title="Launch it" command={STEP_2_LAUNCH} />
        <p>
          More on the launcher (personalized banner, anonymous nudge, popup
          fallback): <Link href="/docs/launcher">Launcher</Link>.
        </p>
      </section>

      <section className="docs-section">
        <p className="terminal-label">3. Claim ownership (optional)</p>
        <p>
          If you created anonymously and want to edit the Linky later, visit
          the <code>claimUrl</code>. You&apos;ll be prompted to sign in, then
          the Linky gets bound to your Clerk account (or your active Clerk
          org, if one is selected).
        </p>
        <CommandBlock title="Claim it" command={STEP_3_CLAIM} />
        <p>
          Full contract (expiry, org-wins rule, one-shot semantics):{" "}
          <Link href="/docs/claim">Claim flow</Link>.
        </p>
      </section>

      <section className="docs-section">
        <p className="terminal-label">4. Personalize (optional)</p>
        <p>
          Attach a <code>resolutionPolicy</code> to route viewers to different
          tabs. The same URL opens different bundles for different people; the
          public tab set stays live for anonymous and unmatched viewers.
        </p>
        <CommandBlock title="Attach a policy" command={STEP_4_POLICY} />
        <p>
          Agents that want a Linky personalized from the very first click
          should attach the policy at create time — see{" "}
          <Link href="/docs/create">Create</Link>.
        </p>
      </section>

      <nav className="docs-next" aria-label="Next steps">
        <span>Next:</span>
        <Link href="/docs/personalize">Personalize</Link>
        <Link href="/docs/api">API reference</Link>
      </nav>
    </>
  );
}
