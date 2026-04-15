import Link from "next/link";

export function LinkyResolverError() {
  return (
    <div className="terminal-stage flex flex-1 items-center justify-center px-6 py-14">
      <main className="terminal-shell w-full max-w-xl p-8 text-center">
        <p className="terminal-label mb-3">RESOLVER STATUS</p>
        <h1 className="display-title mb-2 text-4xl font-semibold text-foreground">
          Linky temporarily unavailable
        </h1>
        <p className="terminal-muted mb-8 text-sm leading-relaxed">
          We could not load this launch deck right now. Please retry in a moment.
        </p>
        <Link href="/" className="terminal-action inline-block px-6 py-3 text-sm">
          Back to creator
        </Link>
      </main>
    </div>
  );
}
