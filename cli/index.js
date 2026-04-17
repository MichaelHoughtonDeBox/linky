#!/usr/bin/env node

const DEFAULT_BASE_URL =
  process.env.LINKY_BASE_URL ||
  process.env.LINKIE_URL ||
  "https://getalinky.com";

// ANSI color codes — kept tiny and inline so the CLI has zero runtime deps.
const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
};

function colorize(text, color) {
  if (!process.stdout.isTTY) return text;
  return `${color}${text}${ANSI.reset}`;
}

function printHelp() {
  console.log(`
linky - One short link to open them all.

Usage:
  linky create <url1> <url2> [url3] ... [options]
  linky <url1> <url2> [url3] ... [options]

Options:
  --base-url <url>       Linky app base URL (default: ${DEFAULT_BASE_URL})
  --stdin                Read additional URLs from stdin (one per line)
  --email <address>      Flag this Linky to be claimed by the given email
                         after the recipient signs in. Recipient receives a
                         claim URL in the CLI output; they sign in via Clerk
                         and take ownership in one click.
  --title <string>       Optional title stored with the Linky
  --description <string> Optional description stored with the Linky
  --policy <file>        Optional JSON file containing a resolutionPolicy.
                         When present, the new Linky is born personalized —
                         /l/<slug> evaluates this policy against every viewer.
                         Use "-" to read policy JSON from stdin. Server-side
                         validation errors surface verbatim.
  --client <id>          Optional client attribution sent as the
                         \`Linky-Client\` header for ops debugging. Convention:
                         <tool>/<version> (e.g. "cursor/skill-v1"). Malformed
                         values are silently dropped and never fail the call.
  --json                 Print machine-readable JSON output (includes
                         claimToken and warning when anonymous)
  -h, --help             Show this help message

Examples:
  linky create https://github.com/org/repo/pull/1 https://github.com/org/repo/pull/2
  echo "https://example.com" | linky create --stdin --json
  linky create https://example.com --email alice@example.com
  linky create https://example.com --client cursor/skill-v1
  linky create https://docs.acme.com --policy ./acme-team.policy.json
`);
}

function parseArgs(argv) {
  const args = [...argv];
  const first = args[0];

  // Preserve backward compatibility so `linky <url1> <url2>` still works.
  if (first === "create") {
    args.shift();
  } else if (first === "help") {
    return { showHelp: true };
  }

  const options = {
    showHelp: false,
    baseUrl: DEFAULT_BASE_URL,
    json: false,
    readFromStdin: false,
    source: "cli",
    urls: [],
    email: undefined,
    title: undefined,
    description: undefined,
    client: undefined,
    // Path to a JSON file containing a resolutionPolicy. Read + parsed in
    // main() AFTER stdin URLs are consumed (so `--policy -` can coexist
    // with `--stdin` reading from a separate source — but in practice one
    // stdin consumer wins; we reject the conflicting combination below).
    policyPath: undefined,
  };

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    if (token === "--help" || token === "-h") {
      options.showHelp = true;
      continue;
    }

    if (token === "--json") {
      options.json = true;
      continue;
    }

    if (token === "--stdin") {
      options.readFromStdin = true;
      continue;
    }

    if (token === "--base-url") {
      const baseUrl = args[index + 1];
      if (!baseUrl || baseUrl.startsWith("-")) {
        throw new Error("--base-url requires a value.");
      }

      options.baseUrl = baseUrl;
      index += 1;
      continue;
    }

    if (token === "--email") {
      const email = args[index + 1];
      if (!email || email.startsWith("-")) {
        throw new Error("--email requires a value.");
      }

      options.email = email;
      index += 1;
      continue;
    }

    if (token === "--title") {
      const title = args[index + 1];
      if (title === undefined || title.startsWith("--")) {
        throw new Error("--title requires a value.");
      }

      options.title = title;
      index += 1;
      continue;
    }

    if (token === "--description") {
      const description = args[index + 1];
      if (description === undefined || description.startsWith("--")) {
        throw new Error("--description requires a value.");
      }

      options.description = description;
      index += 1;
      continue;
    }

    if (token === "--client") {
      const client = args[index + 1];
      if (!client || client.startsWith("-")) {
        throw new Error("--client requires a value.");
      }

      options.client = client;
      index += 1;
      continue;
    }

    if (token === "--policy") {
      const policyArg = args[index + 1];
      // "-" is a valid value (stdin). Any other leading dash is an option
      // slipped where a path was expected — surface it clearly.
      if (!policyArg || (policyArg.startsWith("-") && policyArg !== "-")) {
        throw new Error("--policy requires a file path (or - for stdin).");
      }
      options.policyPath = policyArg;
      index += 1;
      continue;
    }

    if (token.startsWith("-")) {
      throw new Error(`Unknown option: ${token}`);
    }

    options.urls.push(token);
  }

  return options;
}

async function readUrlsFromStdin() {
  const chunks = [];

  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return [];
  }

  return Buffer.concat(chunks)
    .toString("utf8")
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

async function readStdinText() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

// Read + parse a resolutionPolicy from disk or stdin. Throws with a
// crisp, caller-facing message on any error — the caller handles exit.
async function loadResolutionPolicy(policyPath, stdinAlreadyConsumed) {
  const raw =
    policyPath === "-"
      ? await (async () => {
          if (stdinAlreadyConsumed) {
            throw new Error(
              "--policy - conflicts with --stdin: stdin is already being consumed for URLs.",
            );
          }
          return readStdinText();
        })()
      : await readPolicyFile(policyPath);

  if (!raw.trim()) {
    throw new Error(`--policy file ${policyPath} is empty.`);
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `--policy file ${policyPath} is not valid JSON: ${message}`,
    );
  }
}

async function readPolicyFile(policyPath) {
  // Lazy ESM imports keep this file lint-clean under the repo's ESLint
  // config (which forbids CommonJS require()) while staying pure CJS at
  // the file level. The SDK import in main() uses the same pattern.
  const { promises: fsPromises } = await import("node:fs");
  const pathModule = await import("node:path");
  const resolved = pathModule.resolve(process.cwd(), policyPath);
  try {
    return await fsPromises.readFile(resolved, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      throw new Error(`--policy file not found: ${policyPath}`);
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not read --policy file ${policyPath}: ${message}`);
  }
}

function printCreateSummary(result) {
  // Primary line is always the Linky URL itself — this is the single
  // machine-consumable value most upstream automation wants.
  console.log(colorize(result.url, ANSI.bold));

  if (result.resolutionPolicy && result.resolutionPolicy.rules && result.resolutionPolicy.rules.length > 0) {
    const count = result.resolutionPolicy.rules.length;
    console.log(
      colorize(
        `Personalized: ${count} rule${count === 1 ? "" : "s"} attached. Signed-in viewers see tailored tabs.`,
        ANSI.cyan,
      ),
    );
  }

  if (result.claimUrl) {
    console.log("");
    console.log(colorize("Claim this Linky by signing in:", ANSI.cyan));
    console.log(`  ${colorize(result.claimUrl, ANSI.green)}`);
    if (result.claimExpiresAt) {
      const expires = new Date(result.claimExpiresAt);
      const days = Math.max(
        0,
        Math.ceil((expires.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
      );
      console.log(
        colorize(`  (expires in ${days} day${days === 1 ? "" : "s"})`, ANSI.dim),
      );
    }
    // Raw token for agents that want to store the secret separately from
    // the URL. Dimmed on TTY so it reads as secondary info; JSON mode still
    // exposes it via the full result object.
    if (result.claimToken) {
      console.log(
        colorize(
          `  token: ${result.claimToken} (save this — cannot be recovered)`,
          ANSI.dim,
        ),
      );
    }
  }
}

async function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(colorize(`Linky CLI error: ${message}`, ANSI.yellow));
    process.exit(1);
  }

  if (parsed.showHelp) {
    printHelp();
    return;
  }

  const stdinUrls = parsed.readFromStdin ? await readUrlsFromStdin() : [];
  const urls = [...parsed.urls, ...stdinUrls];

  if (urls.length === 0) {
    printHelp();
    process.exit(1);
  }

  // Read + JSON-parse the policy BEFORE the API call so we fail early with
  // a caller-friendly message (before rate limits / network costs). The
  // server re-validates via parseResolutionPolicy on the other side.
  let resolutionPolicy;
  if (parsed.policyPath !== undefined) {
    try {
      resolutionPolicy = await loadResolutionPolicy(
        parsed.policyPath,
        parsed.readFromStdin,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (parsed.json) {
        console.error(JSON.stringify({ error: message }));
      } else {
        console.error(colorize(`Linky CLI error: ${message}`, ANSI.yellow));
      }
      process.exit(1);
    }
  }

  try {
    // Lazy import keeps startup fast and allows this script to stay CommonJS.
    const sdkModule = await import("../index.js");
    const sdkExports = sdkModule.default ?? sdkModule;
    const createLinky = sdkExports.createLinky;

    const result = await createLinky({
      baseUrl: parsed.baseUrl,
      urls,
      source: parsed.source,
      email: parsed.email,
      title: parsed.title,
      description: parsed.description,
      client: parsed.client,
      resolutionPolicy,
    });

    if (parsed.json) {
      console.log(JSON.stringify(result));
      return;
    }

    printCreateSummary(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (parsed.json) {
      console.error(JSON.stringify({ error: message }));
    } else {
      console.error(colorize(`Linky CLI error: ${message}`, ANSI.yellow));
    }

    process.exit(1);
  }
}

main();
