# Contributing to Linky

Thanks for contributing to Linky.

## Development setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

```bash
cp .env.example .env.local
```

3. Create the database schema:

```bash
psql "$DATABASE_URL" -f db/schema.sql
```

4. Start the app:

```bash
npm run dev
```

## Before opening a PR

Run:

```bash
npm run check
npm run build
```

## Pull request guidance

- Keep changes focused and small.
- Include tests when you add behavior.
- Document public API changes in `README.md`.
- If you change payload contracts, update CLI + package examples too.

## Commit style

Use clear, imperative commit messages (for example: `feat: improve slug generation`).
