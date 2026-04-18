import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  canEditLinky,
  requireAuthSubject,
  roleOfSubject,
} from "@/lib/server/auth";
import { getPublicBaseUrl } from "@/lib/server/config";
import {
  getLinkyRecordBySlug,
  listLinkyVersions,
} from "@/lib/server/linkies-repository";

import { LinkyEditor } from "./editor-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function DashboardLinkyEditPage({ params }: PageProps) {
  const { slug } = await params;
  const subject = await requireAuthSubject();

  const linky = await getLinkyRecordBySlug(slug);
  if (!linky) notFound();

  const ownership = {
    ownerUserId:
      linky.owner.type === "user" ? linky.owner.userId : null,
    ownerOrgId:
      linky.owner.type === "org" ? linky.owner.orgId : null,
  };

  // If the active subject can't edit this Linky (wrong org context, not an
  // owner, viewer-only role on org-owned, or attempting to manage an
  // anonymous Linky) send them to the dashboard home. We use a redirect
  // rather than a hard 403 so the flow is friendly if someone clicks a
  // stale link. Role is derived from `session.orgRole` via `roleOfSubject`
  // — viewers land back on `/dashboard`; a read-only "insights only" page
  // will open to viewers when Chunk B ships.
  if (!canEditLinky(subject, ownership, roleOfSubject(subject))) {
    redirect("/dashboard");
  }

  // Fetch recent versions in parallel once the DAL check passes.
  const versions = await listLinkyVersions(slug, { limit: 10 });
  const baseUrl = getPublicBaseUrl();
  const publicUrl = new URL(`/l/${linky.slug}`, baseUrl).toString();

  return (
    <section className="dashboard-linky-edit">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="terminal-label mb-1">Edit Linky</p>
          <h1 className="display-title text-2xl font-semibold text-foreground sm:text-3xl">
            {linky.title || `/l/${linky.slug}`}
          </h1>
          <p className="terminal-muted mt-2 break-all text-xs sm:text-sm">
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-4 hover:underline"
            >
              {publicUrl}
            </a>
          </p>
        </div>
        <Link
          href="/dashboard"
          className="terminal-secondary px-3 py-1.5 text-xs sm:text-sm"
        >
          Back to dashboard
        </Link>
      </header>

      <LinkyEditor
        slug={linky.slug}
        initialTitle={linky.title}
        initialDescription={linky.description}
        initialUrls={linky.urls}
        initialUrlMetadata={linky.urlMetadata}
        initialResolutionPolicy={linky.resolutionPolicy}
        versions={versions}
      />
    </section>
  );
}
