import { defineConfig } from "vitest/config";
import path from "node:path";

// Minimal vitest setup. We scope tests to unit-level modules that don't
// require a running Next.js server / DB / Clerk / Stripe. Integration tests
// that hit live services live outside this config.
export default defineConfig({
  test: {
    environment: "node",
    // Unit tests live next to the code they cover. `src/**` is the Next.js
    // app; `sdk/**` is the external JS SDK published to npm. Both trees
    // run through the same vitest config.
    include: ["src/**/*.test.ts", "sdk/**/*.test.js"],
    // Don't try to load `server-only` under test — it throws by design in
    // any non-server context. Stubbing keeps the tested modules' intent
    // visible (they should only be imported server-side) while letting
    // vitest actually run them.
    server: {
      deps: {
        inline: [/^server-only$/],
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // `server-only` is a zero-cost guard in production that throws at
      // import time if bundled into client code. In unit tests we replace
      // it with an empty module.
      "server-only": path.resolve(__dirname, "test/stubs/server-only.ts"),
    },
  },
});
