-- ============================================================================
-- Linky schema — canonical current state.
--
-- Apply to a fresh database with:
--   psql "$DATABASE_URL" -f db/schema.sql
--
-- For existing databases, apply migrations incrementally from db/migrations/*.
-- This file should always reflect the same schema that results from applying
-- all migrations in order.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Identity mirror. Clerk is the source of truth; these tables are written by
-- the Clerk webhook handler so every query can JOIN on a stable foreign key.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  clerk_user_id      TEXT PRIMARY KEY,
  email              TEXT,
  display_name       TEXT,
  avatar_url         TEXT,
  stripe_customer_id TEXT UNIQUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organizations (
  clerk_org_id       TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  slug               TEXT UNIQUE,
  stripe_customer_id TEXT UNIQUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS memberships (
  clerk_user_id TEXT NOT NULL REFERENCES users(clerk_user_id) ON DELETE CASCADE,
  clerk_org_id  TEXT NOT NULL REFERENCES organizations(clerk_org_id) ON DELETE CASCADE,
  role          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (clerk_user_id, clerk_org_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_clerk_org_id
  ON memberships (clerk_org_id);

-- ---------------------------------------------------------------------------
-- Entitlements. Per-subject plan + limits. Read by the API layer on every
-- gated call. Populated by Stripe webhooks; defaults to the `free` plan.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS entitlements (
  subject_type           TEXT NOT NULL CHECK (subject_type IN ('user', 'org')),
  subject_id             TEXT NOT NULL,
  plan                   TEXT NOT NULL DEFAULT 'free',
  limits                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  stripe_subscription_id TEXT,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (subject_type, subject_id)
);

-- ---------------------------------------------------------------------------
-- Linkies. The product's core table: a slug resolves to a bundle of URLs
-- plus per-URL metadata, optional title/description, and ownership.
-- Anonymous linkies leave both owner columns NULL and remain immutable.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS linkies (
  id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug                TEXT NOT NULL UNIQUE,
  urls                JSONB NOT NULL,
  custom_alias        BOOLEAN NOT NULL DEFAULT FALSE,
  source              TEXT NOT NULL DEFAULT 'unknown',
  metadata            JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  owner_user_id       TEXT REFERENCES users(clerk_user_id) ON DELETE SET NULL,
  owner_org_id        TEXT REFERENCES organizations(clerk_org_id) ON DELETE SET NULL,
  title               TEXT,
  description         TEXT,
  -- Positional array aligned with `urls`. Entry shape:
  --   { note?: string, tags?: string[], openPolicy?: "desktop"|"mobile"|"always" }
  url_metadata        JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Hashed IP + User-Agent fingerprint captured at create time for the
  -- "claim this anonymous linky later" flow.
  creator_fingerprint TEXT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ,
  -- Reserved for Sprint 2 (URL-as-API resolution policy).
  resolution_policy   JSONB NOT NULL DEFAULT '{}'::jsonb,

  CHECK (jsonb_typeof(urls) = 'array'),
  CHECK (jsonb_typeof(url_metadata) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_linkies_owner_user
  ON linkies (owner_user_id) WHERE owner_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_linkies_owner_org
  ON linkies (owner_org_id) WHERE owner_org_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_linkies_deleted_at
  ON linkies (deleted_at);

-- ---------------------------------------------------------------------------
-- Linky versions. Append-only history of every edit; enables undo + audit.
-- Public resolution always reads `linkies` (current state), not this table.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS linky_versions (
  id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  linky_id                INTEGER NOT NULL REFERENCES linkies(id) ON DELETE CASCADE,
  version_number          INTEGER NOT NULL,
  urls                    JSONB   NOT NULL,
  url_metadata            JSONB   NOT NULL,
  title                   TEXT,
  description             TEXT,
  -- Snapshot of `linkies.resolution_policy` at the moment this version was
  -- captured. Added in migration 003; defaults to `{}` so pre-Sprint-2 rows
  -- remain valid when replayed.
  resolution_policy       JSONB   NOT NULL DEFAULT '{}'::jsonb,
  edited_by_clerk_user_id TEXT,
  edited_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (linky_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_linky_versions_linky_id
  ON linky_versions (linky_id, version_number DESC);

-- ---------------------------------------------------------------------------
-- Claim tokens. Powers agent-initiated Linky creation: the backend mints a
-- token, returns a claim URL, and transfers ownership to whichever Clerk
-- user signs in through that URL before it expires.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS claim_tokens (
  token                     TEXT PRIMARY KEY,
  linky_id                  INTEGER NOT NULL REFERENCES linkies(id) ON DELETE CASCADE,
  email                     TEXT,
  expires_at                TIMESTAMPTZ NOT NULL,
  consumed_at               TIMESTAMPTZ,
  consumed_by_clerk_user_id TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_claim_tokens_linky_id
  ON claim_tokens (linky_id);

CREATE INDEX IF NOT EXISTS idx_claim_tokens_expires_at
  ON claim_tokens (expires_at);
