import { describe, expect, it } from "vitest";

import {
  type ClerkMembershipLike,
  type ClerkUserLike,
  mapClerkToViewerContext,
} from "./viewer-context";

// ---------------------------------------------------------------------------
// `mapClerkToViewerContext` drives the viewer identity that the policy
// evaluator consumes at `/l/[slug]`. These tests guard against silent
// drift in Clerk's field names: if a future `@clerk/backend` release
// renames `provider` or restructures `organizationMemberships`, these
// assertions turn red before production.
// ---------------------------------------------------------------------------

function fakeUser(overrides: Partial<ClerkUserLike> = {}): ClerkUserLike {
  return {
    id: "user_abc",
    primaryEmailAddressId: "email_primary",
    emailAddresses: [
      { id: "email_primary", emailAddress: "Alice@Example.com" },
    ],
    externalAccounts: [],
    ...overrides,
  };
}

function fakeMembership(id: string, slug: string | null): ClerkMembershipLike {
  return { organization: { id, slug } };
}

describe("mapClerkToViewerContext — anonymous path", () => {
  it("returns the anonymous viewer when no user is passed", () => {
    expect(mapClerkToViewerContext(null)).toEqual({
      anonymous: true,
      orgIds: [],
      orgSlugs: [],
    });
  });

  it("returns the anonymous viewer with explicit empty memberships", () => {
    expect(mapClerkToViewerContext(null, [])).toEqual({
      anonymous: true,
      orgIds: [],
      orgSlugs: [],
    });
  });
});

describe("mapClerkToViewerContext — email + emailDomain", () => {
  it("uses the primary email address and lowercases it", () => {
    const viewer = mapClerkToViewerContext(fakeUser());
    expect(viewer.email).toBe("alice@example.com");
    expect(viewer.emailDomain).toBe("example.com");
  });

  it("falls back to the first email address if primary is not set", () => {
    const viewer = mapClerkToViewerContext(
      fakeUser({
        primaryEmailAddressId: null,
        emailAddresses: [
          { id: "e1", emailAddress: "bob@contoso.com" },
          { id: "e2", emailAddress: "bob@fallback.com" },
        ],
      }),
    );
    expect(viewer.email).toBe("bob@contoso.com");
  });

  it("omits email fields when the user has no email addresses", () => {
    const viewer = mapClerkToViewerContext(
      fakeUser({ primaryEmailAddressId: null, emailAddresses: [] }),
    );
    expect(viewer.email).toBeUndefined();
    expect(viewer.emailDomain).toBeUndefined();
  });
});

describe("mapClerkToViewerContext — external accounts (guards Clerk SDK drift)", () => {
  it("maps provider === 'oauth_github' to githubLogin via `username`", () => {
    const viewer = mapClerkToViewerContext(
      fakeUser({
        externalAccounts: [
          {
            provider: "oauth_github",
            username: "alicegh",
            emailAddress: "ignored@github.local",
          },
        ],
      }),
    );
    expect(viewer.githubLogin).toBe("alicegh");
    expect(viewer.googleEmail).toBeUndefined();
  });

  it("maps provider === 'oauth_google' to googleEmail via `emailAddress`", () => {
    const viewer = mapClerkToViewerContext(
      fakeUser({
        externalAccounts: [
          {
            provider: "oauth_google",
            emailAddress: "Alice.Gmail@Gmail.com",
            username: null,
          },
        ],
      }),
    );
    expect(viewer.googleEmail).toBe("alice.gmail@gmail.com");
    expect(viewer.githubLogin).toBeUndefined();
  });

  it("ignores unknown providers (e.g. 'oauth_facebook')", () => {
    const viewer = mapClerkToViewerContext(
      fakeUser({
        externalAccounts: [
          { provider: "oauth_facebook", emailAddress: "x", username: "x" },
        ],
      }),
    );
    expect(viewer.githubLogin).toBeUndefined();
    expect(viewer.googleEmail).toBeUndefined();
  });

  it("silently skips empty / whitespace usernames and emails", () => {
    const viewer = mapClerkToViewerContext(
      fakeUser({
        externalAccounts: [
          { provider: "oauth_github", username: "   ", emailAddress: "x" },
          { provider: "oauth_google", username: "x", emailAddress: "   " },
        ],
      }),
    );
    expect(viewer.githubLogin).toBeUndefined();
    expect(viewer.googleEmail).toBeUndefined();
  });
});

describe("mapClerkToViewerContext — plural org memberships", () => {
  it("flattens the full membership list into orgIds + orgSlugs", () => {
    const viewer = mapClerkToViewerContext(fakeUser(), [
      fakeMembership("org_acme", "acme"),
      fakeMembership("org_acme_staging", "acme-staging"),
      fakeMembership("org_misc", "misc"),
    ]);
    expect(viewer.orgIds).toEqual(["org_acme", "org_acme_staging", "org_misc"]);
    expect(viewer.orgSlugs).toEqual(["acme", "acme-staging", "misc"]);
  });

  it("drops memberships whose organization lacks a slug", () => {
    const viewer = mapClerkToViewerContext(fakeUser(), [
      fakeMembership("org_a", "acme"),
      fakeMembership("org_b", null),
    ]);
    expect(viewer.orgIds).toEqual(["org_a", "org_b"]);
    expect(viewer.orgSlugs).toEqual(["acme"]);
  });

  it("dedupes repeated org ids and slugs", () => {
    const viewer = mapClerkToViewerContext(fakeUser(), [
      fakeMembership("org_acme", "acme"),
      fakeMembership("org_acme", "acme"),
    ]);
    expect(viewer.orgIds).toEqual(["org_acme"]);
    expect(viewer.orgSlugs).toEqual(["acme"]);
  });

  it("is independent of active-workspace — every listed membership counts", () => {
    // The DSL deliberately does not expose an "active org" concept. A viewer
    // who opens /l/<slug> from a chat app won't have an active Clerk
    // workspace; they still match org-membership rules.
    const viewer = mapClerkToViewerContext(fakeUser(), [
      fakeMembership("org_acme", "acme"),
    ]);
    expect(viewer.orgSlugs).toContain("acme");
  });
});

describe("mapClerkToViewerContext — end-to-end shape", () => {
  it("builds a fully-populated viewer", () => {
    const viewer = mapClerkToViewerContext(
      fakeUser({
        externalAccounts: [
          { provider: "oauth_github", username: "alicegh", emailAddress: "" },
          {
            provider: "oauth_google",
            username: null,
            emailAddress: "alice@gmail.com",
          },
        ],
      }),
      [fakeMembership("org_acme", "acme")],
    );
    expect(viewer).toEqual({
      anonymous: false,
      userId: "user_abc",
      email: "alice@example.com",
      emailDomain: "example.com",
      githubLogin: "alicegh",
      googleEmail: "alice@gmail.com",
      orgIds: ["org_acme"],
      orgSlugs: ["acme"],
    });
  });
});
