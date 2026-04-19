// ============================================================================
// Terminal sparkline — Sprint 2.8 Chunk C.
//
// Zero dependencies. Renders an array of numbers as a single line of
// Unicode block characters, scaled to the series' max. When the caller's
// stdout is NOT a TTY (e.g. piped into jq), we skip the sparkline entirely
// — ASCII consumers shouldn't have to strip Unicode noise out of output.
//
// Used by `linky insights` to render the daily view count next to the
// totals block. The visual is intentionally small (one line, max 50 chars)
// so it fits in any terminal width without wrapping.
// ============================================================================

// 8 levels of fill. U+2581..U+2588 in the "Block Elements" range. These
// render reliably on every modern terminal font (macOS Terminal, iTerm2,
// Alacritty, Windows Terminal, GNOME Terminal).
const BLOCKS = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];

// Value 0 gets an explicit empty slot — rendering it as the smallest block
// would lie to the reader ("this day had traffic when it didn't").
const EMPTY = " ";

function render(series, options = {}) {
  if (!Array.isArray(series) || series.length === 0) return "";

  const maxWidth = Math.max(1, options.maxWidth ?? 50);
  const values = series.slice(-maxWidth).map((n) => {
    const asNumber = Number(n);
    return Number.isFinite(asNumber) && asNumber > 0 ? asNumber : 0;
  });

  const max = Math.max(...values);
  if (max === 0) {
    // All zeroes → render a baseline row. Conveys "we ran the query,
    // there was just nothing to plot" vs returning an empty string
    // which looks like the sparkline failed.
    return BLOCKS[0].repeat(values.length);
  }

  return values
    .map((value) => {
      if (value <= 0) return EMPTY;
      // Map 1..max onto the 8 block levels. Always reserve level 0
      // (the smallest block) for non-zero values so a 1-view day
      // doesn't collapse to empty.
      const ratio = value / max;
      const level = Math.min(
        BLOCKS.length - 1,
        Math.floor(ratio * BLOCKS.length),
      );
      return BLOCKS[Math.max(0, level)];
    })
    .join("");
}

module.exports = {
  render,
};
