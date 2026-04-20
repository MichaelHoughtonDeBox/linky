// Top-level `getalinky` package entry.
//
// Historically this file hand-rolled the HTTP calls. As of Sprint 2.8
// Chunk 0 we delegate to `LinkyClient` under `sdk/client.js` so the
// widened SDK surface (Chunks A/B/C/D) is automatically available under
// the default export without copy-pasting logic.
//
// The `createLinky` and `updateLinky` functions are preserved as top-level
// helpers for backward compatibility with every consumer we've shipped.
// They are thin adapters that translate the legacy "options bag"
// convention into the `LinkyClient` method signatures, then reshape the
// response so the return value matches what the pre-2.8 SDK returned.
//
// ESLint note: this file + `sdk/client.js` + `sdk/index.js` are the
// CommonJS entry points npm publishes. Everything else in the repo is
// TypeScript under ESM semantics and blocks `require()`. Disable the
// rule file-locally — the CJS shape is load-bearing for `"main"` and
// subpath exports against Node <22 without `"type": "module"`.
/* eslint-disable @typescript-eslint/no-require-imports */

const { LinkyClient, LinkyApiError, DEFAULT_BASE_URL } = require("./sdk/client.js");

// `options.fetchImpl` wins over `LinkyClient`'s default so tests that
// passed a mocked `fetch` straight through to `createLinky` keep working.
function buildClient({ baseUrl, apiKey, client, fetchImpl }) {
  return new LinkyClient({
    baseUrl,
    apiKey,
    client,
    fetchImpl,
  });
}

async function createLinky(options = {}) {
  const {
    urls,
    baseUrl,
    source = "sdk",
    metadata,
    email,
    title,
    description,
    urlMetadata,
    client,
    resolutionPolicy,
    fetchImpl,
  } = options;

  const instance = buildClient({ baseUrl, client, fetchImpl });

  const data = await instance.createLinky({
    urls,
    source,
    metadata,
    email,
    title,
    description,
    urlMetadata,
    resolutionPolicy,
  });

  if (typeof data.slug !== "string" || typeof data.url !== "string") {
    throw new Error("Linky API returned an invalid response payload.");
  }

  // Pre-2.8 callers rely on this exact return shape. Keep field-for-field
  // parity — do not add fields without a SemVer bump.
  return {
    slug: data.slug,
    url: data.url,
    claimUrl: typeof data.claimUrl === "string" ? data.claimUrl : undefined,
    claimToken:
      typeof data.claimToken === "string" ? data.claimToken : undefined,
    claimExpiresAt:
      typeof data.claimExpiresAt === "string" ? data.claimExpiresAt : undefined,
    warning: typeof data.warning === "string" ? data.warning : undefined,
    resolutionPolicy:
      data.resolutionPolicy && typeof data.resolutionPolicy === "object"
        ? data.resolutionPolicy
        : undefined,
  };
}

async function updateLinky(options = {}) {
  const {
    slug,
    baseUrl,
    title,
    description,
    urls,
    urlMetadata,
    resolutionPolicy,
    client,
    apiKey,
    fetchImpl,
  } = options;

  if (typeof slug !== "string" || slug.trim().length === 0) {
    throw new Error("`slug` must be a non-empty string.");
  }

  const instance = buildClient({ baseUrl, apiKey, client, fetchImpl });

  const data = await instance.updateLinky(slug, {
    title,
    description,
    urls,
    urlMetadata,
    resolutionPolicy,
  });

  const linky = data && typeof data === "object" ? data.linky : null;
  if (!linky || typeof linky !== "object" || typeof linky.slug !== "string") {
    throw new Error("Linky API returned an invalid response payload.");
  }

  return {
    linky: {
      slug: linky.slug,
      urls: Array.isArray(linky.urls) ? linky.urls : [],
      urlMetadata: Array.isArray(linky.urlMetadata) ? linky.urlMetadata : [],
      title:
        typeof linky.title === "string" || linky.title === null
          ? linky.title
          : null,
      description:
        typeof linky.description === "string" || linky.description === null
          ? linky.description
          : null,
      createdAt: typeof linky.createdAt === "string" ? linky.createdAt : "",
      updatedAt: typeof linky.updatedAt === "string" ? linky.updatedAt : "",
      source: typeof linky.source === "string" ? linky.source : "unknown",
      resolutionPolicy:
        linky.resolutionPolicy && typeof linky.resolutionPolicy === "object"
          ? linky.resolutionPolicy
          : undefined,
    },
  };
}

module.exports = {
  DEFAULT_BASE_URL,
  LinkyClient,
  LinkyApiError,
  createLinky,
  updateLinky,
};
