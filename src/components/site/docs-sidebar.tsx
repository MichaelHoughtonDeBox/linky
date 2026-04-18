"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Data-driven IA. Edit here to add/rename/move a docs page — every render
// site (desktop + mobile disclosure) picks up the change automatically.
// Group labels land in a `.terminal-label` so they match the rest of the
// terminal aesthetic rather than inventing a new all-caps treatment.
type DocsNavLink = { href: string; label: string };
type DocsNavGroup = { label: string; links: DocsNavLink[] };

export const DOCS_NAV: DocsNavGroup[] = [
  {
    label: "Overview",
    links: [
      { href: "/docs", label: "Overview" },
      { href: "/docs/install", label: "Install" },
      { href: "/docs/quick-start", label: "Quick start" },
      { href: "/docs/identity", label: "Identity" },
    ],
  },
  {
    label: "Launch bundles",
    links: [
      { href: "/docs/create", label: "Create" },
      { href: "/docs/personalize", label: "Personalize" },
      { href: "/docs/launcher", label: "Launcher" },
    ],
  },
  {
    label: "Handoff",
    links: [{ href: "/docs/claim", label: "Claim flow" }],
  },
  {
    label: "Teams",
    links: [
      { href: "/docs/access-control", label: "Access control" },
    ],
  },
  {
    label: "Reference",
    links: [
      { href: "/docs/api", label: "API" },
      { href: "/docs/cli", label: "CLI" },
      { href: "/docs/sdk", label: "SDK" },
      { href: "/docs/limits", label: "Limits" },
    ],
  },
];

// `/docs` exact-matches only; every other entry matches its segment
// prefix so nested pages (if we add any later) still light up the parent.
function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/docs") return pathname === "/docs";
  return pathname === href || pathname.startsWith(`${href}/`);
}

type DocsSidebarProps = {
  variant?: "desktop" | "mobile";
};

export function DocsSidebar({ variant = "desktop" }: DocsSidebarProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={variant === "mobile" ? "Docs navigation (mobile)" : "Docs navigation"}
      className={variant === "desktop" ? "docs-sidebar" : undefined}
    >
      {DOCS_NAV.map((group) => (
        <div key={group.label} className="docs-sidebar-group">
          <p className="terminal-label docs-sidebar-group-heading">{group.label}</p>
          <ul className="docs-sidebar-list">
            {group.links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`docs-sidebar-link ${
                    isActive(pathname, link.href) ? "is-active" : ""
                  }`}
                  aria-current={isActive(pathname, link.href) ? "page" : undefined}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

// Small helper so the page chrome can render "Next: X" and "See also" links
// without every page hand-duplicating sidebar knowledge.
export function findDocByHref(href: string): DocsNavLink | undefined {
  for (const group of DOCS_NAV) {
    const match = group.links.find((link) => link.href === href);
    if (match) return match;
  }
  return undefined;
}
