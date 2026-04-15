import { notFound } from "next/navigation";

import { getLinkyRecordBySlug } from "@/lib/server/linkies-repository";
import { getPublicBaseUrl } from "@/lib/server/config";

import { LinkyLauncher } from "./launcher-client";
import { LinkyResolverError } from "./resolver-error";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LinkySlugPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function LinkySlugPage({ params }: LinkySlugPageProps) {
  let slug: string;

  try {
    ({ slug } = await params);
  } catch {
    return <LinkyResolverError />;
  }

  let linky: Awaited<ReturnType<typeof getLinkyRecordBySlug>>;
  try {
    linky = await getLinkyRecordBySlug(slug);
  } catch {
    return <LinkyResolverError />;
  }

  if (!linky) {
    notFound();
  }

  return (
    <LinkyLauncher
      slug={linky.slug}
      urls={linky.urls}
      createdAt={linky.createdAt}
      baseUrl={getPublicBaseUrl()}
    />
  );
}
