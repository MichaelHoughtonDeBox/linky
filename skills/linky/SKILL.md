---
name: linky
description: Create Linky short launch URLs through the Linky API with curl or through the Linky CLI. Use when bundling multiple URLs into one short link, testing `POST /api/linkies`, or generating launch links for scripts and agents.
---

# Linky

## What this skill does

Use this skill when you need to create a Linky from a list of URLs.

Supported creation paths in this repo:
- `curl` against `POST /api/linkies`
- the local CLI at `node cli/index.js`

## Inputs to gather

Before creating a Linky, gather:
- the Linky base URL, for example `https://getalinky.com` in production or `http://localhost:4040` in local development
- one or more absolute URLs to bundle
- optional `metadata` as a JSON object
- optional `source`

Valid `source` values:
- `web`
- `cli`
- `sdk`
- `agent`
- `unknown`

Use `agent` by default when the request is coming from an agent workflow.

Production default:
- Use `https://getalinky.com` unless the user explicitly wants a local or alternate deployment.

## API contract

Endpoint:
- `POST /api/linkies`

JSON body shape:
- `urls`: required non-empty array of URL strings
- `source`: optional string, normalized to one of the allowed values
- `metadata`: optional JSON object

Success response:
- `201`
- JSON object with `slug` and `url`

Common failure modes:
- `400` for invalid JSON or invalid payload
- `429` for rate limiting
- `500` for server or database issues

Important constraints:
- Do not send `alias`. Custom aliases are currently rejected.
- `metadata` must be a JSON object when provided.

## Preferred workflow

1. If you are already operating inside this repository and want the most direct local path, use the CLI.
2. If you need a raw HTTP example, want to test the API contract directly, or are operating outside the Node runtime, use `curl`.
3. If the caller wants machine-readable output, prefer the CLI with `--json` or parse the JSON response from `curl`.

## CLI usage

Run the local CLI from the repository root:

```bash
# Create a Linky locally through the repo's CLI entrypoint.
node cli/index.js create \
  "https://example.com" \
  "https://example.org" \
  --base-url "http://localhost:4040"
```

JSON output mode:

```bash
# Return machine-readable JSON so another tool can parse the result.
node cli/index.js create \
  "https://example.com" \
  "https://example.org" \
  --base-url "http://localhost:4040" \
  --json
```

Read some URLs from stdin:

```bash
# Combine positional URLs with newline-delimited URLs from stdin.
printf '%s\n' "https://example.net" "https://example.dev" | \
  node cli/index.js create \
    "https://example.com" \
    --stdin \
    --base-url "http://localhost:4040" \
    --json
```

Notes:
- The CLI defaults `source` to `cli`.
- The CLI uses `LINKY_BASE_URL` or `LINKIE_URL` when `--base-url` is not provided.

## curl usage

Minimal request:

```bash
# Create a Linky directly via the production public HTTP API.
curl -X POST "https://getalinky.com/api/linkies" \
  -H "content-type: application/json" \
  --data-binary '{
    "urls": [
      "https://example.com",
      "https://example.org"
    ],
    "source": "agent"
  }'
```

Request with metadata:

```bash
# Attach structured metadata so downstream systems can understand why this Linky was created.
curl -X POST "https://getalinky.com/api/linkies" \
  -H "content-type: application/json" \
  --data-binary '{
    "urls": [
      "https://example.com",
      "https://example.org"
    ],
    "source": "agent",
    "metadata": {
      "task": "share-release-links",
      "requestedBy": "agent"
    }
  }'
```

Capture just the created URL in a shell pipeline:

```bash
# Parse the JSON response and print only the final short Linky URL.
curl -sS -X POST "https://getalinky.com/api/linkies" \
  -H "content-type: application/json" \
  --data-binary '{
    "urls": [
      "https://example.com",
      "https://example.org"
    ],
    "source": "agent"
  }' | node -e 'process.stdin.once("data", (buf) => console.log(JSON.parse(buf).url))'
```

## Decision guide

Use CLI when:
- you are in this repo
- you want the shortest local command
- you want `--json` output without hand-rolling parsing

Use `curl` when:
- you want to test the HTTP contract directly
- you are documenting or debugging the API
- you are integrating from a non-Node environment

## Verification

After creation, verify:
- the response includes a non-empty `slug`
- the response includes a full `url`
- opening the returned `url` loads the launcher page for the bundle
