import Link from "next/link";

import { CommandBlock } from "@/components/site/command-block";

const BASE_URL =
  process.env.NEXT_PUBLIC_LINKY_BASE_URL ??
  process.env.LINKY_BASE_URL ??
  "https://getalinky.com";

const SKILL_COMMAND =
  "npx skills add https://github.com/MichaelHoughtonDeBox/linky --skill linky -g";

const SKILL_VERIFY = "npx skills list";

const CLI_INSTALL = "npm install -g getalinky";

const CLI_VERIFY = "linky --help";

const CURL_BASELINE = [
  `curl -X POST "${BASE_URL}/api/links" \\`,
  '  -H "content-type: application/json" \\',
  "  --data-binary '{\"urls\":[\"https://example.com\"],\"source\":\"agent\"}'",
].join("\n");

export default function DocsInstallPage() {
  return (
    <>
      <p className="terminal-label">Install</p>
      <h1 className="display-title text-4xl leading-[0.95] font-semibold text-foreground sm:text-5xl">
        Install Linky
      </h1>
      <p className="docs-lede">
        Three surfaces, same result. Pick the one that matches how your agent
        runs today — skill for Cursor, CLI for shells, curl for anything else.
      </p>

      <section className="docs-section">
        <p className="terminal-label">Cursor skill</p>
        <p>
          Installs a persistent skill that Cursor can invoke without a shell.
          Recommended for long-running agent workflows.
        </p>
        <CommandBlock
          title="Install the Linky skill"
          command={SKILL_COMMAND}
          note="Global install (-g) so every Cursor project picks it up."
        />
        <CommandBlock
          title="Verify"
          command={SKILL_VERIFY}
          note="Should list `linky` alongside any other skills."
        />
      </section>

      <section className="docs-section">
        <p className="terminal-label">CLI</p>
        <p>
          The package ships a <code>linky</code> binary. Zero runtime
          dependencies — safe to drop into a CI image.
        </p>
        <CommandBlock
          title="Install the CLI globally"
          command={CLI_INSTALL}
          note="Requires Node.js ≥ 18.18."
        />
        <CommandBlock title="Verify" command={CLI_VERIFY} />
        <p>
          Full flag reference: <Link href="/docs/cli">CLI docs</Link>.
        </p>
      </section>

      <section className="docs-section">
        <p className="terminal-label">curl baseline</p>
        <p>
          Nothing to install. <code>POST /api/links</code> is public and takes
          a JSON body of URLs.
        </p>
        <CommandBlock
          title="Create a Linky with curl"
          command={CURL_BASELINE}
          note="Any HTTP client works. The response has `slug` and `url`."
        />
        <p>
          Full request/response contract: <Link href="/docs/api">API docs</Link>.
        </p>
      </section>

      <nav className="docs-next" aria-label="Next steps">
        <span>Next:</span>
        <Link href="/docs/quick-start">Quick start</Link>
        <Link href="/docs/create">Create a Linky</Link>
      </nav>
    </>
  );
}
