import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";
import { TAB_CATEGORIES } from "@/lib/log/categories";

/**
 * The launcher's long-press shortcuts (V3 §3.5, D-178).
 *
 * These are three URLs in a file nothing else imports, pointing at query parameters two other
 * files parse. That is exactly the shape of thing that breaks silently: rename a category key,
 * and the shortcut still installs, still appears in the launcher, and quietly opens the wrong
 * form — or none. Nobody re-tests a long-press menu.
 */
describe("the icon's shortcuts", () => {
  const shortcuts = manifest().shortcuts ?? [];

  it("offers the three that were chosen", () => {
    expect(shortcuts.map((s) => s.name)).toEqual(["Log training", "Quick note", "End of day"]);
  });

  it("names a category that actually exists", () => {
    // The failure this prevents: `athletics` becomes `training`, the launcher keeps offering
    // "Log training", and it opens on whatever tab happens to be first.
    for (const shortcut of shortcuts) {
      const category = new URL(shortcut.url, "https://example.com").searchParams.get("category");
      if (category === null) continue;
      expect(
        TAB_CATEGORIES.some((c) => c.key === category),
        `${shortcut.name} points at "${category}"`,
      ).toBe(true);
    }
  });

  it("stays inside the app, so a shortcut cannot land on the portfolio", () => {
    for (const shortcut of shortcuts) {
      expect(shortcut.url.startsWith("/private"), shortcut.url).toBe(true);
    }
  });

  it("goes straight into a form, never to a screen you then navigate from", () => {
    /**
     * The whole value is arriving ready to type. A shortcut to a landing page saves nothing.
     *
     * The rule used to be spelled "the URL carries a query parameter", which was a proxy for it
     * — every form was a tab or a mode of `/private/log`. V4 Phase 2.7 broke the proxy without
     * breaking the rule: "Log training" now opens `/private/athletics/log`, a route whose entire
     * content *is* the form, so it needs no parameter to arrive ready.
     *
     * So the assertion states the rule directly. `/private/athletics/log` qualifies; `/private`
     * or `/private/athletics` would not, and those are the mistakes worth catching.
     */
    const FORM_ROUTES = ["/private/athletics/log"];

    for (const shortcut of shortcuts) {
      const arrivesReady =
        /\?(category|capture)=/.test(shortcut.url) || FORM_ROUTES.includes(shortcut.url);
      expect(arrivesReady, `${shortcut.name} → ${shortcut.url}`).toBe(true);
    }
  });
});
