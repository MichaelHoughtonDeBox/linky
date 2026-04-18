import Link from "next/link";

import type { LinkyRecord } from "@/lib/linky/types";
import { requireAuthSubject, roleOfSubject } from "@/lib/server/auth";
import { getPublicBaseUrl } from "@/lib/server/config";
import { listLinkiesForSubject } from "@/lib/server/linkies-repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const INITIAL_PAGE_SIZE = 50;

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

function LinkyRow({
  linky,
  baseUrl,
}: {
  linky: LinkyRecord;
  baseUrl: string;
}) {
  const publicUrl = new URL(`/l/${linky.slug}`, baseUrl).toString();

  return (
    <article className="dashboard-linky-row site-divider-item flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <Link
          href={`/dashboard/links/${linky.slug}`}
          className="dashboard-linky-title block truncate text-sm font-semibold text-foreground hover:underline sm:text-base"
        >
          {linky.title || `/l/${linky.slug}`}
        </Link>
        {linky.description ? (
          <p className="terminal-muted mt-1 truncate text-xs sm:text-sm">
            {linky.description}
          </p>
        ) : null}
        <p className="terminal-muted mt-1 text-xs">
          <span>{linky.urls.length} URL{linky.urls.length === 1 ? "" : "s"}</span>
          <span className="mx-2">·</span>
          <span>updated {formatRelative(linky.updatedAt)}</span>
          <span className="mx-2">·</span>
          <span>source: {linky.source}</span>
        </p>
      </div>
      <div className="flex items-center gap-2">
        <a
          href={publicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="terminal-secondary px-3 py-1.5 text-xs sm:text-sm"
        >
          Open
        </a>
        <Link
          href={`/dashboard/links/${linky.slug}`}
          className="terminal-secondary px-3 py-1.5 text-xs sm:text-sm"
        >
          Edit
        </Link>
      </div>
    </article>
  );
}

function EmptyState({ subjectKind }: { subjectKind: "user" | "org" }) {
  return (
    <section className="dashboard-empty site-inline-callout">
      <p className="terminal-label mb-2">No launch bundles here yet</p>
      <p className="terminal-muted mb-3 max-w-xl text-sm sm:text-base">
        {subjectKind === "org"
          ? "This organization has no saved launch bundles yet. Create one from the homepage; any Linky you create while this org is active will be owned by the team."
          : "You have no saved launch bundles yet. Create one from the homepage — it will be attributed to your account so you can edit it here."}
      </p>
      <Link href="/" className="terminal-action px-4 py-2 text-sm">
        Create a Linky
      </Link>
    </section>
  );
}

export default async function DashboardPage() {
  // `proxy.ts` already gated /dashboard/* as protected, so `requireAuthSubject`
  // is guaranteed to return a signed-in subject here. We still call it so this
  // page is safe even if a future refactor moves/removes that gate.
  const subject = await requireAuthSubject();
  const baseUrl = getPublicBaseUrl();

  // Sprint 2.7 Chunk C: non-admin org members don't see the API-keys
  // link. User subjects are always admin of themselves so personal
  // keys stay reachable.
  const canManageKeys =
    subject.type === "user" || roleOfSubject(subject) === "admin";

  const linkies =
    subject.type === "org"
      ? await listLinkiesForSubject({
          type: "org",
          orgId: subject.orgId,
          limit: INITIAL_PAGE_SIZE,
          offset: 0,
        })
      : await listLinkiesForSubject({
          type: "user",
          userId: subject.userId,
          limit: INITIAL_PAGE_SIZE,
          offset: 0,
        });

  return (
    <section className="dashboard-linky-list">
      <header className="mb-5">
        {/*
          Workspace identity now lives in the layout-level chip. This header
          focuses on the page's job: listing launch bundles. We still flex
          the copy by subject so "team" vs "personal" feels natural, but we
          no longer duplicate the workspace name here.
        */}
        <p className="terminal-label mb-1">Launch bundles</p>
        <h1 className="display-title text-3xl font-semibold text-foreground sm:text-4xl">
          {subject.type === "org"
            ? "Team-owned launch bundles"
            : "Your launch bundles"}
        </h1>
        <p className="terminal-muted mt-2 max-w-2xl text-sm sm:text-base">
          Manage, edit, and share the launch bundles attributed to{" "}
          {subject.type === "org" ? "this organization" : "your account"}.
          Switch workspace above to see bundles owned by a different account
          or team.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {canManageKeys ? (
            <Link
              href="/dashboard/api-keys"
              className="terminal-secondary px-3 py-1.5 text-xs sm:text-sm"
            >
              Manage API keys
            </Link>
          ) : null}
        </div>
      </header>

      {linkies.length === 0 ? (
        <EmptyState subjectKind={subject.type} />
      ) : (
        <div className="site-divider-list">
          {linkies.map((linky) => (
            <LinkyRow key={linky.slug} linky={linky} baseUrl={baseUrl} />
          ))}
        </div>
      )}

      {linkies.length >= INITIAL_PAGE_SIZE ? (
        <p className="terminal-muted mt-6 text-xs">
          Showing the {INITIAL_PAGE_SIZE} most recently updated bundles.
          Pagination arrives in a future sprint.
        </p>
      ) : null}
    </section>
  );
}
