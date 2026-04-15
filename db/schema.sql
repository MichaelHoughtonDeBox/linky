-- Linky v1 schema.
-- Apply with: psql "$DATABASE_URL" -f db/schema.sql

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

-- Future optional index for admin/reporting queries:
-- CREATE INDEX IF NOT EXISTS idx_linkies_created_at ON linkies (created_at DESC);
