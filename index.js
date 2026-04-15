const DEFAULT_BASE_URL =
  process.env.LINKY_BASE_URL ||
  process.env.LINKIE_URL ||
  "https://linky.vercel.app";

function assertUrlArray(urls) {
  if (!Array.isArray(urls) || urls.length === 0) {
    throw new Error("`urls` must be a non-empty array of URL strings.");
  }

  urls.forEach((url, index) => {
    if (typeof url !== "string" || url.trim().length === 0) {
      throw new Error(`Invalid URL at index ${index}.`);
    }
  });
}

async function createLinky({
  urls,
  baseUrl = DEFAULT_BASE_URL,
  source = "sdk",
  metadata,
  fetchImpl = fetch,
}) {
  assertUrlArray(urls);

  const endpoint = new URL("/api/linkies", baseUrl).toString();
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    // This payload shape matches the server route contract.
    body: JSON.stringify({
      urls,
      source,
      metadata,
    }),
  });

  const data = await response.json().catch(() => {
    return {};
  });

  if (!response.ok) {
    const message =
      typeof data.error === "string"
        ? data.error
        : `Linky request failed with status ${response.status}.`;
    throw new Error(message);
  }

  if (typeof data.slug !== "string" || typeof data.url !== "string") {
    throw new Error("Linky API returned an invalid response payload.");
  }

  return {
    slug: data.slug,
    url: data.url,
  };
}

module.exports = {
  DEFAULT_BASE_URL,
  createLinky,
};
