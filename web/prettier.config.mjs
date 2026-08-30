/**
 * Prettier configuration.
 *
 * Settled in V3 §0.2, closing the `## Style guide — DECISION NEEDED` section that had been
 * open in `context.md` since V1. See DECISIONS.md D-136 (why Prettier) and D-142 (what it is
 * allowed to touch, and why the two deviations below are not preferences).
 *
 * Everything not listed here is a Prettier default on purpose — the point of the tool is to
 * stop having these arguments. Both overrides were measured, not chosen by taste:
 */
export default {
  /**
   * Default is 80. Measured across `src/**`: p50 25, p90 87, p99 104 — this codebase was
   * written to ~100 columns. At 80 the one-shot format pass reflows 2,764 lines; at 100 it
   * reflows 266. Ten times less churn in the commit that is supposed to be pure noise, which
   * is the whole reason for doing this before V3's code lands rather than after.
   */
  printWidth: 100,

  /**
   * Default is "lf", and it would be wrong here. `.gitattributes` sets `* text=auto eol=lf`:
   * files are committed as LF and checked out **native**, so on Windows the working tree is
   * CRLF. Forcing "lf" makes `--check` pass on this machine and then fail on every fresh
   * clone — and, since the pre-commit hook runs `--check`, it would block commits after any
   * checkout. "auto" keeps whatever the file already has, which is CRLF locally and LF on
   * Vercel. Verified: every sampled file in `src/` is 100% CRLF today.
   */
  endOfLine: "auto",

  /**
   * Sorts Tailwind classes into the framework's canonical order. Tailwind v4 has no JS config
   * — `src/app/globals.css` is the config (`@import "tailwindcss"`), so the plugin needs
   * `tailwindStylesheet` rather than v3's `tailwindConfig`. Without it the plugin silently
   * falls back to default class ordering and misses this project's custom utilities
   * (`card-scan`, `link-wipe` — see DECISIONS.md D-005).
   */
  plugins: ["prettier-plugin-tailwindcss"],
  tailwindStylesheet: "./src/app/globals.css",
};
