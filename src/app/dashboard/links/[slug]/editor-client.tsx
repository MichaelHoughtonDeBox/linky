"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import type { ResolutionPolicy } from "@/lib/linky/policy";
import type {
  LinkyVersionRecord,
  OpenPolicy,
  UrlMetadata,
} from "@/lib/linky/types";

import { PersonalizePanel } from "./personalize-panel";

type Props = {
  slug: string;
  initialTitle: string | null;
  initialDescription: string | null;
  initialUrls: string[];
  initialUrlMetadata: UrlMetadata[];
  initialResolutionPolicy: ResolutionPolicy;
  versions: LinkyVersionRecord[];
};

// Sentinel — matches `PatchLinkyPayload.resolutionPolicy`: `null` means
// "clear the policy", `undefined` means "leave it untouched", otherwise a
// parsed `ResolutionPolicy`. We model the local state with an explicit
// "dirty" flag so we only include the key in PATCH when the user
// deliberately edited it.
type PolicyDraft =
  | { kind: "untouched" }
  | { kind: "cleared" }
  | { kind: "edited"; policy: ResolutionPolicy };

const OPEN_POLICIES: { value: OpenPolicy; label: string }[] = [
  { value: "always", label: "Always open" },
  { value: "desktop", label: "Desktop only" },
  { value: "mobile", label: "Mobile only" },
];

const MAX_URLS = 25;

function metaAt(index: number, source: UrlMetadata[]): UrlMetadata {
  return source[index] ?? {};
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function swap<T>(arr: T[], i: number, j: number): T[] {
  if (i === j || i < 0 || j < 0 || i >= arr.length || j >= arr.length) return arr;
  const copy = arr.slice();
  const [a, b] = [copy[i], copy[j]];
  copy[i] = b;
  copy[j] = a;
  return copy;
}

export function LinkyEditor({
  slug,
  initialTitle,
  initialDescription,
  initialUrls,
  initialUrlMetadata,
  initialResolutionPolicy,
  versions,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle ?? "");
  const [description, setDescription] = useState(initialDescription ?? "");
  const [urls, setUrls] = useState<string[]>(initialUrls);
  const [urlMetadata, setUrlMetadata] = useState<UrlMetadata[]>(() =>
    initialUrlMetadata.length === initialUrls.length
      ? initialUrlMetadata
      : initialUrls.map((_, i) => metaAt(i, initialUrlMetadata)),
  );
  const [policyDraft, setPolicyDraft] = useState<PolicyDraft>({
    kind: "untouched",
  });
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const cleanedUrls = useMemo(
    () => urls.map((u) => u.trim()),
    [urls],
  );
  const hasInvalid = useMemo(
    () => cleanedUrls.some((u) => u.length === 0 || !isHttpUrl(u)),
    [cleanedUrls],
  );
  const isDirty = useMemo(() => {
    if (title.trim() !== (initialTitle ?? "")) return true;
    if (description.trim() !== (initialDescription ?? "")) return true;
    if (urls.length !== initialUrls.length) return true;
    if (urls.some((u, i) => u !== initialUrls[i])) return true;
    if (
      urlMetadata.some(
        (meta, i) => JSON.stringify(meta) !== JSON.stringify(metaAt(i, initialUrlMetadata)),
      )
    ) {
      return true;
    }
    if (policyDraft.kind !== "untouched") return true;
    return false;
  }, [
    title,
    description,
    urls,
    urlMetadata,
    policyDraft,
    initialTitle,
    initialDescription,
    initialUrls,
    initialUrlMetadata,
  ]);

  const handleUpdateUrl = (index: number, value: string) => {
    setUrls((prev) => prev.map((u, i) => (i === index ? value : u)));
  };

  const handleUpdateMeta = (
    index: number,
    patch: Partial<UrlMetadata>,
  ) => {
    setUrlMetadata((prev) =>
      prev.map((meta, i) => (i === index ? { ...meta, ...patch } : meta)),
    );
  };

  const handleAddUrl = () => {
    if (urls.length >= MAX_URLS) return;
    setUrls((prev) => [...prev, ""]);
    setUrlMetadata((prev) => [...prev, {}]);
  };

  const handleRemoveUrl = (index: number) => {
    if (urls.length <= 1) return;
    setUrls((prev) => prev.filter((_, i) => i !== index));
    setUrlMetadata((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMoveUrl = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    setUrls((prev) => swap(prev, index, target));
    setUrlMetadata((prev) => swap(prev, index, target));
  };

  const handleSave = () => {
    setError(null);
    setSuccessMessage(null);

    if (hasInvalid) {
      setError("Every URL must start with http:// or https://.");
      return;
    }

    startTransition(async () => {
      try {
        const patchBody: Record<string, unknown> = {
          title: title.trim() || null,
          description: description.trim() || null,
          urls: cleanedUrls,
          urlMetadata,
        };

        if (policyDraft.kind === "cleared") {
          patchBody.resolutionPolicy = null;
        } else if (policyDraft.kind === "edited") {
          patchBody.resolutionPolicy = policyDraft.policy;
        }

        const response = await fetch(`/api/links/${slug}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patchBody),
        });

        const responseBody = (await response.json().catch(() => ({}))) as {
          error?: string;
        };

        if (!response.ok) {
          setError(responseBody.error ?? `Save failed (${response.status}).`);
          return;
        }

        setSuccessMessage("Saved. New version appended to history.");
        setPolicyDraft({ kind: "untouched" });
        // Re-fetch the server-rendered view so initial* props are fresh on
        // next navigation and isDirty resets against the new baseline.
        router.refresh();
      } catch {
        setError("Could not reach the Linky API. Check your connection and retry.");
      }
    });
  };

  const handleDelete = () => {
    setError(null);
    setSuccessMessage(null);

    const confirmed = window.confirm(
      "Delete this Linky? The short URL will stop working for everyone who has the link. You can't undo this from the dashboard.",
    );
    if (!confirmed) return;

    startTransition(async () => {
      try {
        const response = await fetch(`/api/links/${slug}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          setError(body.error ?? `Delete failed (${response.status}).`);
          return;
        }

        router.push("/dashboard");
        router.refresh();
      } catch {
        setError("Could not reach the Linky API. Check your connection and retry.");
      }
    });
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        handleSave();
      }}
      className="dashboard-editor-form space-y-6"
    >
      {/* Title + description */}
      <section className="terminal-card space-y-3 p-4 sm:p-5">
        <div>
          <label htmlFor="linky-title" className="terminal-label mb-2 block">
            Title (optional)
          </label>
          <input
            id="linky-title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            placeholder="e.g. Release 2026.04 review bundle"
            className="terminal-input text-sm sm:text-base"
          />
        </div>

        <div>
          <label
            htmlFor="linky-description"
            className="terminal-label mb-2 block"
          >
            Description (optional)
          </label>
          <textarea
            id="linky-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={500}
            placeholder="A short blurb shown on the launcher page."
            className="terminal-input min-h-[5rem] resize-y text-sm sm:text-base"
          />
        </div>
      </section>

      {/* URLs list */}
      <section className="terminal-card p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="terminal-label">
            URLs ({urls.length}/{MAX_URLS})
          </p>
          <button
            type="button"
            onClick={handleAddUrl}
            disabled={urls.length >= MAX_URLS}
            className="terminal-secondary px-3 py-1.5 text-xs sm:text-sm"
          >
            + Add URL
          </button>
        </div>

        <ol className="space-y-4">
          {urls.map((url, index) => {
            const meta = metaAt(index, urlMetadata);
            const tagString = (meta.tags ?? []).join(", ");
            return (
              <li
                key={`${index}-${initialUrls[index] ?? "new"}`}
                className="dashboard-url-row border-t border-[var(--panel-border)] pt-3"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="terminal-muted w-6 text-xs">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <input
                    type="url"
                    value={url}
                    onChange={(event) =>
                      handleUpdateUrl(index, event.target.value)
                    }
                    placeholder="https://example.com"
                    className="terminal-input flex-1 text-sm"
                    spellCheck={false}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => handleMoveUrl(index, -1)}
                    disabled={index === 0}
                    className="terminal-secondary px-2 py-1 text-xs"
                    aria-label="Move up"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveUrl(index, 1)}
                    disabled={index === urls.length - 1}
                    className="terminal-secondary px-2 py-1 text-xs"
                    aria-label="Move down"
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveUrl(index)}
                    disabled={urls.length <= 1}
                    className="terminal-secondary px-2 py-1 text-xs"
                    aria-label="Remove URL"
                    title="Remove URL"
                  >
                    ✕
                  </button>
                </div>

                <div className="ml-8 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <input
                    type="text"
                    value={meta.note ?? ""}
                    onChange={(event) =>
                      handleUpdateMeta(index, {
                        note: event.target.value || undefined,
                      })
                    }
                    maxLength={500}
                    placeholder="Note (why this URL is in the bundle)"
                    className="terminal-input text-xs sm:text-sm"
                  />
                  <input
                    type="text"
                    value={tagString}
                    onChange={(event) => {
                      const tags = event.target.value
                        .split(",")
                        .map((t) => t.trim())
                        .filter((t) => t.length > 0);
                      handleUpdateMeta(index, {
                        tags: tags.length > 0 ? tags : undefined,
                      });
                    }}
                    placeholder="tags (comma-separated)"
                    className="terminal-input text-xs sm:text-sm"
                  />
                  <select
                    value={meta.openPolicy ?? "always"}
                    onChange={(event) =>
                      handleUpdateMeta(index, {
                        openPolicy:
                          event.target.value === "always"
                            ? undefined
                            : (event.target.value as OpenPolicy),
                      })
                    }
                    className="terminal-input text-xs sm:text-sm"
                  >
                    {OPEN_POLICIES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            );
          })}
        </ol>

        <p className="terminal-muted mt-4 text-xs">
          Per-URL notes, tags, and open policies are stored now. The launcher
          UI will start rendering notes + honoring the open policy in Sprint 2.
        </p>
      </section>

      <PersonalizePanel
        initialPolicy={initialResolutionPolicy}
        fallbackUrls={cleanedUrls}
        disabled={isPending}
        onChange={(policy) => {
          if (policy === null) {
            setPolicyDraft({ kind: "cleared" });
          } else {
            setPolicyDraft({ kind: "edited", policy });
          }
        }}
      />

      {/* Save / delete / feedback */}
      <section className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending || !isDirty || hasInvalid}
          className="terminal-action px-5 py-2 text-sm sm:text-base"
        >
          {isPending ? "Saving..." : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => setShowHistory((prev) => !prev)}
          className="terminal-secondary px-4 py-2 text-sm"
        >
          {showHistory ? "Hide history" : `History (${versions.length})`}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className="terminal-secondary px-4 py-2 text-sm"
          style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
        >
          Delete Linky
        </button>
      </section>

      {error ? (
        <section
          className="site-inline-callout text-sm"
          style={{ color: "var(--danger)" }}
        >
          {error}
        </section>
      ) : null}
      {successMessage ? (
        <section className="site-inline-callout text-sm text-foreground">
          {successMessage}
        </section>
      ) : null}

      {showHistory ? (
        <section className="terminal-card p-4 sm:p-5">
          <p className="terminal-label mb-3">Version history</p>
          {versions.length === 0 ? (
            <p className="terminal-muted text-xs sm:text-sm">
              No prior versions. Every time you save, the previous state is
              captured here so nothing is ever lost.
            </p>
          ) : (
            <ol className="site-divider-list">
              {versions.map((version) => (
                <li
                  key={version.versionNumber}
                  className="site-divider-item text-xs sm:text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">
                      v{version.versionNumber}
                    </span>
                    <span className="terminal-muted">
                      {new Date(version.editedAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="terminal-muted mt-1">
                    {version.title ? `"${version.title}" · ` : ""}
                    {version.urls.length} URL
                    {version.urls.length === 1 ? "" : "s"}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>
      ) : null}
    </form>
  );
}
