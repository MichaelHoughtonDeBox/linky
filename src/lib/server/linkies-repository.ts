import "server-only";

import type { LinkyMetadata, LinkyRecord, LinkySource } from "@/lib/linky/types";

import { getPgPool } from "./postgres";

type DbLinkyRow = {
  id: number;
  slug: string;
  urls: unknown;
  created_at: Date | string;
  custom_alias: boolean;
  source: string | null;
  metadata: unknown;
};

export type InsertLinkyRecordInput = {
  slug: string;
  urls: string[];
  source: LinkySource;
  metadata?: LinkyMetadata;
};

const ENSURE_LINKIES_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS linkies (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  urls JSONB NOT NULL,
  custom_alias BOOLEAN NOT NULL DEFAULT FALSE,
  source TEXT NOT NULL DEFAULT 'unknown',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (jsonb_typeof(urls) = 'array')
);
`;

let ensureSchemaPromise: Promise<void> | null = null;

async function ensureLinkiesTable(): Promise<void> {
  if (!ensureSchemaPromise) {
    const pool = getPgPool();

    // We guard schema creation in-process so repeated requests do not race setup work.
    ensureSchemaPromise = pool
      .query(ENSURE_LINKIES_TABLE_SQL)
      .then(() => undefined)
      .catch((error) => {
        ensureSchemaPromise = null;
        throw error;
      });
  }

  await ensureSchemaPromise;
}

function normalizeDbSource(rawSource: string | null): LinkySource {
  switch (rawSource) {
    case "web":
    case "cli":
    case "sdk":
    case "agent":
    case "unknown":
      return rawSource;
    default:
      return "unknown";
  }
}

function normalizeDbMetadata(rawMetadata: unknown): LinkyMetadata | null {
  if (
    typeof rawMetadata === "object" &&
    rawMetadata !== null &&
    !Array.isArray(rawMetadata)
  ) {
    return rawMetadata as LinkyMetadata;
  }

  return null;
}

function normalizeDbUrls(rawUrls: unknown): string[] {
  if (!Array.isArray(rawUrls)) {
    return [];
  }

  return rawUrls.filter((url): url is string => typeof url === "string");
}

function mapDbRow(row: DbLinkyRow): LinkyRecord {
  const createdAt =
    row.created_at instanceof Date
      ? row.created_at.toISOString()
      : new Date(row.created_at).toISOString();

  return {
    id: row.id,
    slug: row.slug,
    urls: normalizeDbUrls(row.urls),
    createdAt,
    source: normalizeDbSource(row.source),
    metadata: normalizeDbMetadata(row.metadata),
  };
}

export async function insertLinkyRecord(
  input: InsertLinkyRecordInput,
): Promise<LinkyRecord | null> {
  await ensureLinkiesTable();

  const pool = getPgPool();
  const result = await pool.query<DbLinkyRow>(
    `
    INSERT INTO linkies (slug, urls, custom_alias, source, metadata)
    VALUES ($1, $2::jsonb, $3, $4, $5::jsonb)
    ON CONFLICT (slug) DO NOTHING
    RETURNING id, slug, urls, custom_alias, source, metadata, created_at
    `,
    [
      input.slug,
      JSON.stringify(input.urls),
      false,
      input.source,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ],
  );

  if (result.rowCount === 0 || result.rows.length === 0) {
    return null;
  }

  return mapDbRow(result.rows[0]);
}

export async function getLinkyRecordBySlug(
  slug: string,
): Promise<LinkyRecord | null> {
  await ensureLinkiesTable();

  const pool = getPgPool();
  const result = await pool.query<DbLinkyRow>(
    `
    SELECT id, slug, urls, custom_alias, source, metadata, created_at
    FROM linkies
    WHERE slug = $1
    LIMIT 1
    `,
    [slug],
  );

  if (result.rowCount === 0 || result.rows.length === 0) {
    return null;
  }

  return mapDbRow(result.rows[0]);
}
