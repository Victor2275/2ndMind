import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

// Harness smoke test. Real coverage starts with the vault parser on day 5.
describe("test harness", () => {
  it("resolves the @/ import alias", () => {
    expect(typeof cn).toBe("function");
  });

  it("merges conflicting tailwind classes last-wins", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
});
