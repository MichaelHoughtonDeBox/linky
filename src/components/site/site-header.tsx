"use client";

import Image from "next/image";
import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";

type SiteHeaderProps = {
  currentPath?:
    | "/"
    | "/docs"
    | "/design"
    | "/signin"
    | "/signup"
    | "/dashboard"
    | "/l";
};

const GITHUB_REPO_URL = "https://github.com/MichaelHoughtonDeBox/linky";

export function SiteHeader({ currentPath = "/" }: SiteHeaderProps) {
  return (
    <header className="site-topbar">
      <Link href="/" className="site-brand" aria-label="Linky home">
        <Image
          src="/logo-mark.svg"
          alt="Linky logo"
          width={28}
          height={28}
          className="border border-foreground bg-white"
          priority
        />
        <span className="display-title text-lg leading-none font-semibold text-foreground">
          Linky
        </span>
      </Link>
      <nav className="site-nav" aria-label="Primary">
        <Link
          href="/docs"
          className={`site-nav-link ${currentPath === "/docs" ? "is-active" : ""}`}
        >
          Docs
        </Link>
        <Link
          href="/design"
          className={`site-nav-link ${currentPath === "/design" ? "is-active" : ""}`}
        >
          Design
        </Link>

        {/*
          Clerk 7 replaced <SignedIn>/<SignedOut> with <Show when="...">.
          The client-boundary export works inside a "use client" component,
          while the server build resolves to the RSC equivalent automatically.
        */}
        <Show when="signed-in">
          <Link
            href="/dashboard"
            className={`site-nav-link ${currentPath === "/dashboard" ? "is-active" : ""}`}
          >
            Dashboard
          </Link>
        </Show>

        <Show when="signed-out">
          <Link
            href="/signin"
            className={`site-nav-link ${currentPath === "/signin" ? "is-active" : ""}`}
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className={`site-nav-link ${currentPath === "/signup" ? "is-active" : ""}`}
          >
            Sign up
          </Link>
        </Show>

        <a
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="site-nav-link"
        >
          GitHub
        </a>

        <Show when="signed-in">
          <div className="ml-1 flex items-center">
            {/*
              Post-sign-out destination is configured on <ClerkProvider>
              (see src/app/layout.tsx). Keeping the prop off the component
              here avoids drift when we change the policy globally.
            */}
            <UserButton />
          </div>
        </Show>
      </nav>
    </header>
  );
}
