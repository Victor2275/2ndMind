import { describe, expect, it } from "vitest";

import { applyApprovals, fingerprint, isStale } from "../types";

const state = (o: Record<string, string>) =>
  Object.entries(o).map(([key, value]) => ({ key, value }));

describe("fingerprint", () => {
  it("does not depend on order", () => {
    // Row order varies with ids, so an order-sensitive fingerprint would report a change
    // every time the goals were recreated and make every proposal look stale.
    expect(fingerprint(state({ a: "1", b: "2" }))).toBe(fingerprint(state({ b: "2", a: "1" })));
  });

  it("changes when a value changes", () => {
    expect(fingerprint(state({ a: "1" }))).not.toBe(fingerprint(state({ a: "2" })));
  });

  it("changes when a key is added or removed", () => {
    expect(fingerprint(state({ a: "1" }))).not.toBe(fingerprint(state({ a: "1", b: "2" })));
  });

  it("distinguishes a moved value from an unchanged one", () => {
    // "a=1 b=2" vs "a=2 b=1" — naive concatenation of values alone would collide.
    expect(fingerprint(state({ a: "1", b: "2" }))).not.toBe(fingerprint(state({ a: "2", b: "1" })));
  });
});

describe("isStale", () => {
  it("is false when nothing moved", () => {
    const current = state({ engineering: "Ship /now" });
    expect(isStale({ basis: fingerprint(current) }, current)).toBe(false);
  });

  it("catches the case it exists for", () => {
    // Proposal generated, Victor edits a goal on his laptop, then approves on his phone.
    // Without this, the approval silently overwrites the edit he just made.
    const when = state({ engineering: "Ship /now" });
    const now = state({ engineering: "Ship /now and write the case study" });
    expect(isStale({ basis: fingerprint(when) }, now)).toBe(true);
  });
});

describe("applyApprovals", () => {
  const current = state({
    engineering: "Ship the Working page",
    athletics: "Three erg sessions",
    academics: "Finish the lab report",
  });

  it("leaves a rejected item exactly as it was", () => {
    // Rejection is absence. This is the property the whole surface is for.
    const next = applyApprovals(current, [{ key: "engineering", value: "Ship /now" }]);
    expect(next).toEqual(
      state({
        engineering: "Ship /now",
        athletics: "Three erg sessions",
        academics: "Finish the lab report",
      }),
    );
  });

  it("changes nothing at all when everything is rejected", () => {
    expect(applyApprovals(current, [])).toEqual(current);
  });

  it("takes the edited value, not the proposed one", () => {
    // Edit-then-approve is the common case: the model gets it 80% right and Victor fixes the
    // verb. The UI sends what is in the box, so this only has to not second-guess it.
    const next = applyApprovals(current, [{ key: "athletics", value: "Four erg sessions" }]);
    expect(next.find((e) => e.key === "athletics")?.value).toBe("Four erg sessions");
  });

  it("creates a key that did not exist", () => {
    const next = applyApprovals(state({ a: "1" }), [{ key: "b", value: "2" }]);
    expect(next).toEqual(state({ a: "1", b: "2" }));
  });

  it("treats an approved empty value as a deletion", () => {
    // Proposing the removal of a goal that no longer makes sense is legitimate. Treating
    // blank as "leave it alone" would make that impossible to express.
    const next = applyApprovals(current, [{ key: "athletics", value: "" }]);
    expect(next.map((e) => e.key)).toEqual(["engineering", "academics"]);
  });

  it("trims, so a stray space is not a value", () => {
    expect(applyApprovals(state({ a: "1" }), [{ key: "a", value: "  2  " }])).toEqual(
      state({ a: "2" }),
    );
  });

  it("treats whitespace-only as a deletion too", () => {
    expect(applyApprovals(state({ a: "1" }), [{ key: "a", value: "   " }])).toEqual([]);
  });
});
