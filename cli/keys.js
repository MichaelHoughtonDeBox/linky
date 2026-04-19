// ============================================================================
// linky auth keys {list, create, revoke} — Sprint 2.8 Chunk C.
//
// Three subcommands of `linky auth keys`. Dispatched from
// `cli/index.js` → `handleAuth` → this module. They use `LinkyClient`
// under the hood so the wire behavior matches the SDK + MCP surfaces
// exactly.
//
// `keys create` prints the secret ONCE with a loud warning. The
// subsequent `keys list` never shows the raw secret — only the
// prefix — so a user who loses it has to revoke + re-issue.
// ============================================================================

const VALID_SCOPES = new Set(["links:read", "links:write", "keys:admin"]);

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

function labelForScopes(scopes) {
  if (!Array.isArray(scopes)) return "Unknown";
  if (scopes.includes("keys:admin")) return "Admin";
  if (scopes.includes("links:write")) return "Read & write";
  if (scopes.includes("links:read")) return "Read-only";
  return scopes.join(", ") || "Unknown";
}

function formatRateLimit(rateLimitPerHour) {
  if (rateLimitPerHour === 0) return "Unlimited";
  return `${rateLimitPerHour}/hr`;
}

// Validate a comma-separated scope list against the allow-list BEFORE
// sending the request. The server re-validates at mint time, but
// rejecting a typo locally saves a round-trip and gives a better
// error message ("Unknown scope 'link:read'. Allowed: …").
function parseScopes(raw) {
  if (!raw) return undefined;
  const parts = raw
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  if (parts.length === 0) return undefined;
  for (const scope of parts) {
    if (!VALID_SCOPES.has(scope)) {
      throw new Error(
        `Unknown scope '${scope}'. Allowed: ${Array.from(VALID_SCOPES).join(", ")}.`,
      );
    }
  }
  return parts;
}

// Keep this in sync with DEFAULT/MAX_RATE_LIMIT_PER_HOUR in
// src/lib/server/api-keys.ts. Duplicating is less painful than
// splitting this CLI into a TypeScript build.
const DEFAULT_RATE_LIMIT_PER_HOUR = 1000;
const MAX_RATE_LIMIT_PER_HOUR = 100_000;

function parseRateLimit(raw) {
  if (raw === undefined || raw === null) return undefined;
  const parsed = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_RATE_LIMIT_PER_HOUR) {
    throw new Error(
      `--rate-limit must be an integer between 0 and ${MAX_RATE_LIMIT_PER_HOUR}.`,
    );
  }
  return parsed;
}

function parseKeysArgs(argv) {
  // Consumes --json / --base-url / --api-key / --client. Returns
  // { flags, rest } in the same shape as linkies.js::parseCommonReadFlags,
  // but kept local to avoid circular imports (each module owns a
  // tiny, one-file parser).
  const flags = {
    json: false,
    baseUrl: undefined,
    client: undefined,
    apiKey: undefined,
  };
  const rest = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--json") {
      flags.json = true;
      continue;
    }
    if (token === "--base-url") {
      flags.baseUrl = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--api-key") {
      flags.apiKey = argv[index + 1];
      index += 1;
      continue;
    }
    if (token === "--client") {
      flags.client = argv[index + 1];
      index += 1;
      continue;
    }
    rest.push(token);
  }
  return { flags, rest };
}

function buildClient(sdk, flags) {
  return new sdk.LinkyClient({
    baseUrl: flags.baseUrl,
    apiKey: flags.apiKey,
    client: flags.client,
  });
}

async function runList(argv, sdk) {
  const { flags, rest } = parseKeysArgs(argv);
  if (rest.length > 0) throw new Error(`Unknown option: ${rest[0]}`);

  const client = buildClient(sdk, flags);
  const response = await client.listKeys();

  if (flags.json) {
    console.log(JSON.stringify(response));
    return;
  }

  const keys = Array.isArray(response.apiKeys) ? response.apiKeys : [];
  const active = keys.filter((item) => item.revokedAt === null);
  const revoked = keys.filter((item) => item.revokedAt !== null);

  console.log(
    colorize(
      `${active.length} active / ${revoked.length} revoked`,
      ANSI.cyan,
    ),
  );
  for (const item of active) {
    console.log(
      `  ${colorize(`#${item.id}`, ANSI.bold)}  ${item.name}  ` +
        `${colorize(labelForScopes(item.scopes), ANSI.dim)}  ` +
        `${colorize(formatRateLimit(item.rateLimitPerHour), ANSI.dim)}  ` +
        `${colorize(item.keyPrefix, ANSI.dim)}`,
    );
  }
  if (revoked.length > 0) {
    console.log(colorize("  — revoked —", ANSI.dim));
    for (const item of revoked) {
      console.log(
        colorize(
          `  #${item.id}  ${item.name}  ${item.keyPrefix}`,
          ANSI.dim,
        ),
      );
    }
  }
}

async function runCreate(argv, sdk) {
  const { flags, rest } = parseKeysArgs(argv);

  const name = rest.shift();
  if (!name || name.startsWith("--")) {
    throw new Error("linky auth keys create requires a <name>.");
  }

  let scopes;
  let rateLimitPerHour;
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (token === "--scopes") {
      scopes = parseScopes(rest[index + 1]);
      index += 1;
      continue;
    }
    if (token === "--rate-limit") {
      rateLimitPerHour = parseRateLimit(rest[index + 1]);
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${token}`);
  }

  const client = buildClient(sdk, flags);
  const response = await client.createKey({
    name,
    scopes,
    rateLimitPerHour,
  });

  if (flags.json) {
    console.log(JSON.stringify(response));
    return;
  }

  const limit =
    response.apiKey?.rateLimitPerHour ?? DEFAULT_RATE_LIMIT_PER_HOUR;
  console.log(colorize(`Created key #${response.apiKey.id}.`, ANSI.green));
  console.log(
    colorize(
      `  scope: ${labelForScopes(response.apiKey.scopes)}   rate limit: ${formatRateLimit(
        limit,
      )}`,
      ANSI.dim,
    ),
  );
  console.log("");
  console.log(colorize("Shown once — save this now:", ANSI.yellow));
  console.log(`  ${colorize(response.rawKey, ANSI.bold)}`);
  if (response.warning) {
    console.log(colorize(`  ${response.warning}`, ANSI.dim));
  }
}

async function runRevoke(argv, sdk) {
  const { flags, rest } = parseKeysArgs(argv);

  const idRaw = rest.shift();
  if (!idRaw) throw new Error("linky auth keys revoke requires an <id>.");
  const id = Number.parseInt(idRaw, 10);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("<id> must be a positive integer.");
  }
  if (rest.length > 0) throw new Error(`Unknown option: ${rest[0]}`);

  const client = buildClient(sdk, flags);
  const response = await client.revokeKey(id);

  if (flags.json) {
    console.log(JSON.stringify(response));
    return;
  }
  console.log(colorize(`Revoked key #${id}.`, ANSI.green));
}

module.exports = {
  runList,
  runCreate,
  runRevoke,
  // Exported for tests.
  parseScopes,
  parseRateLimit,
  parseKeysArgs,
};
