import Link from "next/link";

export default function LinkyNotFound() {
  return (
    <div className="terminal-stage flex flex-1 items-center justify-center px-6 py-14">
      <main className="terminal-shell w-full max-w-xl p-8 text-center">
        <p className="terminal-label mb-3">RESOLVER STATUS</p>
        <h1 className="display-title mb-2 text-4xl font-semibold text-foreground">
          Linky not found
        </h1>
        <p className="terminal-muted mb-8 text-sm leading-relaxed">
          That short URL does not exist, may have been removed, or has an
          invalid slug.
        </p>
        <Link href="/" className="terminal-action inline-block px-6 py-3 text-sm">
          Create a new Linky
        </Link>
      </main>
    </div>
  );
}
