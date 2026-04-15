import "server-only";

import { Pool } from "pg";

import { getDatabaseUrl } from "./config";

declare global {
  var __linkyPgPool: Pool | undefined;
}

function shouldUseSsl(connectionString: string): boolean {
  return (
    !connectionString.includes("localhost") &&
    !connectionString.includes("127.0.0.1")
  );
}

export function getPgPool(): Pool {
  if (globalThis.__linkyPgPool) {
    return globalThis.__linkyPgPool;
  }

  const connectionString = getDatabaseUrl();
  const pool = new Pool({
    connectionString,
    max: 10,
    // Managed Postgres providers often require TLS while local dev usually does not.
    ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : false,
  });

  globalThis.__linkyPgPool = pool;
  return pool;
}
