"use client";

import { useMemo, useState } from "react";

import {
  MAX_RULES_PER_POLICY,
  MAX_TABS_PER_RULE,
  evaluatePolicy,
  parseResolutionPolicy,
  type Condition,
  type ResolutionPolicy,
  type Rule,
  type ViewerContext,
} from "@/lib/linky/policy";

// ============================================================================
// Personalize panel — identity-aware resolution editor (Sprint 2).
//
// Two modes:
//   - Structured (default): canned operator presets that cover the 90% of
//     real authoring intents (equals/endsWith/in over email / emailDomain /
//     orgSlugs, plus anonymous / signedIn viewer-state rules). Fast to use,
//     hard to author a malformed rule by accident.
//   - Advanced (toggle): raw policy JSON with inline validation via the
//     shared `parseResolutionPolicy`. For users who need compound `and` /
//     `or` / `not` conditions, or for anyone copy-pasting a policy between
//     Linkies.
//
// "Preview as" runs the pure evaluator entirely client-side. No
// round-trip, no surface to leak real viewer data. Same code path as the
// server-side `/l/[slug]` resolver — whatever preview shows is exactly
// what a viewer will see.
// ============================================================================

type PresetId =
  | "signedIn"
  | "anonymous"
  | "emailEquals"
  | "emailDomainEndsWith"
  | "emailIn"
  | "orgSlugsIn"
  | "always";

type PresetDescriptor = {
  id: PresetId;
  label: string;
  hint: string;
  // UI field layout for this preset:
  //   "none"     → no text input
  //   "string"   → one text input
  //   "list"     → comma-separated list
  kind: "none" | "string" | "list";
  placeholder?: string;
};

const PRESETS: PresetDescriptor[] = [
  {
    id: "signedIn",
    label: "Anyone signed in",
    hint: "Matches every viewer with a Linky account.",
    kind: "none",
  },
  {
    id: "anonymous",
    label: "Only anonymous viewers",
    hint: "Matches viewers without a signed-in Clerk session.",
    kind: "none",
  },
  {
    id: "emailEquals",
    label: "Email equals",
    hint: "Exact match on the viewer's primary email address.",
    kind: "string",
    placeholder: "alice@example.com",
  },
  {
    id: "emailDomainEndsWith",
    label: "Email domain ends with",
    hint: "Matches any email address under this domain (e.g. acme.com).",
    kind: "string",
    placeholder: "acme.com",
  },
  {
    id: "emailIn",
    label: "Email is one of",
    hint: "Comma-separated allow-list of email addresses.",
    kind: "list",
    placeholder: "alice@example.com, bob@example.com",
  },
  {
    id: "orgSlugsIn",
    label: "Member of any of these orgs",
    hint: "Comma-separated org slugs. Viewer's memberships are checked in full.",
    kind: "list",
    placeholder: "acme, acme-staging",
  },
  {
    id: "always",
    label: "Everyone",
    hint: "Matches every viewer. Usually the last rule.",
    kind: "none",
  },
];

// Deliberately simple — a rule's `when` either maps to exactly one preset
// (common case) or doesn't (compound conditions, rare). Round-tripping
// unrepresented rules keeps their original `when` intact.
type RuleFormState = {
  id: string;
  name: string;
  showBadge: boolean;
  stopOnMatch: boolean;
  preset: PresetId | "advanced";
  presetValue: string;
  tabs: { url: string; note: string }[];
  // Preserved verbatim when the rule doesn't map to a preset. Null once the
  // user picks a preset (we rebuild the condition from the form state).
  originalCondition: Condition | null;
};

// ---------------------------------------------------------------------------
// Detect which preset a condition matches.
// ---------------------------------------------------------------------------

function detectPreset(
  condition: Condition,
): { preset: PresetId; presetValue: string } | null {
  if (condition.op === "signedIn") return { preset: "signedIn", presetValue: "" };
  if (condition.op === "anonymous") return { preset: "anonymous", presetValue: "" };
  if (condition.op === "always") return { preset: "always", presetValue: "" };
  if (condition.op === "equals" && condition.field === "email") {
    return { preset: "emailEquals", presetValue: condition.value };
  }
  if (condition.op === "endsWith" && condition.field === "emailDomain") {
    return {
      preset: "emailDomainEndsWith",
      presetValue: condition.value,
    };
  }
  if (condition.op === "in" && condition.field === "email") {
    return { preset: "emailIn", presetValue: condition.value.join(", ") };
  }
  if (condition.op === "in" && condition.field === "orgSlugs") {
    return { preset: "orgSlugsIn", presetValue: condition.value.join(", ") };
  }
  return null;
}

function presetToCondition(
  preset: PresetId,
  rawValue: string,
): Condition | { error: string } {
  const value = rawValue.trim();
  switch (preset) {
    case "signedIn":
      return { op: "signedIn" };
    case "anonymous":
      return { op: "anonymous" };
    case "always":
      return { op: "always" };
    case "emailEquals":
      if (!value) return { error: "Enter an email address." };
      return { op: "equals", field: "email", value };
    case "emailDomainEndsWith":
      if (!value) return { error: "Enter an email domain." };
      return { op: "endsWith", field: "emailDomain", value };
    case "emailIn": {
      const list = splitList(value);
      if (list.length === 0) return { error: "Enter at least one email address." };
      return { op: "in", field: "email", value: list };
    }
    case "orgSlugsIn": {
      const list = splitList(value);
      if (list.length === 0) return { error: "Enter at least one org slug." };
      return { op: "in", field: "orgSlugs", value: list };
    }
  }
}

function splitList(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function ruleToForm(rule: Rule): RuleFormState {
  const match = detectPreset(rule.when);
  return {
    id: rule.id,
    name: rule.name ?? "",
    showBadge: rule.showBadge,
    stopOnMatch: rule.stopOnMatch,
    preset: match ? match.preset : "advanced",
    presetValue: match ? match.presetValue : "",
    tabs: rule.tabs.map((tab) => ({ url: tab.url, note: tab.note ?? "" })),
    originalCondition: match ? null : rule.when,
  };
}

function formToRule(form: RuleFormState): Rule | { error: string } {
  if (form.tabs.length === 0) {
    return { error: `Rule "${form.name || form.id}" needs at least one tab.` };
  }
  if (form.tabs.length > MAX_TABS_PER_RULE) {
    return { error: `Rule "${form.name || form.id}" exceeds ${MAX_TABS_PER_RULE} tabs.` };
  }

  let when: Condition;
  if (form.preset === "advanced") {
    if (!form.originalCondition) {
      return {
        error: `Rule "${form.name || form.id}" has no condition. Pick one from the dropdown or switch to Advanced mode.`,
      };
    }
    when = form.originalCondition;
  } else {
    const built = presetToCondition(form.preset, form.presetValue);
    if ("error" in built) {
      return { error: `Rule "${form.name || form.id}": ${built.error}` };
    }
    when = built;
  }

  const tabs = form.tabs.map((tab) => {
    const url = tab.url.trim();
    const note = tab.note.trim();
    return note ? { url, note } : { url };
  });

  const rule: Rule = {
    id: form.id,
    when,
    tabs,
    stopOnMatch: form.stopOnMatch,
    showBadge: form.showBadge,
  };
  if (form.name.trim()) rule.name = form.name.trim();
  return rule;
}

// ---------------------------------------------------------------------------
// Preview-as form.
// ---------------------------------------------------------------------------

type PreviewState = {
  signedIn: boolean;
  email: string;
  orgSlugs: string;
  githubLogin: string;
};

function previewToViewer(state: PreviewState): ViewerContext {
  if (!state.signedIn) {
    return { anonymous: true, orgIds: [], orgSlugs: [] };
  }
  const email = state.email.trim().toLowerCase() || undefined;
  const emailDomain = email ? email.split("@")[1] : undefined;
  return {
    anonymous: false,
    userId: "preview_user",
    email,
    emailDomain,
    githubLogin: state.githubLogin.trim() || undefined,
    orgIds: [],
    orgSlugs: splitList(state.orgSlugs),
  };
}

// ---------------------------------------------------------------------------
// Component.
// ---------------------------------------------------------------------------

type Props = {
  // The current persisted policy. Empty-policy inputs collapse to a clean
  // "no rules yet" state so the panel is always authorable.
  initialPolicy: ResolutionPolicy;
  // Live snapshot of the URL list from the parent — used as the fallback
  // in Preview-as so authors see exactly what an unmatched viewer would get.
  fallbackUrls: string[];
  // Called with the parsed policy (or `null` to clear) whenever the user
  // clicks "Apply" in either mode. The parent integrates this into its
  // save flow (alongside urls/metadata/title/description in the single
  // PATCH request).
  onChange: (policy: ResolutionPolicy | null) => void;
  // True when the parent is mid-save. The panel disables buttons to avoid
  // double-submits.
  disabled?: boolean;
};

export function PersonalizePanel({
  initialPolicy,
  fallbackUrls,
  onChange,
  disabled = false,
}: Props) {
  const [mode, setMode] = useState<"structured" | "advanced">("structured");
  const [rules, setRules] = useState<RuleFormState[]>(() =>
    initialPolicy.rules.map(ruleToForm),
  );
  const [advancedJson, setAdvancedJson] = useState<string>(() =>
    JSON.stringify(initialPolicy, null, 2),
  );
  const [error, setError] = useState<string | null>(null);
  const [panelSuccess, setPanelSuccess] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState>({
    signedIn: true,
    email: "alice@example.com",
    orgSlugs: "",
    githubLogin: "",
  });

  // Derive the policy-under-edit from whichever mode is active. This is
  // what Preview-as runs against, so the user sees live feedback as they
  // type.
  const inFlightPolicy = useMemo<ResolutionPolicy | null>(() => {
    try {
      if (mode === "advanced") {
        return parseResolutionPolicy(JSON.parse(advancedJson));
      }
      const built: Rule[] = [];
      for (const form of rules) {
        const result = formToRule(form);
        if ("error" in result) return null;
        built.push(result);
      }
      return { version: 1, rules: built };
    } catch {
      return null;
    }
  }, [mode, advancedJson, rules]);

  const previewResult = useMemo(() => {
    if (!inFlightPolicy) return null;
    return evaluatePolicy(inFlightPolicy, previewToViewer(preview), fallbackUrls);
  }, [inFlightPolicy, preview, fallbackUrls]);

  // ------------------------------------------------------------------
  // Structured-mode handlers.
  // ------------------------------------------------------------------

  const handleAddRule = () => {
    if (rules.length >= MAX_RULES_PER_POLICY) return;
    setRules((prev) => [
      ...prev,
      {
        id: `r_draft_${prev.length + 1}_${Date.now().toString(36)}`,
        name: "",
        showBadge: false,
        stopOnMatch: true,
        preset: "signedIn",
        presetValue: "",
        // New rules default to "the same tabs as the public bundle". Most
        // authors want "public + a couple extras" — starting empty would
        // silently change the viewer experience (fewer tabs than they expected)
        // the moment any rule matched. Editor still lets them untick any of
        // these before saving.
        tabs: fallbackUrls.length > 0
          ? fallbackUrls.map((url) => ({ url, note: "" }))
          : [{ url: "", note: "" }],
        originalCondition: null,
      },
    ]);
  };

  const handleRemoveRule = (index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMoveRule = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= rules.length) return;
    setRules((prev) => {
      const copy = prev.slice();
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  };

  const updateRule = (index: number, patch: Partial<RuleFormState>) => {
    setRules((prev) =>
      prev.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)),
    );
  };

  const updateRuleTab = (
    ruleIndex: number,
    tabIndex: number,
    patch: Partial<{ url: string; note: string }>,
  ) => {
    setRules((prev) =>
      prev.map((rule, i) => {
        if (i !== ruleIndex) return rule;
        return {
          ...rule,
          tabs: rule.tabs.map((tab, j) =>
            j === tabIndex ? { ...tab, ...patch } : tab,
          ),
        };
      }),
    );
  };

  const addTabToRule = (ruleIndex: number) => {
    setRules((prev) =>
      prev.map((rule, i) => {
        if (i !== ruleIndex) return rule;
        if (rule.tabs.length >= MAX_TABS_PER_RULE) return rule;
        return { ...rule, tabs: [...rule.tabs, { url: "", note: "" }] };
      }),
    );
  };

  const removeTabFromRule = (ruleIndex: number, tabIndex: number) => {
    setRules((prev) =>
      prev.map((rule, i) => {
        if (i !== ruleIndex) return rule;
        if (rule.tabs.length <= 1) return rule;
        return {
          ...rule,
          tabs: rule.tabs.filter((_, j) => j !== tabIndex),
        };
      }),
    );
  };

  // ------------------------------------------------------------------
  // Apply / clear.
  // ------------------------------------------------------------------

  const handleApply = () => {
    setError(null);
    setPanelSuccess(null);
    try {
      let policy: ResolutionPolicy;
      if (mode === "advanced") {
        const parsed = JSON.parse(advancedJson);
        policy = parseResolutionPolicy(parsed);
      } else {
        const built: Rule[] = [];
        for (const form of rules) {
          const result = formToRule(form);
          if ("error" in result) {
            setError(result.error);
            return;
          }
          built.push(result);
        }
        policy = parseResolutionPolicy({ version: 1, rules: built });
      }
      onChange(policy.rules.length === 0 ? null : policy);
      setPanelSuccess(
        policy.rules.length === 0
          ? "Policy cleared. Save changes to apply."
          : `${policy.rules.length} rule${policy.rules.length === 1 ? "" : "s"} staged. Save changes to apply.`,
      );
      if (mode === "advanced") {
        setRules(policy.rules.map(ruleToForm));
      } else {
        setAdvancedJson(JSON.stringify(policy, null, 2));
      }
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Policy JSON is invalid.";
      setError(message);
    }
  };

  const handleClear = () => {
    setError(null);
    setRules([]);
    setAdvancedJson(JSON.stringify({ version: 1, rules: [] }, null, 2));
    onChange(null);
    setPanelSuccess("Policy cleared. Save changes to apply.");
  };

  // ------------------------------------------------------------------
  // Render.
  // ------------------------------------------------------------------

  return (
    <section className="terminal-card space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="terminal-label mb-1">Personalize</p>
          <p className="terminal-muted text-xs sm:text-sm">
            Serve different tabs to different viewers. Rules evaluate top-to-bottom.
            Unmatched viewers get the public URL list above.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode("structured")}
            className={`terminal-secondary px-3 py-1.5 text-xs ${mode === "structured" ? "text-foreground" : ""}`}
            disabled={disabled}
          >
            Structured
          </button>
          <button
            type="button"
            onClick={() => setMode("advanced")}
            className={`terminal-secondary px-3 py-1.5 text-xs ${mode === "advanced" ? "text-foreground" : ""}`}
            disabled={disabled}
          >
            Advanced (JSON)
          </button>
        </div>
      </div>

      {mode === "structured" ? (
        <StructuredEditor
          rules={rules}
          disabled={disabled}
          fallbackUrls={fallbackUrls}
          onAddRule={handleAddRule}
          onRemoveRule={handleRemoveRule}
          onMoveRule={handleMoveRule}
          onUpdateRule={updateRule}
          onUpdateRuleTab={updateRuleTab}
          onAddTabToRule={addTabToRule}
          onRemoveTabFromRule={removeTabFromRule}
          onReplaceRuleTabs={(ruleIndex, tabs) =>
            setRules((prev) =>
              prev.map((rule, i) =>
                i === ruleIndex ? { ...rule, tabs } : rule,
              ),
            )
          }
        />
      ) : (
        <AdvancedEditor
          json={advancedJson}
          onChange={setAdvancedJson}
          disabled={disabled}
        />
      )}

      <PreviewAs
        preview={preview}
        onChange={setPreview}
        result={previewResult}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleApply}
          disabled={disabled}
          className="terminal-action px-4 py-2 text-xs sm:text-sm"
        >
          Apply to draft
        </button>
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled || (rules.length === 0 && mode === "structured")}
          className="terminal-secondary px-4 py-2 text-xs sm:text-sm"
        >
          Clear policy
        </button>
      </div>

      {error ? (
        <p className="text-xs" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      ) : null}
      {panelSuccess ? (
        <p className="terminal-muted text-xs">{panelSuccess}</p>
      ) : null}
    </section>
  );
}

// ===========================================================================
// Sub-components.
// ===========================================================================

function StructuredEditor({
  rules,
  disabled,
  fallbackUrls,
  onAddRule,
  onRemoveRule,
  onMoveRule,
  onUpdateRule,
  onUpdateRuleTab,
  onAddTabToRule,
  onRemoveTabFromRule,
  onReplaceRuleTabs,
}: {
  rules: RuleFormState[];
  disabled: boolean;
  fallbackUrls: string[];
  onAddRule: () => void;
  onRemoveRule: (index: number) => void;
  onMoveRule: (index: number, direction: -1 | 1) => void;
  onUpdateRule: (index: number, patch: Partial<RuleFormState>) => void;
  onUpdateRuleTab: (
    ruleIndex: number,
    tabIndex: number,
    patch: Partial<{ url: string; note: string }>,
  ) => void;
  onAddTabToRule: (ruleIndex: number) => void;
  onRemoveTabFromRule: (ruleIndex: number, tabIndex: number) => void;
  onReplaceRuleTabs: (
    ruleIndex: number,
    tabs: { url: string; note: string }[],
  ) => void;
}) {
  return (
    <div className="space-y-4">
      {rules.length === 0 ? (
        <p className="terminal-muted text-xs">
          No rules yet. Add one to start routing viewers to tailored tabs.
        </p>
      ) : (
        <ol className="space-y-4">
          {rules.map((rule, ruleIndex) => (
            <li
              key={rule.id}
              className="border-t border-[var(--panel-border)] pt-4"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="terminal-label">
                  Rule {String(ruleIndex + 1).padStart(2, "0")}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onMoveRule(ruleIndex, -1)}
                    disabled={disabled || ruleIndex === 0}
                    className="terminal-secondary px-2 py-1 text-xs"
                    title="Move up"
                    aria-label="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveRule(ruleIndex, 1)}
                    disabled={disabled || ruleIndex === rules.length - 1}
                    className="terminal-secondary px-2 py-1 text-xs"
                    title="Move down"
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveRule(ruleIndex)}
                    disabled={disabled}
                    className="terminal-secondary px-2 py-1 text-xs"
                    title="Remove rule"
                    aria-label="Remove rule"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input
                    type="text"
                    value={rule.name}
                    onChange={(event) =>
                      onUpdateRule(ruleIndex, { name: event.target.value })
                    }
                    placeholder="Rule name (internal, e.g. “Engineering team”)"
                    maxLength={120}
                    className="terminal-input text-xs sm:text-sm"
                    disabled={disabled}
                  />
                  <label className="terminal-muted flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={rule.showBadge}
                      onChange={(event) =>
                        onUpdateRule(ruleIndex, {
                          showBadge: event.target.checked,
                        })
                      }
                      disabled={disabled}
                    />
                    Show name in viewer banner
                  </label>
                </div>

                <div className="grid gap-2 sm:grid-cols-[1fr_2fr]">
                  <select
                    value={rule.preset}
                    onChange={(event) =>
                      onUpdateRule(ruleIndex, {
                        preset: event.target.value as
                          | PresetId
                          | "advanced",
                        presetValue: "",
                      })
                    }
                    disabled={disabled || rule.preset === "advanced"}
                    className="terminal-input text-xs sm:text-sm"
                  >
                    {PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                    {rule.preset === "advanced" ? (
                      <option value="advanced">Advanced (JSON only)</option>
                    ) : null}
                  </select>
                  <PresetValueInput
                    rule={rule}
                    disabled={disabled}
                    onChange={(value) =>
                      onUpdateRule(ruleIndex, { presetValue: value })
                    }
                  />
                </div>

                {rule.preset === "advanced" ? (
                  <p className="terminal-muted text-xs">
                    This rule uses a compound condition and can only be edited in
                    Advanced (JSON) mode.
                  </p>
                ) : null}

                <RuleTabsEditor
                  rule={rule}
                  ruleIndex={ruleIndex}
                  disabled={disabled}
                  fallbackUrls={fallbackUrls}
                  onUpdateRuleTab={onUpdateRuleTab}
                  onAddTabToRule={onAddTabToRule}
                  onRemoveTabFromRule={onRemoveTabFromRule}
                  onReplaceRuleTabs={onReplaceRuleTabs}
                />

                <label className="terminal-muted flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={rule.stopOnMatch}
                    onChange={(event) =>
                      onUpdateRule(ruleIndex, {
                        stopOnMatch: event.target.checked,
                      })
                    }
                    disabled={disabled}
                  />
                  First match wins (uncheck to append tabs and continue)
                </label>
              </div>
            </li>
          ))}
        </ol>
      )}

      <button
        type="button"
        onClick={onAddRule}
        disabled={disabled || rules.length >= MAX_RULES_PER_POLICY}
        className="terminal-secondary px-3 py-1.5 text-xs sm:text-sm"
      >
        + Add rule
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RuleTabsEditor — the per-rule "Tabs this rule serves" section.
//
// Two sub-lists, one data shape.
//   1. "From the public URLs" — a checkbox row per entry in `fallbackUrls`.
//      Ticked = the rule serves that URL; the canonical URL is stored in
//      `rule.tabs[]` so URL edits in the public bundle don't silently desync.
//   2. "Rule-private extras" — free-form URL + note rows for URLs that are
//      NOT in the public list. Lets authors add tabs that belong to this
//      cohort only (personal dashboards, internal wikis, one-off drafts).
//
// The stored `tabs[]` is still a single flat array — the split above is
// purely a rendering concern. That means reordering, de-duping, and the
// MAX_TABS_PER_RULE cap behave identically to the flat-list days.
// ---------------------------------------------------------------------------

function RuleTabsEditor({
  rule,
  ruleIndex,
  disabled,
  fallbackUrls,
  onUpdateRuleTab,
  onAddTabToRule,
  onRemoveTabFromRule,
  onReplaceRuleTabs,
}: {
  rule: RuleFormState;
  ruleIndex: number;
  disabled: boolean;
  fallbackUrls: string[];
  onUpdateRuleTab: (
    ruleIndex: number,
    tabIndex: number,
    patch: Partial<{ url: string; note: string }>,
  ) => void;
  onAddTabToRule: (ruleIndex: number) => void;
  onRemoveTabFromRule: (ruleIndex: number, tabIndex: number) => void;
  onReplaceRuleTabs: (
    ruleIndex: number,
    tabs: { url: string; note: string }[],
  ) => void;
}) {
  const publicSet = useMemo(() => new Set(fallbackUrls), [fallbackUrls]);

  // The `extras` are whatever rule tabs reference a URL that isn't in the
  // current public list. Everything else is considered "picked from public."
  // We can't rely on tab position for this check because the public URL set
  // is shared state — a URL moving between public and extras is driven by
  // edits to `linkies.urls`, not by the Personalize panel.
  const extras = rule.tabs
    .map((tab, tabIndex) => ({ tab, tabIndex }))
    .filter(({ tab }) => !publicSet.has(tab.url.trim()));

  const toggleFallback = (url: string, checked: boolean) => {
    const trimmed = url.trim();
    if (checked) {
      if (rule.tabs.length >= MAX_TABS_PER_RULE) return;
      // Preserve any existing tabs + append the newly-ticked public URL with
      // an empty note. If the URL happened to already be in `tabs[]` (rare;
      // would mean a duplicate) we no-op.
      if (rule.tabs.some((tab) => tab.url.trim() === trimmed)) return;
      onReplaceRuleTabs(ruleIndex, [
        ...rule.tabs,
        { url: trimmed, note: "" },
      ]);
    } else {
      onReplaceRuleTabs(
        ruleIndex,
        rule.tabs.filter((tab) => tab.url.trim() !== trimmed),
      );
    }
  };

  const updatePublicNote = (url: string, note: string) => {
    const trimmed = url.trim();
    onReplaceRuleTabs(
      ruleIndex,
      rule.tabs.map((tab) =>
        tab.url.trim() === trimmed ? { ...tab, note } : tab,
      ),
    );
  };

  const notesByPublicUrl = new Map<string, string>();
  rule.tabs.forEach((tab) => {
    const trimmed = tab.url.trim();
    if (publicSet.has(trimmed)) {
      notesByPublicUrl.set(trimmed, tab.note ?? "");
    }
  });

  const tickedFallbackCount = fallbackUrls.filter((url) =>
    notesByPublicUrl.has(url),
  ).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="terminal-label">Tabs this rule serves ({rule.tabs.length})</p>
        <p className="terminal-muted text-xs">
          Pick from the public URLs below, or add rule-private extras.
        </p>
      </div>

      {fallbackUrls.length > 0 ? (
        <div className="space-y-2">
          <p className="terminal-muted text-xs">
            From the public URLs ({tickedFallbackCount}/{fallbackUrls.length}):
          </p>
          <ul className="space-y-2">
            {fallbackUrls.map((url, index) => {
              const checked = notesByPublicUrl.has(url);
              const note = notesByPublicUrl.get(url) ?? "";
              return (
                <li
                  key={`${ruleIndex}-public-${index}-${url}`}
                  className="grid gap-2 sm:grid-cols-[auto_1fr_1fr]"
                >
                  <label className="terminal-muted flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) =>
                        toggleFallback(url, event.target.checked)
                      }
                      disabled={
                        disabled ||
                        (!checked && rule.tabs.length >= MAX_TABS_PER_RULE)
                      }
                    />
                    <span className="text-foreground">#{String(index + 1).padStart(2, "0")}</span>
                  </label>
                  <span
                    className="truncate self-center text-xs"
                    title={url}
                  >
                    {url}
                  </span>
                  <input
                    type="text"
                    value={note}
                    onChange={(event) => updatePublicNote(url, event.target.value)}
                    placeholder="Note (optional)"
                    maxLength={500}
                    disabled={disabled || !checked}
                    className="terminal-input text-xs sm:text-sm"
                  />
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <p className="terminal-muted text-xs">
          No public URLs yet. Add URLs above first, or define rule-private tabs below.
        </p>
      )}

      <div className="space-y-2">
        <p className="terminal-muted text-xs">
          Rule-private extras ({extras.length}):
        </p>
        {extras.length === 0 ? (
          <p className="terminal-muted text-xs italic">
            None — this rule serves only public URLs.
          </p>
        ) : (
          <ul className="space-y-2">
            {extras.map(({ tab, tabIndex }) => (
              <li
                key={`${ruleIndex}-extra-${tabIndex}`}
                className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]"
              >
                <input
                  type="url"
                  value={tab.url}
                  onChange={(event) =>
                    onUpdateRuleTab(ruleIndex, tabIndex, {
                      url: event.target.value,
                    })
                  }
                  placeholder="https://example.com"
                  className="terminal-input text-xs sm:text-sm"
                  disabled={disabled}
                />
                <input
                  type="text"
                  value={tab.note}
                  onChange={(event) =>
                    onUpdateRuleTab(ruleIndex, tabIndex, {
                      note: event.target.value,
                    })
                  }
                  placeholder="Note (optional)"
                  maxLength={500}
                  className="terminal-input text-xs sm:text-sm"
                  disabled={disabled}
                />
                <button
                  type="button"
                  onClick={() => onRemoveTabFromRule(ruleIndex, tabIndex)}
                  disabled={disabled}
                  className="terminal-secondary px-2 py-1 text-xs"
                  title="Remove extra URL"
                  aria-label="Remove extra URL"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={() => onAddTabToRule(ruleIndex)}
          disabled={disabled || rule.tabs.length >= MAX_TABS_PER_RULE}
          className="terminal-secondary px-3 py-1 text-xs"
        >
          + Add extra URL
        </button>
      </div>
    </div>
  );
}

function PresetValueInput({
  rule,
  disabled,
  onChange,
}: {
  rule: RuleFormState;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  if (rule.preset === "advanced") {
    return (
      <input
        type="text"
        value="(edit in Advanced JSON)"
        disabled
        className="terminal-input text-xs sm:text-sm"
      />
    );
  }
  const descriptor = PRESETS.find((p) => p.id === rule.preset)!;
  if (descriptor.kind === "none") {
    return (
      <p className="terminal-muted self-center text-xs">{descriptor.hint}</p>
    );
  }
  return (
    <input
      type="text"
      value={rule.presetValue}
      onChange={(event) => onChange(event.target.value)}
      placeholder={descriptor.placeholder}
      className="terminal-input text-xs sm:text-sm"
      disabled={disabled}
    />
  );
}

function AdvancedEditor({
  json,
  onChange,
  disabled,
}: {
  json: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className="terminal-label block">Policy JSON</label>
      <textarea
        value={json}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        spellCheck={false}
        className="terminal-input min-h-[14rem] w-full resize-y font-mono text-xs"
      />
      <p className="terminal-muted text-xs">
        Shape: <code>{"{ version: 1, rules: [...] }"}</code>. Validated on Apply.
        Compound conditions (<code>and</code>, <code>or</code>, <code>not</code>)
        live here.
      </p>
    </div>
  );
}

function PreviewAs({
  preview,
  onChange,
  result,
}: {
  preview: PreviewState;
  onChange: (state: PreviewState) => void;
  result: ReturnType<typeof evaluatePolicy> | null;
}) {
  return (
    <div className="site-inline-callout space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="terminal-label">Preview as</p>
        <p className="terminal-muted text-xs">
          Runs the same evaluator used at <code>/l/[slug]</code>.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="terminal-muted flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={preview.signedIn}
            onChange={(event) =>
              onChange({ ...preview, signedIn: event.target.checked })
            }
          />
          Signed-in viewer
        </label>
        <input
          type="email"
          value={preview.email}
          onChange={(event) =>
            onChange({ ...preview, email: event.target.value })
          }
          placeholder="alice@example.com"
          className="terminal-input text-xs"
          disabled={!preview.signedIn}
        />
        <input
          type="text"
          value={preview.orgSlugs}
          onChange={(event) =>
            onChange({ ...preview, orgSlugs: event.target.value })
          }
          placeholder="org slugs (comma-separated)"
          className="terminal-input text-xs"
          disabled={!preview.signedIn}
        />
        <input
          type="text"
          value={preview.githubLogin}
          onChange={(event) =>
            onChange({ ...preview, githubLogin: event.target.value })
          }
          placeholder="github login (optional)"
          className="terminal-input text-xs"
          disabled={!preview.signedIn}
        />
      </div>

      {result ? (
        <div className="space-y-1">
          <p className="terminal-muted text-xs">
            {result.matchedRuleId ? (
              <>
                Matched rule:{" "}
                <span className="text-foreground">
                  {result.matchedRuleName || result.matchedRuleId}
                </span>
              </>
            ) : (
              <>No rule matched — serving the public fallback URLs.</>
            )}
          </p>
          <ul className="site-divider-list">
            {result.tabs.map((tab, index) => (
              <li
                key={`${index}-${tab.url}`}
                className="site-divider-item text-xs"
              >
                <span className="terminal-chip mr-2 shrink-0">{index + 1}</span>
                <span className="truncate">{tab.url}</span>
                {tab.note ? (
                  <span className="terminal-muted ml-2">— {tab.note}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="terminal-muted text-xs">
          Policy has errors; fix the editor above to see a preview.
        </p>
      )}
    </div>
  );
}
