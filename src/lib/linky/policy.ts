import { LinkyError } from "./errors";
import { normalizeUrlList } from "./urls";

// ============================================================================
// Policy DSL — identity-aware resolution (Sprint 2).
//
// A `ResolutionPolicy` is a pure JSON document attached to a Linky via
// `linkies.resolution_policy`. When a viewer hits `/l/<slug>`, the server
// builds a `ViewerContext` from the Clerk session and hands both to
// `evaluatePolicy(...)`. The evaluator walks the rule list top-to-bottom;
// the first matching rule (or the accumulated `stopOnMatch: false` rules)
// produces the tab set shown to that viewer. Unmatched / anonymous viewers
// always fall through to the Linky's public `urls` (the implicit fallback).
//
// Everything in this file is pure:
//   - No DB access.
//   - No `Date.now()` / `Math.random()` inside eval (ID minting happens at
//     parse time only).
//   - No env reads.
// That purity lets `policy.test.ts` exercise the full matrix with zero
// infrastructure, and it lets the dashboard editor reuse the same evaluator
// client-side for "Preview as" impersonation without a round-trip.
// ============================================================================

// ---------------------------------------------------------------------------
// Types.
// ---------------------------------------------------------------------------

export type PolicyVersion = 1;

// Viewer fields the DSL can reference. Split by cardinality because the
// operator × field compatibility rules depend on it — see Compatibility
// below.
//
// Singular fields carry at most one string value at evaluation time.
export type SingularViewerField =
  | "email"
  | "emailDomain"
  | "userId"
  | "githubLogin"
  | "googleEmail";

// Set-valued fields hold every value the viewer possesses. A viewer with
// memberships in three orgs exposes three slugs on `orgSlugs`, etc.
export type SetViewerField = "orgIds" | "orgSlugs";

export type ViewerField = SingularViewerField | SetViewerField;

export type LeafCondition =
  | { op: "equals"; field: SingularViewerField; value: string }
  | { op: "in"; field: ViewerField; value: string[] }
  | { op: "endsWith"; field: SingularViewerField; value: string }
  | { op: "exists"; field: SingularViewerField };

export type ViewerStateCondition =
  | { op: "always" }
  | { op: "anonymous" }
  | { op: "signedIn" };

export type CompoundCondition =
  | { op: "and"; of: Condition[] }
  | { op: "or"; of: Condition[] }
  | { op: "not"; of: Condition[] };

export type Condition = LeafCondition | ViewerStateCondition | CompoundCondition;

export type PolicyTab = {
  url: string;
  note?: string;
};

export type Rule = {
  id: string;
  name?: string;
  when: Condition;
  tabs: PolicyTab[];
  // Defaults to `true` (first-match-wins). A rule with `stopOnMatch: false`
  // appends its tabs to the accumulator and evaluation continues.
  stopOnMatch: boolean;
  // Opt-in: when `true`, the viewer banner reveals the rule's human-readable
  // name. Without opt-in, the banner omits the name so owner-side taxonomy
  // (e.g. "VIP Customers", "Demo Prospects") stays internal.
  showBadge: boolean;
};

export type ResolutionPolicy = {
  version: PolicyVersion;
  rules: Rule[];
};

// ---------------------------------------------------------------------------
// Viewer context shape consumed by the evaluator. Populated by
// `src/lib/server/viewer-context.ts` from Clerk. Keep this decoupled from
// Clerk's raw user shape so tests (and the dashboard preview) can synthesize
// it directly.
// ---------------------------------------------------------------------------

export type ViewerContext = {
  // Anonymous viewers land with `anonymous: true` and empty singular /
  // plural fields. Never throws in the evaluator; missing fields yield
  // `false` leaf results.
  anonymous: boolean;
  email?: string;
  emailDomain?: string;
  userId?: string;
  githubLogin?: string;
  googleEmail?: string;
  orgIds: string[];
  orgSlugs: string[];
};

// ---------------------------------------------------------------------------
// Limits. Enforced at parse time so a pathological policy can't DoS the
// evaluator. Matches the Sprint 2 plan (§ Chunk A).
// ---------------------------------------------------------------------------

export const MAX_RULES_PER_POLICY = 50;
export const MAX_TABS_PER_RULE = 20;
// Includes the outermost rule-level `when`. A rule with a top-level leaf
// condition has depth 1; `{ and: [leaf, leaf] }` has depth 2; and so on.
export const MAX_CONDITION_DEPTH = 4;
const MAX_RULE_NAME_LENGTH = 120;
const MAX_RULE_ID_LENGTH = 64;
const MAX_CONDITION_VALUE_LENGTH = 512;
const MAX_IN_VALUE_ITEMS = 50;

const SINGULAR_FIELDS: readonly SingularViewerField[] = [
  "email",
  "emailDomain",
  "userId",
  "githubLogin",
  "googleEmail",
];

const SET_FIELDS: readonly SetViewerField[] = ["orgIds", "orgSlugs"];

const ALL_FIELDS: readonly ViewerField[] = [...SINGULAR_FIELDS, ...SET_FIELDS];

function isSetField(field: ViewerField): field is SetViewerField {
  return (SET_FIELDS as readonly string[]).includes(field);
}

function isSingularField(field: ViewerField): field is SingularViewerField {
  return (SINGULAR_FIELDS as readonly string[]).includes(field);
}

// ---------------------------------------------------------------------------
// Parser.
//
// Hand-rolled (matching `src/lib/linky/schemas.ts` style). Throws
// `LinkyError({ code: "BAD_REQUEST", statusCode: 400 })` on any malformed
// input. The parser is the *only* place policies are validated — once a
// policy survives `parseResolutionPolicy`, `evaluatePolicy` never throws.
// ---------------------------------------------------------------------------

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function bad(message: string): LinkyError {
  return new LinkyError(message, { code: "BAD_REQUEST", statusCode: 400 });
}

function parseNonEmptyString(
  raw: unknown,
  fieldPath: string,
  maxLength: number,
): string {
  if (typeof raw !== "string") {
    throw bad(`\`${fieldPath}\` must be a string.`);
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    throw bad(`\`${fieldPath}\` cannot be empty.`);
  }
  if (trimmed.length > maxLength) {
    throw bad(`\`${fieldPath}\` must be ${maxLength} characters or fewer.`);
  }
  return trimmed;
}

function parseField(raw: unknown, path: string): ViewerField {
  if (typeof raw !== "string") {
    throw bad(`\`${path}\` must be one of: ${ALL_FIELDS.join(", ")}.`);
  }
  if (!(ALL_FIELDS as readonly string[]).includes(raw)) {
    throw bad(
      `\`${path}\` must be one of: ${ALL_FIELDS.join(", ")} (got "${raw}").`,
    );
  }
  return raw as ViewerField;
}

function requireSingularField(
  field: ViewerField,
  op: string,
  path: string,
): SingularViewerField {
  if (isSingularField(field)) return field;
  throw bad(
    `Operator \`${op}\` cannot be used with set-valued field \`${field}\` at ${path}. Use \`in\` with a single-element \`value\` array instead.`,
  );
}

function parseCondition(raw: unknown, path: string, depth: number): Condition {
  if (depth > MAX_CONDITION_DEPTH) {
    throw bad(
      `Condition at ${path} nests deeper than ${MAX_CONDITION_DEPTH} levels.`,
    );
  }

  if (!isRecord(raw)) {
    throw bad(`Condition at ${path} must be a JSON object with an \`op\`.`);
  }

  const op = raw.op;
  if (typeof op !== "string") {
    throw bad(`Condition at ${path} requires a string \`op\`.`);
  }

  switch (op) {
    case "always":
    case "anonymous":
    case "signedIn":
      return { op } as ViewerStateCondition;

    case "equals": {
      const field = requireSingularField(
        parseField(raw.field, `${path}.field`),
        op,
        path,
      );
      const value = parseNonEmptyString(
        raw.value,
        `${path}.value`,
        MAX_CONDITION_VALUE_LENGTH,
      );
      return { op, field, value };
    }

    case "endsWith": {
      const field = requireSingularField(
        parseField(raw.field, `${path}.field`),
        op,
        path,
      );
      const value = parseNonEmptyString(
        raw.value,
        `${path}.value`,
        MAX_CONDITION_VALUE_LENGTH,
      );
      return { op, field, value };
    }

    case "exists": {
      const field = requireSingularField(
        parseField(raw.field, `${path}.field`),
        op,
        path,
      );
      return { op, field };
    }

    case "in": {
      const field = parseField(raw.field, `${path}.field`);
      if (!Array.isArray(raw.value)) {
        throw bad(`\`${path}.value\` must be an array of strings for op \`in\`.`);
      }
      if (raw.value.length === 0) {
        throw bad(`\`${path}.value\` must contain at least one string.`);
      }
      if (raw.value.length > MAX_IN_VALUE_ITEMS) {
        throw bad(
          `\`${path}.value\` may contain at most ${MAX_IN_VALUE_ITEMS} items.`,
        );
      }
      const seen = new Set<string>();
      const cleaned: string[] = [];
      raw.value.forEach((item, index) => {
        const parsed = parseNonEmptyString(
          item,
          `${path}.value[${index}]`,
          MAX_CONDITION_VALUE_LENGTH,
        );
        if (!seen.has(parsed)) {
          seen.add(parsed);
          cleaned.push(parsed);
        }
      });
      return { op, field, value: cleaned };
    }

    case "and":
    case "or":
    case "not": {
      if (!Array.isArray(raw.of) || raw.of.length === 0) {
        throw bad(
          `\`${path}.of\` must be a non-empty array of conditions for op \`${op}\`.`,
        );
      }
      if (op === "not" && raw.of.length !== 1) {
        throw bad(
          `\`${path}.of\` must contain exactly one condition for op \`not\`.`,
        );
      }
      const of = raw.of.map((child, index) =>
        parseCondition(child, `${path}.of[${index}]`, depth + 1),
      );
      return { op, of } as CompoundCondition;
    }

    default:
      throw bad(
        `Condition at ${path} has unknown op \`${op}\`. Supported: always, anonymous, signedIn, equals, in, endsWith, exists, and, or, not.`,
      );
  }
}

function parseTabs(raw: unknown, path: string): PolicyTab[] {
  if (!Array.isArray(raw)) {
    throw bad(`\`${path}\` must be an array of { url, note? } entries.`);
  }
  if (raw.length === 0) {
    throw bad(`\`${path}\` must contain at least one tab.`);
  }
  if (raw.length > MAX_TABS_PER_RULE) {
    throw bad(`\`${path}\` may contain at most ${MAX_TABS_PER_RULE} tabs.`);
  }

  // Route tab URLs through the shared normalizer so rules and `linkies.urls`
  // get the same validation (protocol allow-list, max length, canonical
  // shape, de-dupe).
  const rawUrls = raw.map((entry, index) => {
    if (!isRecord(entry)) {
      throw bad(`\`${path}[${index}]\` must be a JSON object with \`url\`.`);
    }
    if (typeof entry.url !== "string") {
      throw bad(`\`${path}[${index}].url\` must be a string.`);
    }
    return entry.url;
  });

  let normalized: string[];
  try {
    normalized = normalizeUrlList(rawUrls);
  } catch (error) {
    if (error instanceof LinkyError) {
      throw bad(`${path}: ${error.message}`);
    }
    throw error;
  }

  // Rebuild positional tabs after normalization. `normalizeUrlList`
  // de-duplicates silently; preserve the first note encountered for each
  // URL so the editor's positional intent survives.
  const byUrl = new Map<string, string | undefined>();
  raw.forEach((entry, index) => {
    const rec = entry as UnknownRecord;
    const canonical = safeCanonical(rec.url as string);
    if (!canonical) return;
    if (byUrl.has(canonical)) return;
    let note: string | undefined;
    if (rec.note !== undefined && rec.note !== null) {
      if (typeof rec.note !== "string") {
        throw bad(`\`${path}[${index}].note\` must be a string.`);
      }
      const trimmed = rec.note.trim();
      if (trimmed.length > 500) {
        throw bad(`\`${path}[${index}].note\` must be 500 characters or fewer.`);
      }
      note = trimmed || undefined;
    }
    byUrl.set(canonical, note);
  });

  return normalized.map((url) => {
    const note = byUrl.get(url);
    return note ? { url, note } : { url };
  });
}

// Canonicalize in the same way `normalizeUrlList` does so we can look up
// per-URL metadata after de-duplication. Returns `null` if the URL is
// unparseable — that case has already been surfaced by `normalizeUrlList`
// above, so we won't reach it in practice.
function safeCanonical(raw: string): string | null {
  try {
    return new URL(raw.trim()).toString();
  } catch {
    return null;
  }
}

function parseRule(raw: unknown, path: string): Rule {
  if (!isRecord(raw)) {
    throw bad(`\`${path}\` must be a JSON object.`);
  }

  const id =
    raw.id === undefined || raw.id === null
      ? mintRuleId()
      : parseNonEmptyString(raw.id, `${path}.id`, MAX_RULE_ID_LENGTH);

  let name: string | undefined;
  if (raw.name !== undefined && raw.name !== null) {
    name = parseNonEmptyString(raw.name, `${path}.name`, MAX_RULE_NAME_LENGTH);
  }

  if (raw.when === undefined) {
    throw bad(`\`${path}.when\` is required.`);
  }
  const when = parseCondition(raw.when, `${path}.when`, 1);

  const tabs = parseTabs(raw.tabs, `${path}.tabs`);

  const stopOnMatch =
    raw.stopOnMatch === undefined || raw.stopOnMatch === null
      ? true
      : parseBoolean(raw.stopOnMatch, `${path}.stopOnMatch`);

  const showBadge =
    raw.showBadge === undefined || raw.showBadge === null
      ? false
      : parseBoolean(raw.showBadge, `${path}.showBadge`);

  const rule: Rule = {
    id,
    when,
    tabs,
    stopOnMatch,
    showBadge,
  };
  if (name) rule.name = name;
  return rule;
}

function parseBoolean(raw: unknown, path: string): boolean {
  if (typeof raw !== "boolean") {
    throw bad(`\`${path}\` must be a boolean.`);
  }
  return raw;
}

/**
 * Parse + validate a raw JSON blob into a `ResolutionPolicy`. Throws
 * `LinkyError({ code: "BAD_REQUEST" })` on any issue. Empty input (`null`,
 * `undefined`, `{}`, or `{ rules: [] }`) collapses to
 * `{ version: 1, rules: [] }`.
 */
export function parseResolutionPolicy(raw: unknown): ResolutionPolicy {
  if (raw === null || raw === undefined) {
    return { version: 1, rules: [] };
  }

  if (!isRecord(raw)) {
    throw bad("`resolutionPolicy` must be a JSON object.");
  }

  // Empty object is a valid "no policy" state.
  if (Object.keys(raw).length === 0) {
    return { version: 1, rules: [] };
  }

  if (raw.version !== undefined && raw.version !== 1) {
    throw bad(
      `\`resolutionPolicy.version\` must be 1 (got ${JSON.stringify(raw.version)}).`,
    );
  }

  const rawRules = raw.rules;
  if (rawRules === undefined || rawRules === null) {
    return { version: 1, rules: [] };
  }
  if (!Array.isArray(rawRules)) {
    throw bad("`resolutionPolicy.rules` must be an array.");
  }
  if (rawRules.length > MAX_RULES_PER_POLICY) {
    throw bad(
      `\`resolutionPolicy.rules\` may contain at most ${MAX_RULES_PER_POLICY} rules.`,
    );
  }

  const rules = rawRules.map((rule, index) =>
    parseRule(rule, `resolutionPolicy.rules[${index}]`),
  );

  const seenIds = new Set<string>();
  for (const rule of rules) {
    if (seenIds.has(rule.id)) {
      throw bad(
        `Duplicate rule id \`${rule.id}\`. Every rule id must be unique within a policy.`,
      );
    }
    seenIds.add(rule.id);
  }

  return { version: 1, rules };
}

/**
 * True when the policy has no meaningful effect at eval time — the caller
 * should skip viewer-context construction and serve `linkies.urls` as-is.
 */
export function isEmptyPolicy(policy: ResolutionPolicy | null | undefined): boolean {
  if (!policy) return true;
  return policy.rules.length === 0;
}

// ---------------------------------------------------------------------------
// Evaluator.
// ---------------------------------------------------------------------------

export type EvaluationResult = {
  tabs: PolicyTab[];
  matchedRuleId: string | null;
  matchedRuleName: string | null;
  showBadge: boolean;
};

/**
 * Evaluate a policy against a viewer. Pure. Never throws — malformed
 * policies fail at `parseResolutionPolicy` time.
 *
 * Semantics (matches plan §4):
 *   1. Rules evaluate top-to-bottom.
 *   2. `stopOnMatch: true` (default) — first match wins, returns that rule's
 *      tabs with match metadata.
 *   3. `stopOnMatch: false` — appends tabs and continues. If a later rule
 *      short-circuits with `stopOnMatch: true`, its match metadata wins. If
 *      no rule ever short-circuits but at least one matched, return the
 *      accumulated tabs attributed to the first-matched rule.
 *   4. No match — fall back to `fallbackUrls` (the Linky's public urls).
 *   5. Missing fields never throw; leaf ops return `false`.
 */
export function evaluatePolicy(
  policy: ResolutionPolicy | null | undefined,
  viewer: ViewerContext,
  fallbackUrls: string[],
): EvaluationResult {
  if (!policy || policy.rules.length === 0) {
    return fallbackResult(fallbackUrls);
  }

  const accumulated: PolicyTab[] = [];
  let firstMatch: Rule | null = null;

  for (const rule of policy.rules) {
    if (!evaluateCondition(rule.when, viewer)) continue;

    if (!firstMatch) firstMatch = rule;

    if (rule.stopOnMatch) {
      // Short-circuit: return the combined accumulator + this rule's tabs,
      // attributing badge/name to this rule (the decisive match).
      return dedupeTabs([...accumulated, ...rule.tabs], rule);
    }

    accumulated.push(...rule.tabs);
  }

  if (firstMatch) {
    // At least one rule matched but none short-circuited. Return the
    // accumulated tabs attributed to the first match.
    return dedupeTabs(accumulated, firstMatch);
  }

  return fallbackResult(fallbackUrls);
}

function fallbackResult(fallbackUrls: string[]): EvaluationResult {
  return {
    tabs: fallbackUrls.map((url) => ({ url })),
    matchedRuleId: null,
    matchedRuleName: null,
    showBadge: false,
  };
}

function dedupeTabs(tabs: PolicyTab[], rule: Rule): EvaluationResult {
  const seen = new Set<string>();
  const deduped: PolicyTab[] = [];
  for (const tab of tabs) {
    if (seen.has(tab.url)) continue;
    seen.add(tab.url);
    deduped.push(tab);
  }
  return {
    tabs: deduped,
    matchedRuleId: rule.id,
    matchedRuleName: rule.showBadge && rule.name ? rule.name : null,
    showBadge: rule.showBadge,
  };
}

function evaluateCondition(condition: Condition, viewer: ViewerContext): boolean {
  switch (condition.op) {
    case "always":
      return true;
    case "anonymous":
      return viewer.anonymous;
    case "signedIn":
      return !viewer.anonymous;

    case "equals": {
      const value = readSingular(viewer, condition.field);
      return value !== undefined && value === condition.value;
    }

    case "endsWith": {
      const value = readSingular(viewer, condition.field);
      return value !== undefined && value.endsWith(condition.value);
    }

    case "exists": {
      const value = readSingular(viewer, condition.field);
      return value !== undefined && value !== "";
    }

    case "in": {
      if (isSetField(condition.field)) {
        const set = readSet(viewer, condition.field);
        if (set.length === 0) return false;
        const allow = new Set(condition.value);
        return set.some((item) => allow.has(item));
      }
      const value = readSingular(viewer, condition.field);
      if (value === undefined) return false;
      return condition.value.includes(value);
    }

    case "and":
      return condition.of.every((child) => evaluateCondition(child, viewer));
    case "or":
      return condition.of.some((child) => evaluateCondition(child, viewer));
    case "not":
      return !evaluateCondition(condition.of[0], viewer);
  }
}

function readSingular(
  viewer: ViewerContext,
  field: SingularViewerField,
): string | undefined {
  const value = viewer[field];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readSet(viewer: ViewerContext, field: SetViewerField): string[] {
  const value = viewer[field];
  return Array.isArray(value) ? value.filter((v) => typeof v === "string" && v.length > 0) : [];
}

// ---------------------------------------------------------------------------
// Rule ID minting.
//
// ULID-style (timestamp prefix + random suffix) so rule ids sort by creation
// when rendered — helpful when two editors touch the same policy. Using a
// compact alphabet keeps IDs terse in the JSON editor.
//
// Generation uses `crypto.getRandomValues` which is available in both the
// Node runtime (Next.js server) and any browser. We deliberately call it
// only at parse time (never during render) so React Compiler's purity
// checks stay green.
// ---------------------------------------------------------------------------

const ULID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford Base32.

function mintRuleId(): string {
  // 10-char time component + 10-char random = 20 chars of entropy, prefixed
  // with `r_` for readability.
  const timePart = encodeUlidTime(Date.now());
  const randomPart = encodeUlidRandom();
  return `r_${timePart}${randomPart}`;
}

function encodeUlidTime(ms: number): string {
  let value = ms;
  const out: string[] = new Array(10);
  for (let i = 9; i >= 0; i -= 1) {
    const mod = value % 32;
    out[i] = ULID_ALPHABET[mod];
    value = Math.floor(value / 32);
  }
  return out.join("");
}

function encodeUlidRandom(): string {
  const bytes = new Uint8Array(10);
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let result = "";
  for (let i = 0; i < bytes.length; i += 1) {
    result += ULID_ALPHABET[bytes[i] % 32];
  }
  return result;
}
