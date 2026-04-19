/* eslint-disable @typescript-eslint/no-require-imports */
import { describe, expect, it } from "vitest";

const { render } = require("./sparkline.js");

// ============================================================================
// Sparkline renderer tests (Sprint 2.8 Chunk C).
//
// The renderer is pure; the only interesting branches are:
//   - empty series → empty string
//   - all-zero series → baseline row (never an empty string, which would
//     look like a render failure)
//   - mixed values → proportional block heights, never an empty slot for
//     a non-zero value
//   - oversize series → truncated to maxWidth, newest-last
// ============================================================================

describe("sparkline render", () => {
  it("returns an empty string for an empty or non-array input", () => {
    expect(render([])).toBe("");
    expect(render(null)).toBe("");
    expect(render(undefined)).toBe("");
  });

  it("renders an all-zero series as a baseline row", () => {
    const out = render([0, 0, 0, 0]);
    expect(out.length).toBe(4);
    // All the same character — the smallest block. Length matches
    // input length so the x-axis is preserved.
    expect(new Set(out)).toEqual(new Set([out[0]]));
  });

  it("renders a rising series with increasing block heights", () => {
    // 1, 2, 4, 8 — strictly rising. Each char must be >= the previous
    // in Unicode codepoint (the Block Elements range is monotonic).
    const out = render([1, 2, 4, 8]);
    expect(out.length).toBe(4);
    for (let i = 1; i < out.length; i += 1) {
      expect(out.charCodeAt(i)).toBeGreaterThanOrEqual(out.charCodeAt(i - 1));
    }
  });

  it("never uses an empty slot for a non-zero value", () => {
    const out = render([1, 0, 1, 0, 1]);
    // Zeroes render as a space; non-zeroes must render a block.
    expect(out[0]).not.toBe(" ");
    expect(out[1]).toBe(" ");
    expect(out[2]).not.toBe(" ");
    expect(out[3]).toBe(" ");
    expect(out[4]).not.toBe(" ");
  });

  it("truncates to maxWidth, keeping the most recent values", () => {
    const long = Array.from({ length: 100 }, (_, i) => i + 1);
    const out = render(long, { maxWidth: 10 });
    expect(out.length).toBe(10);
    // The LAST value (100) is the largest — it must render as the
    // tallest block (U+2588).
    expect(out[out.length - 1]).toBe("█");
  });
});
