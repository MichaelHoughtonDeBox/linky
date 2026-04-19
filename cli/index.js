#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

const DEFAULT_BASE_URL =
  process.env.LINKY_BASE_URL ||
  process.env.LINKIE_URL ||
  "https://getalinky.com";
const DEFAULT_CONFIG_FILE = ".config/linky/config.json";

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

function printRootHelp() {
  console.log(`
linky - One short link to open them all.

Usage:
  linky create <url1> <url2> [url3] ... [options]
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
  linky auth keys create <name> [--scopes links:read,links:write]
                              [--rate-limit N] [--json]
  linky auth keys revoke <id>
  linky mcp                             Start the stdio MCP bridge
                                        (point agent configs at this)

Create options:
  --base-url <url>       Linky app base URL (default: ${DEFAULT_BASE_URL})
  --stdin                Read additional URLs from stdin (one per line)
  --email <address>      Flag this Linky to be claimed by the given email
  --title <string>       Optional title stored with the Linky
  --description <string> Optional description stored with the Linky
  --policy <file>        Optional JSON file containing a resolutionPolicy
  --client <id>          Optional Linky-Client header (e.g. cursor/skill-v1)
  --json                 Print machine-readable JSON output

Update options:
  --base-url <url>       Linky app base URL (default: ${DEFAULT_BASE_URL})
  --title <string>       Replace title
  --description <string> Replace description
  --description-null     Clear description
  --url <url>            Replace URLs with a repeated ordered list
  --urls-file <file>     Replace URLs from a newline-delimited file
  --policy <file>        Replace resolutionPolicy from JSON file
  --clear-policy         Clear resolutionPolicy
  --api-key <key>        Override stored / env API key
  --client <id>          Optional Linky-Client header
  --json                 Print machine-readable JSON output

Auth precedence:
  1. --api-key
  2. LINKY_API_KEY
  3. Stored key from \`linky auth set-key\`

Examples:
  linky create https://docs.acme.com --policy ./acme-team.policy.json
  linky update abc123 --title "Release bundle v2" --policy ./policy.json
  linky list --json | jq '.linkies[0]'
  linky insights abc123 --range 30d
  linky delete abc123 --force
  linky auth set-key lkyu_deadbeef.secret
  linky auth whoami --json
  linky auth keys create "ci bot" --scopes links:read --rate-limit 500
  linky auth keys list --json
`);
}

function isCreateInvocation(firstToken) {
  if (!firstToken) return true;
  if (firstToken === "create") return true;
  return !firstToken.startsWith("-");
}

function createBaseOptions() {
  return {
    baseUrl: DEFAULT_BASE_URL,
    json: false,
    client: undefined,
  };
}

function parseCommonFlag(options, args, index) {
  const token = args[index];

  if (token === "--help" || token === "-h") {
    options.showHelp = true;
    return index;
  }

  if (token === "--json") {
    options.json = true;
    return index;
  }

  if (token === "--base-url") {
    const value = args[index + 1];
    if (!value || value.startsWith("-")) {
      throw new Error("--base-url requires a value.");
    }
    options.baseUrl = value;
    return index + 1;
  }

  if (token === "--client") {
    const value = args[index + 1];
    if (!value || value.startsWith("-")) {
      throw new Error("--client requires a value.");
    }
    options.client = value;
    return index + 1;
  }

  return null;
}

function parseCreateArgs(argv) {
  const args = [...argv];
  if (args[0] === "create") args.shift();

  const options = {
    showHelp: false,
    ...createBaseOptions(),
    readFromStdin: false,
    source: "cli",
    urls: [],
    email: undefined,
    title: undefined,
    description: undefined,
    policyPath: undefined,
  };

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    const commonIndex = parseCommonFlag(options, args, index);
    if (commonIndex !== null) {
      index = commonIndex;
      continue;
    }

    if (token === "--stdin") {
      options.readFromStdin = true;
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

    if (token === "--policy") {
      const policyArg = args[index + 1];
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

function parseUpdateArgs(argv) {
  const args = [...argv];
  if (args[0] === "update") args.shift();

  const slug = args.shift();
  if (!slug || slug.startsWith("-")) {
    throw new Error("linky update requires a <slug>.");
  }

  const options = {
    showHelp: false,
    ...createBaseOptions(),
    slug,
    title: undefined,
    description: undefined,
    clearDescription: false,
    urls: [],
    urlsFile: undefined,
    policyPath: undefined,
    clearPolicy: false,
    apiKey: undefined,
  };

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    const commonIndex = parseCommonFlag(options, args, index);
    if (commonIndex !== null) {
      index = commonIndex;
      continue;
    }

    if (token === "--title") {
      const value = args[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error("--title requires a value.");
      }
      options.title = value;
      index += 1;
      continue;
    }

    if (token === "--description") {
      const value = args[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error("--description requires a value.");
      }
      options.description = value;
      index += 1;
      continue;
    }

    if (token === "--description-null") {
      options.clearDescription = true;
      continue;
    }

    if (token === "--url") {
      const value = args[index + 1];
      if (!value || value.startsWith("-")) {
        throw new Error("--url requires a value.");
      }
      options.urls.push(value);
      index += 1;
      continue;
    }

    if (token === "--urls-file") {
      const value = args[index + 1];
      if (!value || value.startsWith("-")) {
        throw new Error("--urls-file requires a value.");
      }
      options.urlsFile = value;
      index += 1;
      continue;
    }

    if (token === "--policy") {
      const value = args[index + 1];
      if (!value || (value.startsWith("-") && value !== "-")) {
        throw new Error("--policy requires a file path (or - for stdin).");
      }
      options.policyPath = value;
      index += 1;
      continue;
    }

    if (token === "--clear-policy") {
      options.clearPolicy = true;
      continue;
    }

    if (token === "--api-key") {
      const value = args[index + 1];
      if (!value || value.startsWith("-")) {
        throw new Error("--api-key requires a value.");
      }
      options.apiKey = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown option: ${token}`);
  }

  return options;
}

function parseAuthArgs(argv) {
  const args = [...argv];
  if (args[0] === "auth") args.shift();

  const command = args.shift();
  if (!command || command === "help") {
    return { showHelp: true };
  }

  if (command === "set-key") {
    const apiKey = args.shift();
    if (!apiKey) {
      throw new Error("linky auth set-key requires an API key value.");
    }
    return { command: "set-key", apiKey };
  }

  if (command === "clear") {
    return { command: "clear" };
  }

  if (command === "whoami") {
    const options = {
      command: "whoami",
      showHelp: false,
      ...createBaseOptions(),
      apiKey: undefined,
    };

    for (let index = 0; index < args.length; index += 1) {
      const token = args[index];
      const commonIndex = parseCommonFlag(options, args, index);
      if (commonIndex !== null) {
        index = commonIndex;
        continue;
      }
      if (token === "--api-key") {
        const value = args[index + 1];
        if (!value || value.startsWith("-")) {
          throw new Error("--api-key requires a value.");
        }
        options.apiKey = value;
        index += 1;
        continue;
      }
      throw new Error(`Unknown option: ${token}`);
    }

    return options;
  }

  throw new Error(`Unknown auth command: ${command}`);
}

async function readUrlsFromStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  if (chunks.length === 0) return [];
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

async function readTextFile(filePath) {
  const { promises: fsPromises } = await import("node:fs");
  const pathModule = await import("node:path");
  const resolved = pathModule.resolve(process.cwd(), filePath);
  try {
    return await fsPromises.readFile(resolved, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      throw new Error(`File not found: ${filePath}`);
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not read ${filePath}: ${message}`);
  }
}

async function loadResolutionPolicy(policyPath, stdinAlreadyConsumed) {
  const raw =
    policyPath === "-"
      ? await (async () => {
          if (stdinAlreadyConsumed) {
            throw new Error(
              "--policy - conflicts with another stdin consumer.",
            );
          }
          return readStdinText();
        })()
      : await readTextFile(policyPath);

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

async function loadUrlsFromFile(filePath) {
  const raw = await readTextFile(filePath);
  const urls = raw
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (urls.length === 0) {
    throw new Error(`--urls-file ${filePath} contained no URLs.`);
  }
  return urls;
}

async function getConfigFilePath() {
  const osModule = await import("node:os");
  const pathModule = await import("node:path");
  return pathModule.join(osModule.homedir(), DEFAULT_CONFIG_FILE);
}

async function readStoredConfig() {
  const { promises: fsPromises } = await import("node:fs");
  const configPath = await getConfigFilePath();
  try {
    const raw = await fsPromises.readFile(configPath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    if (error && error.code === "ENOENT") return {};
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not read Linky config: ${message}`);
  }
}

async function writeStoredConfig(config) {
  const { promises: fsPromises } = await import("node:fs");
  const pathModule = await import("node:path");
  const configPath = await getConfigFilePath();
  await fsPromises.mkdir(pathModule.dirname(configPath), { recursive: true });
  await fsPromises.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, {
    mode: 0o600,
  });
  await fsPromises.chmod(configPath, 0o600).catch(() => undefined);
}

async function clearStoredConfig() {
  const { promises: fsPromises } = await import("node:fs");
  const configPath = await getConfigFilePath();
  await fsPromises.rm(configPath, { force: true });
}

async function resolveApiKey(explicitApiKey) {
  if (explicitApiKey && explicitApiKey.trim()) return explicitApiKey.trim();
  if (process.env.LINKY_API_KEY && process.env.LINKY_API_KEY.trim()) {
    return process.env.LINKY_API_KEY.trim();
  }
  const config = await readStoredConfig();
  if (typeof config.apiKey === "string" && config.apiKey.trim()) {
    return config.apiKey.trim();
  }
  throw new Error(
    "No API key configured. Run `linky auth set-key <apiKey>` or set LINKY_API_KEY.",
  );
}

function printCreateSummary(result) {
  console.log(colorize(result.url, ANSI.bold));

  if (
    result.resolutionPolicy &&
    result.resolutionPolicy.rules &&
    result.resolutionPolicy.rules.length > 0
  ) {
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

function printUpdateSummary(result) {
  console.log(colorize(result.url, ANSI.bold));
  console.log(
    colorize("Updated. New version appended to history.", ANSI.cyan),
  );
  if (result.resolutionPolicy && result.resolutionPolicy.rules.length > 0) {
    console.log(
      colorize(
        `Personalized: ${result.resolutionPolicy.rules.length} rule${result.resolutionPolicy.rules.length === 1 ? "" : "s"} active.`,
        ANSI.dim,
      ),
    );
  }
}

async function loadSdkExports() {
  // The top-level entry is CJS; dynamic import surfaces it under `default`
  // in Node's ESM/CJS interop. Sprint 2.8 Chunk 0 widened the exports —
  // callers that want the full client should pull `LinkyClient` out of
  // this object directly.
  const sdkModule = await import("../index.js");
  return sdkModule.default ?? sdkModule;
}

// Sprint 2.8 Chunk C: when `handleAuth` routes into the `keys` subcommand
// group it resolves the bearer token via the shared precedence chain BEFORE
// handing off to `cli/keys.js`. That way a user with `linky auth set-key`
// stored can run `linky auth keys list` without passing --api-key. We still
// respect an explicit --api-key flag on the argv so automation can override.
function extractApiKeyOverride(argv) {
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--api-key") return argv[index + 1];
  }
  return undefined;
}

async function handleCreate(argv) {
  const parsed = parseCreateArgs(argv);
  if (parsed.showHelp) {
    printRootHelp();
    return;
  }

  const stdinUrls = parsed.readFromStdin ? await readUrlsFromStdin() : [];
  const urls = [...parsed.urls, ...stdinUrls];
  if (urls.length === 0) {
    throw new Error("Create requires at least one URL.");
  }

  let resolutionPolicy;
  if (parsed.policyPath !== undefined) {
    resolutionPolicy = await loadResolutionPolicy(
      parsed.policyPath,
      parsed.readFromStdin,
    );
  }

  const sdk = await loadSdkExports();
  const result = await sdk.createLinky({
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
}

async function handleUpdate(argv) {
  const parsed = parseUpdateArgs(argv);
  if (parsed.showHelp) {
    printRootHelp();
    return;
  }

  if (parsed.clearDescription && parsed.description !== undefined) {
    throw new Error("Choose either --description or --description-null.");
  }
  if (parsed.clearPolicy && parsed.policyPath !== undefined) {
    throw new Error("Choose either --policy or --clear-policy.");
  }
  if (parsed.urls.length > 0 && parsed.urlsFile) {
    throw new Error("Choose either repeated --url flags or --urls-file.");
  }

  let resolutionPolicy;
  if (parsed.policyPath !== undefined) {
    resolutionPolicy = await loadResolutionPolicy(parsed.policyPath, false);
  } else if (parsed.clearPolicy) {
    resolutionPolicy = null;
  }

  let urls;
  if (parsed.urls.length > 0) {
    urls = parsed.urls;
  } else if (parsed.urlsFile) {
    urls = await loadUrlsFromFile(parsed.urlsFile);
  }

  const apiKey = await resolveApiKey(parsed.apiKey);
  const sdk = await loadSdkExports();
  const result = await sdk.updateLinky({
    baseUrl: parsed.baseUrl,
    slug: parsed.slug,
    apiKey,
    client: parsed.client,
    title: parsed.title,
    description: parsed.clearDescription ? null : parsed.description,
    urls,
    resolutionPolicy,
  });

  if (parsed.json) {
    console.log(JSON.stringify(result));
    return;
  }
  printUpdateSummary(result);
}

// Sprint 2.8 Chunk B: stdio MCP bridge. The bridge lives in `cli/mcp.mjs`
// as an ESM module (the @modelcontextprotocol/sdk is ESM-only). We
// dynamic-import it from this CJS entry so the user only has one bin
// (`linky`). The bridge's `main()` kicks off at import time and attaches
// to the current process's stdin/stdout — no subprocess, no IPC plumbing.
//
// NOTE: `--help` / `-h` short-circuits to the bridge's own help output
// because the config block it prints is much more useful than the
// top-level CLI help.
async function handleMcp(argv) {
  // The bridge reads argv itself for `--help`. Pass through unchanged
  // by mutating process.argv so the ESM module sees the same flags.
  // We clone because other handlers may still inspect process.argv
  // after this call (they don't today, but let's not force a future
  // maintainer to debug that).
  const originalArgv = process.argv;
  process.argv = [originalArgv[0], originalArgv[1], ...argv];
  try {
    await import("./mcp.mjs");
  } finally {
    process.argv = originalArgv;
  }
}

async function handleAuth(argv) {
  // Sprint 2.8 Chunk C: `linky auth keys {list,create,revoke}` is a new
  // subcommand group. Route it early so the legacy set-key / clear /
  // whoami parser doesn't try to handle `keys` as an unknown auth verb.
  if (argv[1] === "keys") {
    const keysArgv = argv.slice(2);
    const sub = keysArgv.shift();
    const sdk = await loadSdkExports();
    const keysModule = require("./keys.js");
    const apiKey = await resolveApiKey(extractApiKeyOverride(keysArgv));
    // The `resolveApiKey` precedence is preserved: `--api-key` wins,
    // then `LINKY_API_KEY`, then stored config. We thread the resolved
    // value back into argv so the per-subcommand parser picks it up.
    const effectiveArgv = ["--api-key", apiKey, ...keysArgv];

    if (sub === "list") return keysModule.runList(effectiveArgv, sdk);
    if (sub === "create") return keysModule.runCreate(effectiveArgv, sdk);
    if (sub === "revoke") return keysModule.runRevoke(effectiveArgv, sdk);
    throw new Error(
      `Unknown auth keys subcommand: ${sub ?? ""}. Try list / create / revoke.`,
    );
  }

  const parsed = parseAuthArgs(argv);
  if (parsed.showHelp) {
    printRootHelp();
    return;
  }

  if (parsed.command === "set-key") {
    await writeStoredConfig({ apiKey: parsed.apiKey.trim() });
    console.log(colorize("Saved API key for Linky CLI.", ANSI.green));
    return;
  }

  if (parsed.command === "clear") {
    await clearStoredConfig();
    console.log(colorize("Cleared stored Linky API key.", ANSI.green));
    return;
  }

  if (parsed.command === "whoami") {
    const apiKey = await resolveApiKey(parsed.apiKey);
    const sdk = await loadSdkExports();
    const client = new sdk.LinkyClient({
      baseUrl: parsed.baseUrl,
      apiKey,
      client: parsed.client,
    });
    const data = await client.whoami();

    if (parsed.json) {
      console.log(JSON.stringify(data));
      return;
    }

    const subject = data.subject ?? {};
    if (subject.type === "org") {
      console.log(
        colorize(`Authenticated as org ${subject.orgId}.`, ANSI.green),
      );
    } else if (subject.type === "user") {
      console.log(
        colorize(`Authenticated as user ${subject.userId}.`, ANSI.green),
      );
    } else {
      console.log(colorize("Authenticated.", ANSI.green));
    }
    const count = Array.isArray(data.apiKeys) ? data.apiKeys.length : 0;
    console.log(colorize(`Visible API keys: ${count}`, ANSI.dim));
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const first = argv[0];

  try {
    if (argv.length === 0 || first === "help" || first === "--help" || first === "-h") {
      printRootHelp();
      return;
    }

    if (first === "update") {
      await handleUpdate(argv);
      return;
    }

    if (first === "auth") {
      await handleAuth(argv);
      return;
    }

    if (first === "mcp") {
      await handleMcp(argv);
      return;
    }

    // Sprint 2.8 Chunk C: new read + destructive commands. All route
    // through `cli/linkies.js` via LinkyClient; auth is the shared
    // precedence chain (--api-key → LINKY_API_KEY → stored config).
    // We resolve the key BEFORE delegation so the per-command parser
    // only has to handle the flags its command actually understands.
    if (
      first === "list" ||
      first === "get" ||
      first === "history" ||
      first === "insights" ||
      first === "delete"
    ) {
      const commandArgv = argv.slice(1);
      const sdk = await loadSdkExports();
      const linkies = require("./linkies.js");
      const apiKey = await resolveApiKey(extractApiKeyOverride(commandArgv));
      const effectiveArgv = ["--api-key", apiKey, ...commandArgv];
      if (first === "list") await linkies.runList(effectiveArgv, sdk);
      else if (first === "get") await linkies.runGet(effectiveArgv, sdk);
      else if (first === "history") await linkies.runHistory(effectiveArgv, sdk);
      else if (first === "insights") await linkies.runInsights(effectiveArgv, sdk);
      else if (first === "delete") await linkies.runDelete(effectiveArgv, sdk);
      return;
    }

    if (isCreateInvocation(first)) {
      await handleCreate(argv);
      return;
    }

    throw new Error(`Unknown command: ${first}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const jsonMode = argv.includes("--json");
    // Sprint 2.8 Chunk D: surface the retry signal prominently on 429.
    // LinkyApiError from the SDK carries `retryAfterSeconds`; a CLI
    // user who hits their per-key cap should see a concrete wait time
    // instead of a generic error string.
    const retryAfterSeconds =
      error && typeof error === "object" && "retryAfterSeconds" in error
        ? Number(error.retryAfterSeconds)
        : undefined;

    if (jsonMode) {
      console.error(
        JSON.stringify({
          error: message,
          retryAfterSeconds: retryAfterSeconds ?? undefined,
        }),
      );
    } else if (retryAfterSeconds && retryAfterSeconds > 0) {
      console.error(
        colorize(
          `Linky CLI error: ${message} Retry in ~${retryAfterSeconds}s.`,
          ANSI.yellow,
        ),
      );
    } else {
      console.error(colorize(`Linky CLI error: ${message}`, ANSI.yellow));
    }
    process.exit(1);
  }
}

main();
