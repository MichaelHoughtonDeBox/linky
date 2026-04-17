import { describe, expect, it } from "vitest";

import { LinkyError } from "./errors";
import {
  MAX_CONDITION_DEPTH,
  MAX_RULES_PER_POLICY,
  MAX_TABS_PER_RULE,
  type Condition,
  type ResolutionPolicy,
  type Rule,
  type ViewerContext,
  evaluatePolicy,
  isEmptyPolicy,
  parseResolutionPolicy,
} from "./policy";

// ---------------------------------------------------------------------------
// Viewer context helpers.
// Synthesize viewers directly — the DSL contract is decoupled from Clerk.
// ---------------------------------------------------------------------------

const anonymousViewer: ViewerContext = {
  anonymous: true,
  orgIds: [],
  orgSlugs: [],
};

function signedIn(overrides: Partial<ViewerContext> = {}): ViewerContext {
  return {
    anonymous: false,
    email: "alice@example.com",
    emailDomain: "example.com",
    userId: "user_abc",
    orgIds: [],
    orgSlugs: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// parseResolutionPolicy — shape validation
// ---------------------------------------------------------------------------

describe("parseResolutionPolicy — empty inputs short-circuit to v1 + []", () => {
  it("collapses null / undefined / {} / { rules: [] } to an empty v1 policy", () => {
    for (const input of [null, undefined, {}, { version: 1, rules: [] }]) {
      const result = parseResolutionPolicy(input);
      expect(result).toEqual({ version: 1, rules: [] });
      expect(isEmptyPolicy(result)).toBe(true);
    }
  });

  it("rejects non-object inputs", () => {
    expect(() => parseResolutionPolicy("nope")).toThrow(LinkyError);
    expect(() => parseResolutionPolicy(42)).toThrow(LinkyError);
    expect(() => parseResolutionPolicy([])).toThrow(LinkyError);
  });

  it("rejects unsupported version numbers", () => {
    expect(() => parseResolutionPolicy({ version: 2, rules: [] })).toThrow(
      /must be 1/,
    );
  });

  it("rejects non-array rules", () => {
    expect(() => parseResolutionPolicy({ rules: "lots" })).toThrow(/must be an array/);
  });

  it("enforces MAX_RULES_PER_POLICY", () => {
    const rules = Array.from({ length: MAX_RULES_PER_POLICY + 1 }, (_, i) => ({
      when: { op: "always" },
      tabs: [{ url: `https://example.com/${i}` }],
    }));
    expect(() => parseResolutionPolicy({ rules })).toThrow(
      new RegExp(`at most ${MAX_RULES_PER_POLICY} rules`),
    );
  });

  it("mints a ULID-style id when a rule omits it", () => {
    const result = parseResolutionPolicy({
      rules: [
        {
          when: { op: "always" },
          tabs: [{ url: "https://example.com" }],
        },
      ],
    });
    expect(result.rules[0].id).toMatch(/^r_[0-9A-HJKMNP-TV-Z]{20}$/);
  });

  it("preserves a caller-supplied id", () => {
    const result = parseResolutionPolicy({
      rules: [
        {
          id: "r_CUSTOM",
          when: { op: "always" },
          tabs: [{ url: "https://example.com" }],
        },
      ],
    });
    expect(result.rules[0].id).toBe("r_CUSTOM");
  });

  it("rejects duplicate rule ids", () => {
    expect(() =>
      parseResolutionPolicy({
        rules: [
          {
            id: "r_X",
            when: { op: "always" },
            tabs: [{ url: "https://a.com" }],
          },
          {
            id: "r_X",
            when: { op: "always" },
            tabs: [{ url: "https://b.com" }],
          },
        ],
      }),
    ).toThrow(/Duplicate rule id/);
  });
});

describe("parseResolutionPolicy — rule shape", () => {
  it("defaults stopOnMatch to true and showBadge to false", () => {
    const [rule] = parseResolutionPolicy({
      rules: [
        {
          when: { op: "always" },
          tabs: [{ url: "https://example.com" }],
        },
      ],
    }).rules;
    expect(rule.stopOnMatch).toBe(true);
    expect(rule.showBadge).toBe(false);
    expect(rule.name).toBeUndefined();
  });

  it("requires when and tabs", () => {
    expect(() =>
      parseResolutionPolicy({ rules: [{ tabs: [{ url: "https://a.com" }] }] }),
    ).toThrow(/when/);
    expect(() =>
      parseResolutionPolicy({ rules: [{ when: { op: "always" } }] }),
    ).toThrow(/tabs/);
  });

  it("routes tab URLs through normalizeUrlList for parity with linkies.urls", () => {
    expect(() =>
      parseResolutionPolicy({
        rules: [
          {
            when: { op: "always" },
            tabs: [{ url: "javascript:alert(1)" }],
          },
        ],
      }),
    ).toThrow(/http:\/\/ or https:\/\//);
  });

  it("enforces MAX_TABS_PER_RULE", () => {
    const tabs = Array.from({ length: MAX_TABS_PER_RULE + 1 }, (_, i) => ({
      url: `https://example.com/${i}`,
    }));
    expect(() =>
      parseResolutionPolicy({
        rules: [{ when: { op: "always" }, tabs }],
      }),
    ).toThrow(new RegExp(`at most ${MAX_TABS_PER_RULE} tabs`));
  });

  it("preserves per-tab notes after URL dedupe", () => {
    const result = parseResolutionPolicy({
      rules: [
        {
          when: { op: "always" },
          tabs: [
            { url: "https://example.com/", note: "first" },
            { url: "https://example.com/", note: "duplicate — ignored" },
          ],
        },
      ],
    });
    expect(result.rules[0].tabs).toEqual([
      { url: "https://example.com/", note: "first" },
    ]);
  });
});

// ---------------------------------------------------------------------------
// parseResolutionPolicy — operator × field compatibility (plan §3)
// ---------------------------------------------------------------------------

describe("parseResolutionPolicy — operator × field compatibility", () => {
  it.each(["equals", "endsWith", "exists"] as const)(
    "rejects %s against set-valued field orgSlugs at parse time",
    (op) => {
      const when =
        op === "exists"
          ? { op, field: "orgSlugs" }
          : { op, field: "orgSlugs", value: "acme" };
      expect(() =>
        parseResolutionPolicy({
          rules: [
            {
              when,
              tabs: [{ url: "https://example.com" }],
            },
          ],
        }),
      ).toThrow(/set-valued field/);
    },
  );

  it("accepts in with a singular field (email ∈ allow-list)", () => {
    const policy = parseResolutionPolicy({
      rules: [
        {
          when: {
            op: "in",
            field: "email",
            value: ["alice@example.com", "bob@example.com"],
          },
          tabs: [{ url: "https://example.com/a" }],
        },
      ],
    });
    expect(policy.rules[0].when).toMatchObject({ op: "in", field: "email" });
  });

  it("accepts in with a set-valued field (orgSlugs ∩ allow-list)", () => {
    const policy = parseResolutionPolicy({
      rules: [
        {
          when: { op: "in", field: "orgSlugs", value: ["acme"] },
          tabs: [{ url: "https://example.com/a" }],
        },
      ],
    });
    expect(policy.rules[0].when).toMatchObject({
      op: "in",
      field: "orgSlugs",
      value: ["acme"],
    });
  });

  it("rejects in with an empty value array", () => {
    expect(() =>
      parseResolutionPolicy({
        rules: [
          {
            when: { op: "in", field: "email", value: [] },
            tabs: [{ url: "https://example.com" }],
          },
        ],
      }),
    ).toThrow(/at least one string/);
  });

  it("rejects unknown fields", () => {
    expect(() =>
      parseResolutionPolicy({
        rules: [
          {
            when: { op: "equals", field: "favoriteColor", value: "green" },
            tabs: [{ url: "https://example.com" }],
          },
        ],
      }),
    ).toThrow(/must be one of/);
  });
});

describe("parseResolutionPolicy — depth limit", () => {
  it(`rejects conditions nested deeper than ${MAX_CONDITION_DEPTH}`, () => {
    let when: unknown = { op: "always" };
    for (let i = 0; i < MAX_CONDITION_DEPTH + 1; i += 1) {
      when = { op: "and", of: [when] };
    }
    expect(() =>
      parseResolutionPolicy({
        rules: [{ when, tabs: [{ url: "https://example.com" }] }],
      }),
    ).toThrow(/deeper than/);
  });

  it("requires not to have exactly one child", () => {
    expect(() =>
      parseResolutionPolicy({
        rules: [
          {
            when: { op: "not", of: [{ op: "always" }, { op: "always" }] },
            tabs: [{ url: "https://example.com" }],
          },
        ],
      }),
    ).toThrow(/exactly one condition/);
  });
});

// ---------------------------------------------------------------------------
// evaluatePolicy — viewer-state conditions
// ---------------------------------------------------------------------------

describe("evaluatePolicy — viewer-state operators", () => {
  it("always matches everyone", () => {
    const policy = makePolicy([
      { when: { op: "always" }, tabs: [{ url: "https://a.com/" }] },
    ]);
    expect(evaluatePolicy(policy, anonymousViewer, []).tabs).toEqual([
      { url: "https://a.com/" },
    ]);
    expect(evaluatePolicy(policy, signedIn(), []).tabs).toEqual([
      { url: "https://a.com/" },
    ]);
  });

  it("anonymous matches only unauthenticated viewers", () => {
    const policy = makePolicy([
      { when: { op: "anonymous" }, tabs: [{ url: "https://anon.com/" }] },
    ]);
    expect(evaluatePolicy(policy, anonymousViewer, ["https://fallback.com/"]).matchedRuleId)
      .not.toBeNull();
    expect(
      evaluatePolicy(policy, signedIn(), ["https://fallback.com/"]).matchedRuleId,
    ).toBeNull();
  });

  it("signedIn matches only authenticated viewers", () => {
    const policy = makePolicy([
      { when: { op: "signedIn" }, tabs: [{ url: "https://members.com/" }] },
    ]);
    expect(evaluatePolicy(policy, signedIn(), []).matchedRuleId).not.toBeNull();
    expect(evaluatePolicy(policy, anonymousViewer, []).matchedRuleId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// evaluatePolicy — leaf conditions + missing fields
// ---------------------------------------------------------------------------

describe("evaluatePolicy — leaf operators", () => {
  it("equals returns false (does not throw) for missing fields on anonymous viewers", () => {
    const policy = makePolicy([
      {
        when: { op: "equals", field: "email", value: "alice@example.com" },
        tabs: [{ url: "https://alice.com/" }],
      },
    ]);
    expect(() => evaluatePolicy(policy, anonymousViewer, [])).not.toThrow();
    expect(evaluatePolicy(policy, anonymousViewer, ["https://pub.com/"]).matchedRuleId)
      .toBeNull();
  });

  it("equals matches exact singular values", () => {
    const policy = makePolicy([
      {
        when: { op: "equals", field: "email", value: "alice@example.com" },
        tabs: [{ url: "https://alice.com/" }],
      },
    ]);
    expect(
      evaluatePolicy(policy, signedIn({ email: "alice@example.com" }), [])
        .matchedRuleId,
    ).not.toBeNull();
    expect(
      evaluatePolicy(policy, signedIn({ email: "bob@example.com" }), [])
        .matchedRuleId,
    ).toBeNull();
  });

  it("endsWith matches suffixes on emailDomain", () => {
    const policy = makePolicy([
      {
        when: { op: "endsWith", field: "emailDomain", value: "acme.com" },
        tabs: [{ url: "https://acme.internal/" }],
      },
    ]);
    expect(
      evaluatePolicy(policy, signedIn({ emailDomain: "acme.com" }), [])
        .matchedRuleId,
    ).not.toBeNull();
    expect(
      evaluatePolicy(policy, signedIn({ emailDomain: "eu.acme.com" }), [])
        .matchedRuleId,
    ).not.toBeNull();
    expect(
      evaluatePolicy(policy, signedIn({ emailDomain: "example.com" }), [])
        .matchedRuleId,
    ).toBeNull();
  });

  it("exists is true only when the singular field is present and non-empty", () => {
    const policy = makePolicy([
      {
        when: { op: "exists", field: "githubLogin" },
        tabs: [{ url: "https://gh.com/" }],
      },
    ]);
    expect(
      evaluatePolicy(policy, signedIn({ githubLogin: "alice" }), [])
        .matchedRuleId,
    ).not.toBeNull();
    expect(evaluatePolicy(policy, signedIn({ githubLogin: "" }), []).matchedRuleId)
      .toBeNull();
    expect(evaluatePolicy(policy, signedIn(), []).matchedRuleId).toBeNull();
  });

  it("in on singular field = set membership over value[]", () => {
    const policy = makePolicy([
      {
        when: {
          op: "in",
          field: "email",
          value: ["alice@example.com", "bob@example.com"],
        },
        tabs: [{ url: "https://team.com/" }],
      },
    ]);
    expect(
      evaluatePolicy(policy, signedIn({ email: "alice@example.com" }), [])
        .matchedRuleId,
    ).not.toBeNull();
    expect(
      evaluatePolicy(policy, signedIn({ email: "carol@example.com" }), [])
        .matchedRuleId,
    ).toBeNull();
  });

  it("in on set-valued field = any-intersection of viewer set and value[]", () => {
    const policy = makePolicy([
      {
        when: { op: "in", field: "orgSlugs", value: ["acme", "acme-staging"] },
        tabs: [{ url: "https://notion.so/acme/handbook" }],
      },
    ]);
    expect(
      evaluatePolicy(
        policy,
        signedIn({ orgSlugs: ["acme"] }),
        [],
      ).matchedRuleId,
    ).not.toBeNull();
    expect(
      evaluatePolicy(
        policy,
        signedIn({ orgSlugs: ["acme-staging", "unrelated"] }),
        [],
      ).matchedRuleId,
    ).not.toBeNull();
    expect(
      evaluatePolicy(policy, signedIn({ orgSlugs: ["other-co"] }), [])
        .matchedRuleId,
    ).toBeNull();
    expect(
      evaluatePolicy(policy, signedIn({ orgSlugs: [] }), []).matchedRuleId,
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// evaluatePolicy — compound conditions
// ---------------------------------------------------------------------------

describe("evaluatePolicy — compound conditions", () => {
  it("and requires every child to match", () => {
    const policy = makePolicy([
      {
        when: {
          op: "and",
          of: [
            { op: "signedIn" },
            { op: "endsWith", field: "emailDomain", value: "acme.com" },
          ],
        },
        tabs: [{ url: "https://acme.internal/" }],
      },
    ]);
    expect(
      evaluatePolicy(policy, signedIn({ emailDomain: "acme.com" }), [])
        .matchedRuleId,
    ).not.toBeNull();
    expect(
      evaluatePolicy(policy, signedIn({ emailDomain: "other.com" }), [])
        .matchedRuleId,
    ).toBeNull();
    expect(evaluatePolicy(policy, anonymousViewer, []).matchedRuleId).toBeNull();
  });

  it("or matches when any child matches", () => {
    const policy = makePolicy([
      {
        when: {
          op: "or",
          of: [
            { op: "equals", field: "email", value: "alice@example.com" },
            { op: "in", field: "orgSlugs", value: ["acme"] },
          ],
        },
        tabs: [{ url: "https://mixed.com/" }],
      },
    ]);
    expect(
      evaluatePolicy(policy, signedIn({ email: "alice@example.com" }), [])
        .matchedRuleId,
    ).not.toBeNull();
    expect(
      evaluatePolicy(
        policy,
        signedIn({ email: "carol@example.com", orgSlugs: ["acme"] }),
        [],
      ).matchedRuleId,
    ).not.toBeNull();
    expect(
      evaluatePolicy(policy, signedIn({ email: "carol@example.com" }), [])
        .matchedRuleId,
    ).toBeNull();
  });

  it("not negates its single child", () => {
    const policy = makePolicy([
      {
        when: { op: "not", of: [{ op: "anonymous" }] },
        tabs: [{ url: "https://members-only.com/" }],
      },
    ]);
    expect(evaluatePolicy(policy, signedIn(), []).matchedRuleId).not.toBeNull();
    expect(evaluatePolicy(policy, anonymousViewer, []).matchedRuleId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// evaluatePolicy — stopOnMatch + showBadge semantics
// ---------------------------------------------------------------------------

describe("evaluatePolicy — stopOnMatch semantics", () => {
  it("first match wins when stopOnMatch defaults to true", () => {
    const policy = makePolicy([
      {
        id: "r_first",
        when: { op: "always" },
        tabs: [{ url: "https://first.com/" }],
      },
      {
        id: "r_second",
        when: { op: "always" },
        tabs: [{ url: "https://second.com/" }],
      },
    ]);
    const result = evaluatePolicy(policy, signedIn(), []);
    expect(result.matchedRuleId).toBe("r_first");
    expect(result.tabs.map((t) => t.url)).toEqual(["https://first.com/"]);
  });

  it("stopOnMatch: false appends tabs and continues evaluation", () => {
    const policy = makePolicy([
      {
        id: "r_a",
        when: { op: "signedIn" },
        stopOnMatch: false,
        tabs: [{ url: "https://a.com/" }],
      },
      {
        id: "r_b",
        when: { op: "endsWith", field: "emailDomain", value: "acme.com" },
        tabs: [{ url: "https://b.com/" }],
      },
    ]);
    const result = evaluatePolicy(
      policy,
      signedIn({ emailDomain: "acme.com" }),
      [],
    );
    // First (append) rule matched, second (stop) rule short-circuited.
    // Result: tabs combined, decisive rule attributed to second.
    expect(result.matchedRuleId).toBe("r_b");
    expect(result.tabs.map((t) => t.url)).toEqual([
      "https://a.com/",
      "https://b.com/",
    ]);
  });

  it("stopOnMatch: false across multiple rules without any short-circuit returns firstMatch", () => {
    const policy = makePolicy([
      {
        id: "r_a",
        when: { op: "signedIn" },
        stopOnMatch: false,
        tabs: [{ url: "https://a.com/" }],
      },
      {
        id: "r_b",
        when: { op: "signedIn" },
        stopOnMatch: false,
        tabs: [{ url: "https://b.com/" }],
      },
    ]);
    const result = evaluatePolicy(policy, signedIn(), []);
    expect(result.matchedRuleId).toBe("r_a");
    expect(result.tabs.map((t) => t.url)).toEqual([
      "https://a.com/",
      "https://b.com/",
    ]);
  });

  it("dedupes accumulated tabs by URL", () => {
    const policy = makePolicy([
      {
        when: { op: "signedIn" },
        stopOnMatch: false,
        tabs: [{ url: "https://shared.com/" }],
      },
      {
        when: { op: "always" },
        tabs: [
          { url: "https://shared.com/" },
          { url: "https://unique.com/" },
        ],
      },
    ]);
    const result = evaluatePolicy(policy, signedIn(), []);
    expect(result.tabs.map((t) => t.url)).toEqual([
      "https://shared.com/",
      "https://unique.com/",
    ]);
  });
});

describe("evaluatePolicy — showBadge name surfacing", () => {
  it("surfaces the rule name only when showBadge is true", () => {
    const hiddenPolicy = makePolicy([
      {
        id: "r_hidden",
        name: "VIP Customers",
        when: { op: "signedIn" },
        showBadge: false,
        tabs: [{ url: "https://vip.com/" }],
      },
    ]);
    const shownPolicy = makePolicy([
      {
        id: "r_shown",
        name: "Engineering team",
        when: { op: "signedIn" },
        showBadge: true,
        tabs: [{ url: "https://eng.com/" }],
      },
    ]);
    expect(evaluatePolicy(hiddenPolicy, signedIn(), []).matchedRuleName).toBeNull();
    expect(evaluatePolicy(hiddenPolicy, signedIn(), []).showBadge).toBe(false);
    expect(evaluatePolicy(shownPolicy, signedIn(), []).matchedRuleName).toBe(
      "Engineering team",
    );
    expect(evaluatePolicy(shownPolicy, signedIn(), []).showBadge).toBe(true);
  });

  it("surfaces no name when a rule opts in but has no name", () => {
    const policy = makePolicy([
      {
        id: "r_nameless",
        when: { op: "signedIn" },
        showBadge: true,
        tabs: [{ url: "https://nameless.com/" }],
      },
    ]);
    const result = evaluatePolicy(policy, signedIn(), []);
    expect(result.matchedRuleName).toBeNull();
    expect(result.showBadge).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// evaluatePolicy — fallback behavior
// ---------------------------------------------------------------------------

describe("evaluatePolicy — fallback", () => {
  it("returns fallbackUrls with null match metadata when policy is empty", () => {
    expect(
      evaluatePolicy(null, anonymousViewer, ["https://a.com", "https://b.com"]),
    ).toEqual({
      tabs: [{ url: "https://a.com" }, { url: "https://b.com" }],
      matchedRuleId: null,
      matchedRuleName: null,
      showBadge: false,
    });
  });

  it("returns fallbackUrls when no rule matches", () => {
    const policy = makePolicy([
      {
        when: { op: "equals", field: "email", value: "nobody@nowhere.com" },
        tabs: [{ url: "https://nope.com/" }],
      },
    ]);
    const result = evaluatePolicy(policy, signedIn(), ["https://pub.com/"]);
    expect(result.matchedRuleId).toBeNull();
    expect(result.tabs).toEqual([{ url: "https://pub.com/" }]);
  });
});

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

type RuleInput = {
  id?: string;
  name?: string;
  when: Condition;
  tabs: { url: string; note?: string }[];
  stopOnMatch?: boolean;
  showBadge?: boolean;
};

function makePolicy(rules: RuleInput[]): ResolutionPolicy {
  const normalized: Rule[] = rules.map((r, index) => ({
    id: r.id ?? `r_test_${index}`,
    name: r.name,
    when: r.when,
    tabs: r.tabs,
    stopOnMatch: r.stopOnMatch ?? true,
    showBadge: r.showBadge ?? false,
  }));
  return { version: 1, rules: normalized };
}
