import { describe, expect, it } from "vitest";

import { assertVaultPath } from "../write";

/**
 * The write token is fine-grained but repo-wide: "Contents: read and write" covers every file
 * in the repository, including `web/` and `.github/workflows/`. Path validation is therefore
 * the only thing standing between a bug in a form handler and an arbitrary repo write.
 */

describe("assertVaultPath", () => {
  it("accepts a normal vault file", () => {
    expect(() => assertVaultPath("context/04_operations/current_sprint.md")).not.toThrow();
  });

  it("rejects paths outside context/", () => {
    for (const path of [
      "web/src/app/page.tsx",
      ".github/workflows/deploy.yml",
      "README.md",
      "/etc/passwd",
      "package.json",
    ]) {
      expect(() => assertVaultPath(path), path).toThrow(/outside the vault/);
    }
  });

  it("rejects traversal even when it starts inside context/", () => {
    for (const path of [
      "context/../web/src/app/page.md",
      "context/../../secrets.md",
      "context/04_operations/../../.github/x.md",
    ]) {
      expect(() => assertVaultPath(path), path).toThrow(/traversal/);
    }
  });

  it("rejects backslash paths, which normalise differently on Windows", () => {
    // "context/a" and "context\\a" are the same file to Windows but different strings to
    // the GitHub API, so a backslash is rejected outright rather than normalised.
    expect(() => assertVaultPath("context\\04_operations\\sprint.md")).toThrow(/traversal/);
  });

  it("rejects non-markdown files", () => {
    // A Contents-scoped token can rewrite a workflow or a lockfile just as easily.
    for (const path of ["context/assets/labs/x.png", "context/config.yml", "context/x"]) {
      expect(() => assertVaultPath(path), path).toThrow(/non-markdown/);
    }
  });
});
