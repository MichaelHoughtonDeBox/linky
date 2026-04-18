import "server-only";

import { createHash } from "node:crypto";

import { getPgPool } from "./postgres";

// The sliver of an `EvaluationResult` we actually persist. Passed by the
// caller so we don't couple the repo to the full result shape.
export type LauncherMatchContext = {
  matchedRuleId: string | null;
};

// ============================================================================
// Launcher events repository — Sprint 2.7 Chunk A.
//
// Owner-side analytics only. Trust posture (README.md bullet 9): we answer
// "did my audience arrive, and did the right rule match?" — never "what is
// Alice doing right now?". That constraint drives three invariants in this
// file:
//
//   1. We NEVER persist raw identity. `viewer_hash_day` is a one-way hash
//      over (subject || date || salt). The daily salt rotation means
//      unique-viewers-per-day is answerable; cross-day identity recovery
//      is intentionally impossible without knowing the historical salt.
//   2. Writes are fire-and-forget. The public `/l/[slug]` render MUST NOT
//      await this insert — a DB blip cannot delay or 500 the launcher. The
//      caller wraps `recordView` / `recordOpenAll` in Next.js 16's `after()`
//      or a plain non-awaited promise. This module itself still swallows
//      errors defensively (log + drop) in case the caller forgets.
//   3. No FK on `matched_rule_id`. The policy lives in a JSONB column and
//      rules can be deleted/renamed freely. Aggregation (Chunk B) joins
//      event ids against the current policy at read time and renders
//      dangling ids as "(removed rule)".
// ============================================================================

export type LauncherEventKind = "view" | "open_all";
export type LauncherViewerState = "anonymous" | "signed_in";

// The pure hashing core — same function drives `fingerprint.ts`-style
// tests without needing a live salt. Exported so `launcher-events.test.ts`
// can assert determinism + daily rotation across fake dates.
export function computeViewerHashDay(input: {
  subjectKey: string;
  dateYyyyMmDd: string;
  salt: string;
}): string {
  const hash = createHash("sha256");
  hash.update(input.subjectKey);
  hash.update("|");
  hash.update(input.dateYyyyMmDd);
  hash.update("|");
  hash.update(input.salt);
  return hash.digest("hex").slice(0, 32);
}

// Extract the UTC day component as YYYY-MM-DD. Pulled out for tests.
export function todayUtcYyyyMmDd(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

// `subjectKey` is the only identity we feed the hash. Callers decide:
//   - signed-in viewer: their Clerk user id
//   - anonymous viewer: the /24 subnet of their IP (hashed further by us)
//
// Deliberate design choice documented in the sprint plan: we hash
// `clerk_user_id` alone (not `clerk_user_id || org_id`), so "unique viewers
// this week" cannot be cross-referenced against an org member list to
// deanonymize. Losing "how many distinct Acme employees clicked" is the
// trade; that's a viewer question and thus out of scope per posture
// bullet 9.
export function resolveSubjectKey(input: {
  clerkUserId: string | null;
  clientIp: string;
}): { subjectKey: string; viewerState: LauncherViewerState } {
  if (input.clerkUserId) {
    return {
      subjectKey: `u:${input.clerkUserId}`,
      viewerState: "signed_in",
    };
  }

  return {
    subjectKey: `ip:${ipSubnet24(input.clientIp)}`,
    viewerState: "anonymous",
  };
}

// Reduce an IP to its /24 (IPv4) or /48 (IPv6) prefix so the hash input is
// coarse enough that two different devices on the same office network
// collapse to one viewer. We never persist the raw IP anyway — this just
// lowers the entropy of the per-day hash input, reducing what a leaked
// salt would let an attacker re-identify.
function ipSubnet24(ip: string): string {
  if (!ip || ip === "unknown") return "unknown";

  if (ip.includes(":")) {
    // IPv6: keep the first three groups (/48). Matches what most ISPs
    // allocate as a customer prefix; keeps unique-viewer accounting
    // sensible.
    const groups = ip.split(":").slice(0, 3).join(":");
    return `v6:${groups}`;
  }

  const parts = ip.split(".");
  if (parts.length !== 4) return `raw:${ip}`;
  return `v4:${parts[0]}.${parts[1]}.${parts[2]}.0`;
}

function getDailySalt(): string {
  // Required-at-call-time — we do NOT fall back to a hard-coded value
  // because that would silently reduce the trust guarantee to zero for
  // any instance that forgot to set it. A missing salt means analytics
  // writes are disabled; the launcher keeps working.
  const raw = process.env.LINKY_DAILY_SALT;
  if (!raw || raw.length < 16) return "";
  return raw;
}

type RecordEventInput = {
  linkyId: number;
  kind: LauncherEventKind;
  matchContext: LauncherMatchContext | null;
  clerkUserId: string | null;
  clientIp: string;
  now?: Date;
};

async function recordEvent(input: RecordEventInput): Promise<void> {
  const salt = getDailySalt();
  if (!salt) {
    // Analytics silently disabled. Log once per launch via
    // stderr so ops notice — but never throw up the stack.
    logDisabledOnce();
    return;
  }

  const now = input.now ?? new Date();
  const { subjectKey, viewerState } = resolveSubjectKey({
    clerkUserId: input.clerkUserId,
    clientIp: input.clientIp,
  });

  const viewerHashDay = computeViewerHashDay({
    subjectKey,
    dateYyyyMmDd: todayUtcYyyyMmDd(now),
    salt,
  });

  const pool = getPgPool();
  try {
    await pool.query(
      `
      INSERT INTO launcher_events (
        linky_id, kind, matched_rule_id, viewer_state, viewer_hash_day
      ) VALUES ($1, $2, $3, $4, $5)
      `,
      [
        input.linkyId,
        input.kind,
        input.matchContext?.matchedRuleId ?? null,
        viewerState,
        viewerHashDay,
      ],
    );
  } catch (error) {
    // Analytics writes must never surface to the viewer. The launcher has
    // already responded by the time this runs (via `after()`); throwing
    // here only pollutes logs. One stderr line is enough.
    console.error("[launcher-events] insert failed:", error);
  }
}

let warnedAboutDisabledOnce = false;
function logDisabledOnce(): void {
  if (warnedAboutDisabledOnce) return;
  warnedAboutDisabledOnce = true;
  console.warn(
    "[launcher-events] LINKY_DAILY_SALT not configured — analytics writes disabled.",
  );
}

export async function recordView(input: {
  linkyId: number;
  matchContext: LauncherMatchContext | null;
  clerkUserId: string | null;
  clientIp: string;
}): Promise<void> {
  await recordEvent({ ...input, kind: "view" });
}

export async function recordOpenAll(input: {
  linkyId: number;
  matchContext: LauncherMatchContext | null;
  clerkUserId: string | null;
  clientIp: string;
}): Promise<void> {
  await recordEvent({ ...input, kind: "open_all" });
}
