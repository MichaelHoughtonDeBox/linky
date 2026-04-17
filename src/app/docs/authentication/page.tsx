import Link from "next/link";

export default function DocsAuthenticationPage() {
  return (
    <>
      <p className="terminal-label">Authentication</p>
      <h1 className="display-title text-4xl leading-[0.95] font-semibold text-foreground sm:text-5xl">
        Identity is Clerk
      </h1>
      <p className="docs-lede">
        Clerk is the only identity primitive. Every viewer field the policy
        DSL understands is projected from a Clerk user and their organization
        memberships.
      </p>

      <section className="docs-section">
        <p className="terminal-label">Viewer field → Clerk source</p>
        <div className="docs-table-wrap">
          <table className="docs-table">
            <thead>
              <tr>
                <th>Viewer field</th>
                <th>Clerk source</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>email</code>
                </td>
                <td>Primary email address (lower-cased).</td>
              </tr>
              <tr>
                <td>
                  <code>emailDomain</code>
                </td>
                <td>Domain portion of the primary email (lower-cased).</td>
              </tr>
              <tr>
                <td>
                  <code>userId</code>
                </td>
                <td>
                  Clerk <code>user.id</code>.
                </td>
              </tr>
              <tr>
                <td>
                  <code>githubLogin</code>
                </td>
                <td>
                  <code>externalAccounts</code> entry where{" "}
                  <code>provider === &quot;oauth_github&quot;</code>, field{" "}
                  <code>username</code>.
                </td>
              </tr>
              <tr>
                <td>
                  <code>googleEmail</code>
                </td>
                <td>
                  <code>externalAccounts</code> entry where{" "}
                  <code>provider === &quot;oauth_google&quot;</code>, field{" "}
                  <code>emailAddress</code> (lower-cased).
                </td>
              </tr>
              <tr>
                <td>
                  <code>orgIds</code>
                </td>
                <td>
                  Every <code>organization.id</code> the viewer is a member of
                  (full membership list — not active workspace).
                </td>
              </tr>
              <tr>
                <td>
                  <code>orgSlugs</code>
                </td>
                <td>
                  Every <code>organization.slug</code> the viewer is a member
                  of (full membership list — not active workspace).
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          The mapping lives in <code>src/lib/server/viewer-context.ts</code>.
          It&apos;s pure and unit-tested with fake shapes — if Clerk renames a
          provider (e.g. <code>oauth_github</code> → something else) the tests
          turn red before the change reaches production.
        </p>
      </section>

      <section className="docs-section">
        <p className="terminal-label">Missing fields never throw</p>
        <p>
          Anonymous viewers and signed-in viewers with missing data (no
          primary email, no GitHub connection, no org memberships) simply fail
          to match rules that reference the missing field. Evaluation
          continues down the rule list and falls through to the public bundle
          if nothing matches.
        </p>
      </section>

      <section className="docs-section">
        <p className="terminal-label">Production setup</p>
        <p>
          For <code>googleEmail</code> and <code>githubLogin</code> to
          populate at resolve time, enable the corresponding social providers
          in Clerk&apos;s dashboard under{" "}
          <strong>User & Authentication → Social Connections</strong>. Use
          Clerk&apos;s shared development credentials locally; swap in your
          own OAuth credentials before going live.
        </p>
        <p>
          Ensure <strong>Email address</strong> is a required identifier and
          that the primary email is populated on sign-up. A missing primary
          email silently disables any rule that depends on{" "}
          <code>email</code> or <code>emailDomain</code>.
        </p>
        <p>
          Full deployment walkthrough (webhooks, signing secrets, DNS) lives
          in the <code>README.md</code> &mdash; this page is the
          viewer-identity-only view.
        </p>
      </section>

      <nav className="docs-next" aria-label="Next steps">
        <span>Next:</span>
        <Link href="/docs/personalize">Personalize</Link>
        <Link href="/docs/launcher">Launcher</Link>
      </nav>
    </>
  );
}
