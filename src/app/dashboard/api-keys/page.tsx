import Link from "next/link";
import { redirect } from "next/navigation";

import { requireAuthSubject, roleOfSubject } from "@/lib/server/auth";
import {
  listApiKeysForSubject,
  type ApiKeyRecord,
} from "@/lib/server/api-keys";

import { ApiKeysPanel } from "./panel-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

function toClientRecord(record: ApiKeyRecord) {
  return {
    ...record,
    createdAtLabel: formatRelative(record.createdAt),
    lastUsedAtLabel: record.lastUsedAt ? formatRelative(record.lastUsedAt) : null,
    revokedAtLabel: record.revokedAt ? formatRelative(record.revokedAt) : null,
  };
}

export default async function DashboardApiKeysPage() {
  const subject = await requireAuthSubject();

  // Sprint 2.7 Chunk C: key management is admin-only on org-owned
  // subjects. Non-admins bounce back to /dashboard — the API route
  // enforces the same rule server-side so a direct curl can't bypass
  // this redirect.
  if (subject.type === "org" && roleOfSubject(subject) !== "admin") {
    redirect("/dashboard");
  }

  const keys = await listApiKeysForSubject(subject);

  return (
    <section className="dashboard-api-keys">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="terminal-label mb-1">Automation credentials</p>
          <h1 className="display-title text-2xl font-semibold text-foreground sm:text-3xl">
            API keys
          </h1>
          <p className="terminal-muted mt-2 max-w-2xl text-sm sm:text-base">
            Create a machine credential for the active{" "}
            {subject.type === "org" ? "team workspace" : "personal account"}.
            Use it with the CLI, SDK, or an MCP-enabled agent. Raw keys are
            shown once and cannot be recovered later.
          </p>
          <p className="terminal-muted mt-2 max-w-2xl text-sm sm:text-base">
            Using this key with an agent harness? See{" "}
            <Link href="/docs/mcp" className="underline">
              /docs/mcp
            </Link>{" "}
            for copy-paste snippets for Cursor, Claude Desktop, Codex,
            Continue, and Cline.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="terminal-secondary px-3 py-1.5 text-xs sm:text-sm"
        >
          Back to dashboard
        </Link>
      </header>

      <ApiKeysPanel
        subjectType={subject.type}
        initialKeys={keys.map(toClientRecord)}
      />
    </section>
  );
}
