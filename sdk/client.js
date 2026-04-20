// Linky external SDK — Sprint 2.8 Chunk 0.
//
// Plain JS, zero runtime deps. Uses the global `fetch`. Ships under
// `getalinky/sdk` so consumer apps can import:
//
//   const { LinkyClient, LinkyApiError } = require("getalinky/sdk");
//   import { LinkyClient, LinkyApiError } from "getalinky/sdk"; // ESM interop
//
// CommonJS on disk on purpose: the package is type:commonjs (no "type"
// field), the top-level `index.js` and `cli/index.js` are CJS, and Node
// >=18 gives ESM consumers automatic named-export interop for CJS
// modules whose exports are statically assigned at module top level
// (see the assignments at the bottom of this file).
//
// This client is for callers OUTSIDE the Next.js process (external CLIs,
// standalone scripts, other people's Node code). MCP tools running INSIDE
// the app go directly to the service layer — they never hit the wire.
//
// Design notes:
//   - Every method returns a Promise<DTO> or throws a LinkyApiError.
//   - Every method builds an endpoint with the configured `baseUrl` and
//     passes the bearer token (if any) via `Authorization: Bearer`.
//   - The `fetchImpl` option lets tests inject a mocked fetch without
//     monkey-patching the global.
//   - The `client` option becomes the `Linky-Client` header — useful for
//     ops attribution (`cursor/skill-v1`, `claude-desktop/0.4.0`, …).

const DEFAULT_BASE_URL =
  (typeof process !== "undefined" && process.env && process.env.LINKY_BASE_URL) ||
  (typeof process !== "undefined" && process.env && process.env.LINKIE_URL) ||
  "https://getalinky.com";

// Error thrown on any non-2xx response. Carries through the server's
// structured error shape so callers can switch on `error.code` without
// string-matching `error.message`.
class LinkyApiError extends Error {
  constructor({ message, code, statusCode, details, retryAfterSeconds }) {
    super(message);
    this.name = "LinkyApiError";
    this.code = code || "UNKNOWN_ERROR";
    this.statusCode = typeof statusCode === "number" ? statusCode : 0;
    this.details = details;
    // Sprint 2.8 Chunk D: present on 429 responses from a per-key
    // bucket exhaustion. Callers can inspect this directly instead of
    // parsing the `Retry-After` header themselves. `undefined` on any
    // other failure so legacy consumers that only read `code` +
    // `statusCode` keep working unchanged.
    this.retryAfterSeconds =
      typeof retryAfterSeconds === "number" && retryAfterSeconds > 0
        ? retryAfterSeconds
        : undefined;
  }
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function assertSlug(slug) {
  if (!isNonEmptyString(slug)) {
    throw new Error("`slug` must be a non-empty string.");
  }
}

function assertUrlArray(urls) {
  if (!Array.isArray(urls) || urls.length === 0) {
    throw new Error("`urls` must be a non-empty array of URL strings.");
  }
  urls.forEach((url, index) => {
    if (!isNonEmptyString(url)) {
      throw new Error(`Invalid URL at index ${index}.`);
    }
  });
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function buildHeaders({ apiKey, client, jsonBody }) {
  const headers = {};
  if (jsonBody) headers["content-type"] = "application/json";
  if (isNonEmptyString(apiKey)) {
    headers.authorization = `Bearer ${apiKey.trim()}`;
  }
  if (isNonEmptyString(client)) {
    headers["Linky-Client"] = client.trim();
  }
  return headers;
}

function buildQuery(params) {
  if (!params || typeof params !== "object") return "";
  const pairs = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return pairs.length > 0 ? `?${pairs.join("&")}` : "";
}

class LinkyClient {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || DEFAULT_BASE_URL;
    this.apiKey =
      options.apiKey ??
      (typeof process !== "undefined" && process.env && process.env.LINKY_API_KEY) ??
      undefined;
    this.client = options.client;
    this.fetchImpl =
      options.fetchImpl ||
      (typeof fetch !== "undefined" ? fetch.bind(globalThis) : undefined);

    if (!this.fetchImpl) {
      throw new Error(
        "LinkyClient requires a global `fetch` or an explicit `fetchImpl` option.",
      );
    }
  }

  // Low-level request helper. Every public method routes through here so
  // error handling + header construction + base URL join only live in one
  // place. Kept as a private method via the `_request` underscore
  // convention rather than `#request` so the `.d.ts` file can remain
  // minimal and every vitest version can spy on it if needed.
  async _request({ path, method = "GET", body, query }) {
    const endpoint = new URL(path + buildQuery(query), this.baseUrl).toString();
    const headers = buildHeaders({
      apiKey: this.apiKey,
      client: this.client,
      jsonBody: body !== undefined,
    });

    const response = await this.fetchImpl(endpoint, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const data = await safeJson(response);

    if (!response.ok) {
      // Prefer the server-supplied `retryAfterSeconds` (the
      // RateLimitError envelope from http-errors.ts) and fall back to
      // the standard `Retry-After` header — either format is valid on
      // the wire; consumers don't need to care which one the server
      // picked.
      const retryAfterHeader = response.headers?.get
        ? response.headers.get("retry-after")
        : null;
      const retryAfterSeconds =
        typeof data.retryAfterSeconds === "number"
          ? data.retryAfterSeconds
          : retryAfterHeader
            ? Number.parseInt(retryAfterHeader, 10)
            : undefined;

      throw new LinkyApiError({
        message:
          typeof data.error === "string"
            ? data.error
            : `Linky request failed with status ${response.status}.`,
        code: typeof data.code === "string" ? data.code : undefined,
        statusCode: response.status,
        details: data.details,
        retryAfterSeconds,
      });
    }

    return data;
  }

  // ---- Linky CRUD ------------------------------------------------------

  async createLinky(input = {}) {
    assertUrlArray(input.urls);
    return this._request({
      path: "/api/links",
      method: "POST",
      body: {
        urls: input.urls,
        source: input.source || "sdk",
        metadata: input.metadata,
        email: input.email,
        title: input.title,
        description: input.description,
        urlMetadata: input.urlMetadata,
        resolutionPolicy: input.resolutionPolicy,
      },
    });
  }

  async getLinky(slug) {
    assertSlug(slug);
    // NOTE: Chunk A adds a GET /api/links/:slug endpoint. Until then
    // this method is still present so Chunk A can wire the route without
    // a SDK shape break — callers hitting it today will surface the
    // server's 404/405 as a LinkyApiError.
    return this._request({ path: `/api/links/${encodeURIComponent(slug)}` });
  }

  async listLinkies(params = {}) {
    return this._request({
      path: "/api/me/links",
      query: { limit: params.limit, offset: params.offset },
    });
  }

  async updateLinky(slug, patch = {}) {
    assertSlug(slug);
    const hasUpdate =
      patch.urls !== undefined ||
      patch.title !== undefined ||
      patch.description !== undefined ||
      patch.urlMetadata !== undefined ||
      patch.resolutionPolicy !== undefined;
    if (!hasUpdate) {
      throw new Error(
        "Provide at least one update field: urls, title, description, urlMetadata, or resolutionPolicy.",
      );
    }
    if (patch.urls !== undefined) assertUrlArray(patch.urls);

    return this._request({
      path: `/api/links/${encodeURIComponent(slug)}`,
      method: "PATCH",
      body: {
        urls: patch.urls,
        urlMetadata: patch.urlMetadata,
        title: patch.title,
        description: patch.description,
        resolutionPolicy: patch.resolutionPolicy,
      },
    });
  }

  async deleteLinky(slug) {
    assertSlug(slug);
    return this._request({
      path: `/api/links/${encodeURIComponent(slug)}`,
      method: "DELETE",
    });
  }

  async getVersions(slug) {
    assertSlug(slug);
    return this._request({
      path: `/api/links/${encodeURIComponent(slug)}/versions`,
    });
  }

  async getInsights(slug, params = {}) {
    assertSlug(slug);
    return this._request({
      path: `/api/links/${encodeURIComponent(slug)}/insights`,
      query: { range: params.range },
    });
  }

  // ---- Identity + keys -------------------------------------------------

  // `whoami` shares the listKeys endpoint today — see keys-service.ts
  // for the rationale. A dedicated whoami surface arrives in Chunk A.
  async whoami() {
    return this._request({ path: "/api/me/keys" });
  }

  async listKeys() {
    return this._request({ path: "/api/me/keys" });
  }

  async createKey(input = {}) {
    if (!isNonEmptyString(input.name)) {
      throw new Error("`name` must be a non-empty string.");
    }
    return this._request({
      path: "/api/me/keys",
      method: "POST",
      body: {
        name: input.name,
        scopes: input.scopes,
        rateLimitPerHour: input.rateLimitPerHour,
      },
    });
  }

  async revokeKey(id) {
    if (!Number.isFinite(id) || id <= 0) {
      throw new Error("`id` must be a positive integer.");
    }
    return this._request({
      path: "/api/me/keys",
      method: "DELETE",
      query: { id },
    });
  }
}

module.exports = {
  LinkyClient,
  LinkyApiError,
  DEFAULT_BASE_URL,
};
