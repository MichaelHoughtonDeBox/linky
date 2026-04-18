import Link from "next/link";

export const metadata = {
  title: "Access control · Linky docs",
  description:
    "Three derived roles — viewer, editor, admin — govern who can see, edit, and delete org-owned launch bundles. Derived from your Clerk org role.",
};

// Sprint 2.7 Chunk E — public doc for the role model.
// Intentionally short. Anything marketing-adjacent stays in README's
// "Trust & lifecycle policy" section; this page is the how-to for
// admins who need to promote a teammate or explain what a role
// means to a viewer.
export default function DocsAccessControlPage() {
  return (
    <>
      <p className="terminal-label">Access control</p>
      <h1 className="display-title text-4xl leading-[0.95] font-semibold text-foreground sm:text-5xl">
        Who can see, edit, and delete team launch bundles
      </h1>
      <p className="docs-lede">
        On team workspaces, Linky derives three roles from your Clerk org
        role and gates the dashboard around them. The defaults keep a
        team safe; admins can adjust by renaming a role in Clerk.
      </p>

      <section className="docs-section">
        <p className="terminal-label">The three derived roles</p>
        <div className="docs-table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Role</th>
                <th scope="col">Can do</th>
                <th scope="col">Cannot do</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>admin</strong>
                </td>
                <td>
                  View, edit, delete, manage API keys, view insights
                </td>
                <td>— (full authority on the team&apos;s bundles)</td>
              </tr>
              <tr>
                <td>
                  <strong>editor</strong>
                </td>
                <td>View, edit, view insights</td>
                <td>Delete a bundle, mint or revoke API keys</td>
              </tr>
              <tr>
                <td>
                  <strong>viewer</strong>
                </td>
                <td>View the dashboard list + insights</td>
                <td>Edit, delete, manage API keys</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          Personal workspaces have no roles — you are always admin of your
          own launch bundles.
        </p>
      </section>

      <section className="docs-section">
        <p className="terminal-label">How Linky reads your Clerk role</p>
        <p>
          Linky looks at the <code>role</code> on your membership row and
          maps it to one of the three derived roles above. The mapping is:
        </p>
        <ul className="docs-list">
          <li>
            <code>org:admin</code> → <strong>admin</strong>
          </li>
          <li>
            <code>org:member</code> → <strong>editor</strong>
          </li>
          <li>
            Any custom role whose slug starts with <code>linky:editor</code>
            {" "}→ <strong>editor</strong> (e.g.{" "}
            <code>linky:editor:reviews</code>,{" "}
            <code>linky:editor:incidents</code>)
          </li>
          <li>
            Anything else → <strong>viewer</strong> (conservative default)
          </li>
        </ul>
        <p>
          Privilege escalation to admin only happens through{" "}
          <code>org:admin</code>. A custom role cannot claim admin
          authority by naming itself <code>linky:admin:*</code> — Linky
          ignores the prefix and that role falls through to viewer.
        </p>
      </section>

      <section className="docs-section">
        <p className="terminal-label">Changing someone&apos;s role</p>
        <p>
          Open your team in the{" "}
          <Link
            href="https://dashboard.clerk.com"
            className="underline-offset-4 hover:underline"
          >
            Clerk dashboard
          </Link>
          , pick the member, and change their role. Linky picks up the
          change on the next webhook delivery (seconds, not minutes).
          You do not need to do anything inside the Linky dashboard.
        </p>
        <p>
          If you need a power-user role that is not a Clerk admin,
          create a custom role with a slug starting with{" "}
          <code>linky:editor</code>. Every slug under that prefix maps
          to editor regardless of suffix — useful when you want
          Clerk&apos;s own access model to distinguish{" "}
          <code>linky:editor:reviews</code> from{" "}
          <code>linky:editor:incidents</code> even though both have the
          same Linky authority.
        </p>
      </section>

      <section className="docs-section">
        <p className="terminal-label">What deleting a bundle actually does</p>
        <p>
          <code>DELETE</code> is restricted to admin on purpose. The
          action is soft: the row stays in the database, the launcher
          at <code>/l/:slug</code> returns 404, and the edit history in{" "}
          <code>linky_versions</code> survives. Recovery is a one-line
          SQL update an admin can run from the Neon console. That
          tradeoff buys a safer default: an editor cannot permanently
          strip tabs from a team bundle that a teammate depends on.
        </p>
      </section>

      <section className="docs-section">
        <p className="terminal-label">API keys and roles</p>
        <p>
          Team API keys act as the team itself, not as the human who
          minted them. They default to the <strong>editor</strong>{" "}
          effective role — they can view and edit team bundles, but they
          cannot delete or manage other keys. This keeps an automation
          credential from escalating past what a human editor could do,
          even if an admin minted it.
        </p>
        <p>
          If you need an automation that can manage keys, pair a team
          admin with a personal API key scoped to <code>keys:admin</code>
          . See the <Link href="/docs/cli">CLI guide</Link> for how to
          store and use keys.
        </p>
      </section>

      <section className="docs-section">
        <p className="terminal-label">What viewers of your launcher see</p>
        <p>
          None of this applies to the public{" "}
          <code>/l/:slug</code> page — any viewer can open any Linky the
          launcher URL points at. Roles gate the owner-facing dashboard
          surfaces only. Personalized tab sets for viewers are controlled
          by the{" "}
          <Link href="/docs/personalize">resolution policy</Link>, not
          by team roles.
        </p>
      </section>
    </>
  );
}
