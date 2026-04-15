#!/usr/bin/env node

const DEFAULT_BASE_URL =
  process.env.LINKY_BASE_URL ||
  process.env.LINKIE_URL ||
  "https://getalinky.com";

function printHelp() {
  console.log(`
linky - One short link to open them all.

Usage:
  linky create <url1> <url2> [url3] ... [options]
  linky <url1> <url2> [url3] ... [options]

Options:
  --base-url <url>   Linky app base URL (default: ${DEFAULT_BASE_URL})
  --stdin            Read additional URLs from stdin (one per line)
  --json             Print machine-readable JSON output
  -h, --help         Show this help message

Examples:
  linky create https://github.com/org/repo/pull/1 https://github.com/org/repo/pull/2
  echo "https://example.com" | linky create --stdin --json
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

async function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Linky CLI error: ${message}`);
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

  try {
    // Lazy import keeps startup fast and allows this script to stay CommonJS.
    const sdkModule = await import("../index.js");
    const sdkExports = sdkModule.default ?? sdkModule;
    const createLinky = sdkExports.createLinky;

    const result = await createLinky({
      baseUrl: parsed.baseUrl,
      urls,
      source: parsed.source,
    });

    if (parsed.json) {
      console.log(JSON.stringify(result));
      return;
    }

    console.log(result.url);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (parsed.json) {
      console.error(JSON.stringify({ error: message }));
    } else {
      console.error(`Linky CLI error: ${message}`);
    }

    process.exit(1);
  }
}

main();
