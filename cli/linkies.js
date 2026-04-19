/* eslint-disable @typescript-eslint/no-require-imports */

// ============================================================================
// linky list / get / delete / history / insights — Sprint 2.8 Chunk C.
//
// Each handler:
//   1. Parses its own argv slice (slug + flags). Shared flags —
//      `--json`, `--base-url`, `--client`, `--api-key` — are extracted
//      by `parseCommonReadFlags` below so new read commands only have
//      to own their command-specific flags.
//   2. Resolves the bearer token via the existing precedence chain
//      (`--api-key` → `LINKY_API_KEY` → stored config), shared with
//      the rest of the CLI.
//   3. Builds a `LinkyClient` (from `sdk/client.js` via the top-level
//      package entry) and calls the matching method.
//   4. Renders output — pretty by default, `--json` dumps the DTO
//      verbatim so agents scripting the CLI directly get structured
//      data without regex-parsing the human view.
//
// `linky delete` additionally requires `--force`. Without it, the
// command is a silent no-op that prints a reminder — typo-guard for a
// destructive action.
// ============================================================================

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
};

function colorize(text, color) {
  if (!process.stdout.isTTY) return text;
  return `${color}${text}${ANSI.reset}`;
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function parseCommonReadFlags(argv) {
  // Consumes `--json`, `--base-url`, `--client`, `--api-key` from argv
  // (in-place). Returns both the parsed flags and the argv with those
  // flags removed — the caller's command-specific parser then only
  // sees the tokens that matter to it.
  const options = {
    json: false,
    baseUrl: undefined,
    client: undefined,
    apiKey: undefined,
  };
  const rest = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--json") {
      options.json = true;
      continue;
    }
    if (token === "--base-url") {
      options.baseUrl = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--client") {
      options.client = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--api-key") {
      options.apiKey = argv[index + 1];
      index += 1;
      continue;
    }
    rest.push(token);
  }

  return { flags: options, rest };
}

function buildClient(sdk, flags) {
  return new sdk.LinkyClient({
    baseUrl: flags.baseUrl,
    apiKey: flags.apiKey,
    client: flags.client,
  });
}

function printLinkyList(response) {
  const linkies = Array.isArray(response.linkies) ? response.linkies : [];
  if (linkies.length === 0) {
    console.log(colorize("No Linkies yet.", ANSI.dim));
    return;
  }
  console.log(
    colorize(
      `${linkies.length} Linky bundle${linkies.length === 1 ? "" : "s"}`,
      ANSI.cyan,
    ),
  );
  for (const item of linkies) {
    const title = item.title || "(no title)";
    const urlCount = Array.isArray(item.urls) ? item.urls.length : 0;
    console.log(
      `  ${colorize(item.slug, ANSI.bold)}  ${title}  ${colorize(
        `${urlCount} URL${urlCount === 1 ? "" : "s"}`,
        ANSI.dim,
      )}`,
    );
  }
}

function printLinkyDetail(dto) {
  console.log(colorize(dto.slug, ANSI.bold));
  if (dto.title) console.log(`  title: ${dto.title}`);
  if (dto.description) console.log(`  description: ${dto.description}`);
  console.log(colorize(`  ${dto.urls.length} URL(s):`, ANSI.dim));
  for (const url of dto.urls) {
    console.log(`    ${url}`);
  }
  const owner =
    dto.owner?.type === "user"
      ? `user:${dto.owner.userId}`
      : dto.owner?.type === "org"
        ? `org:${dto.owner.orgId}`
        : "anonymous";
  console.log(colorize(`  owner: ${owner}`, ANSI.dim));
  if (dto.resolutionPolicy && dto.resolutionPolicy.rules?.length > 0) {
    console.log(
      colorize(
        `  policy: ${dto.resolutionPolicy.rules.length} rule(s) active`,
        ANSI.dim,
      ),
    );
  }
}

function printVersionHistory(response) {
  const versions = Array.isArray(response.versions) ? response.versions : [];
  if (versions.length === 0) {
    console.log(colorize("No edit history.", ANSI.dim));
    return;
  }
  console.log(
    colorize(
      `${versions.length} version${versions.length === 1 ? "" : "s"} (newest first)`,
      ANSI.cyan,
    ),
  );
  for (const version of versions) {
    const editor = version.editedByClerkUserId ?? "unknown";
    const when = new Date(version.editedAt).toISOString();
    console.log(
      `  v${version.versionNumber}  ${when}  by ${colorize(editor, ANSI.dim)}`,
    );
  }
}

function printInsights(dto) {
  const { render: renderSparkline } = require("./sparkline.js");
  const totals = dto.totals ?? {};
  const series = Array.isArray(dto.series) ? dto.series.map((p) => p.views) : [];

  console.log(
    colorize(
      `${dto.slug}  ${dto.range?.from ?? "?"} → ${dto.range?.to ?? "?"}`,
      ANSI.bold,
    ),
  );
  console.log(
    `  views: ${totals.views ?? 0}   unique viewer-days: ${
      totals.uniqueViewerDays ?? 0
    }`,
  );
  console.log(
    `  open-all clicks: ${totals.openAllClicks ?? 0}   open-all rate: ${
      totals.openAllRate ?? 0
    }`,
  );

  if (series.length > 0 && process.stdout.isTTY) {
    // Rendering the sparkline on a non-TTY (e.g. piped into jq) would
    // add Unicode noise to structured output. --json is the right
    // surface for that consumer.
    console.log(colorize(`  daily: ${renderSparkline(series)}`, ANSI.cyan));
  }

  const byRule = Array.isArray(dto.byRule) ? dto.byRule : [];
  if (byRule.length > 0) {
    console.log(colorize("  by rule:", ANSI.dim));
    for (const bucket of byRule) {
      console.log(
        `    ${bucket.ruleName ?? "(unknown)"}  views=${bucket.views}  ` +
          `open-all=${bucket.openAllClicks}  rate=${bucket.openAllRate}`,
      );
    }
  }
}

async function runList(argv, sdk) {
  const { flags, rest } = parseCommonReadFlags(argv);

  let limit;
  let offset;
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (token === "--limit") {
      limit = Number.parseInt(rest[index + 1] ?? "", 10);
      index += 1;
      continue;
    }
    if (token === "--offset") {
      offset = Number.parseInt(rest[index + 1] ?? "", 10);
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${token}`);
  }

  const client = buildClient(sdk, flags);
  const response = await client.listLinkies({ limit, offset });

  if (flags.json) {
    console.log(JSON.stringify(response));
    return;
  }
  printLinkyList(response);
}

async function runGet(argv, sdk) {
  const { flags, rest } = parseCommonReadFlags(argv);
  const slug = rest.shift();
  if (!slug) throw new Error("linky get requires a <slug>.");
  if (rest.length > 0) throw new Error(`Unknown option: ${rest[0]}`);

  const client = buildClient(sdk, flags);
  const dto = await client.getLinky(slug);

  if (flags.json) {
    console.log(JSON.stringify(dto));
    return;
  }
  printLinkyDetail(dto);
}

async function runHistory(argv, sdk) {
  const { flags, rest } = parseCommonReadFlags(argv);
  const slug = rest.shift();
  if (!slug) throw new Error("linky history requires a <slug>.");
  if (rest.length > 0) throw new Error(`Unknown option: ${rest[0]}`);

  const client = buildClient(sdk, flags);
  const response = await client.getVersions(slug);

  if (flags.json) {
    console.log(JSON.stringify(response));
    return;
  }
  printVersionHistory(response);
}

async function runInsights(argv, sdk) {
  const { flags, rest } = parseCommonReadFlags(argv);
  const slug = rest.shift();
  if (!slug) throw new Error("linky insights requires a <slug>.");

  let range;
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (token === "--range") {
      range = rest[index + 1];
      if (!["7d", "30d", "90d"].includes(range)) {
        throw new Error("--range must be one of: 7d, 30d, 90d.");
      }
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${token}`);
  }

  const client = buildClient(sdk, flags);
  const dto = await client.getInsights(slug, { range });

  if (flags.json) {
    console.log(JSON.stringify(dto));
    return;
  }
  printInsights(dto);
}

async function runDelete(argv, sdk) {
  const { flags, rest } = parseCommonReadFlags(argv);
  const slug = rest.shift();
  if (!slug) throw new Error("linky delete requires a <slug>.");

  let force = false;
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (token === "--force") {
      force = true;
      continue;
    }
    throw new Error(`Unknown option: ${token}`);
  }

  if (!force) {
    // Silent no-op by design — typo-guarded destructive action. We
    // print a reminder + exit 0 so a confused script doesn't halt on
    // a missing flag.
    console.error(
      colorize(
        `linky delete is destructive; re-run with --force to soft-delete ${slug}.`,
        ANSI.yellow,
      ),
    );
    return;
  }

  const client = buildClient(sdk, flags);
  await client.deleteLinky(slug);

  if (flags.json) {
    console.log(JSON.stringify({ ok: true, slug }));
    return;
  }
  console.log(colorize(`Deleted ${slug}.`, ANSI.green));
}

module.exports = {
  runList,
  runGet,
  runHistory,
  runInsights,
  runDelete,
  // Exported for tests.
  parseCommonReadFlags,
  isPositiveInteger,
};
