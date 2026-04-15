# Linky

Linky turns many URLs into one short launch link.

Use it from:
- the web app (`/`)
- the CLI (`linky create ...`)
- the npm package API (`createLinky(...)`)

The short URL resolves to `/l/[slug]`, where users click **Open All** to launch each tab.

## Features

- Create short slugs backed by Postgres
- Public create API with basic IP rate limiting
- Launcher page with popup-blocking guidance and manual fallback links
- Agent-friendly CLI output with `--json`
- Programmatic package API for scripts and agent tools

## Architecture

```text
WebUI / CLI / SDK
        |
        v
POST /api/linkies  --->  Postgres (slug -> url bundle)
        |
        v
   /l/[slug] launcher page
```

## Quick Start (Local)

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment

Copy `.env.example` to `.env.local` and set values.

Required:
- `DATABASE_URL`
- `LINKY_BASE_URL`

Optional:
- `LINKY_RATE_LIMIT_WINDOW_MS`
- `LINKY_RATE_LIMIT_MAX_REQUESTS`

### 3) Create database schema

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

### 4) Start the app

```bash
npm run dev
```

App defaults to `http://localhost:4040`.

## API

### `POST /api/linkies`

Create a new Linky and return a short URL.

Request:

```json
{
  "urls": ["https://example.com", "https://example.org"],
  "source": "cli"
}
```

Response:

```json
{
  "slug": "x8q2m4k",
  "url": "https://your-domain/l/x8q2m4k"
}
```

Production `curl` example:

```bash
# Create a Linky directly through the production public API.
curl -X POST "https://getalinky.com/api/linkies" \
  -H "content-type: application/json" \
  --data-binary '{
    "urls": [
      "https://example.com",
      "https://example.org"
    ],
    "source": "agent",
    "metadata": {
      "task": "launch-two-links"
    }
  }'
```

Common errors:
- `400`: invalid payload (URLs, metadata)
- `429`: rate limit exceeded
- `500`: server/database issue

## CLI

The package ships a `linky` command.

```bash
linky create <url1> <url2> [url3] ... [options]
```

Options:
- `--base-url <url>` Linky API/web base URL
- `--stdin` read additional URLs from stdin
- `--json` machine-readable output

Examples:

```bash
linky create https://example.com https://example.org
echo "https://example.com" | linky create --stdin --json
```

## Package API (for agents and scripts)

```js
const { createLinky } = require("@linky/linky");

const result = await createLinky({
  // Point the SDK at the production Linky deployment.
  urls: ["https://example.com", "https://example.org"],
  baseUrl: "https://getalinky.com",
  source: "agent",
});

// Print the final short Linky URL.
console.log(result.url);
```

## Deployment

### Vercel + Managed Postgres

1. Deploy this repo to Vercel.
2. Attach a managed Postgres database.
3. Set env vars in Vercel project settings:
   - `DATABASE_URL`
   - `LINKY_BASE_URL` (`https://getalinky.com` in production)
   - `LINKY_RATE_LIMIT_WINDOW_MS` (optional)
   - `LINKY_RATE_LIMIT_MAX_REQUESTS` (optional)
4. Add your custom domain in Vercel and point DNS records.

## Roadmap

- Custom domains per user/workspace
- Custom aliases (re-introduced with domain ownership controls)
- Team/workspace access controls

## Development Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
npm run check
```

## Contributing

See `CONTRIBUTING.md`.

## License

MIT (`LICENSE`).
