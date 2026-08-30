import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { readVaultFile, writeVaultFile } from "../write";
import { replaceSection } from "../frontmatter";

describe("Vault write path end-to-end", () => {
  const ORIGINAL_CONTENT = [
    "---",
    "updated: 2026-01-01",
    "title: Test file",
    "---",
    "",
    "## Goals",
    "",
    "- old goal",
  ].join("\n");

  const MOCK_SHA_1 = "abc123old";
  const MOCK_SHA_2 = "def456new";

  let fetchMock: ReturnType<typeof vi.spyOn>;
  let previousToken: string | undefined;

  beforeEach(() => {
    // We mock global fetch which Octokit uses under the hood.
    fetchMock = vi.spyOn(global, "fetch").mockImplementation(async (url, init) => {
      const urlStr = url.toString();

      if (init?.method === "PUT") {
        // Mocking the write response
        const body = JSON.parse(init.body as string);

        // Assert that the sha matches the one we returned in GET (to prove last-write-wins protection)
        expect(body.sha).toBe(MOCK_SHA_1);

        // Assert the content was modified
        const decoded = Buffer.from(body.content, "base64").toString("utf8");
        expect(decoded).toContain("- new goal");
        expect(decoded).not.toContain("- old goal");
        // Assert updated date was bumped
        expect(decoded).toContain("updated: 2026-08-22");

        return new Response(
          JSON.stringify({
            commit: { sha: "commit-sha" },
            content: { html_url: "https://github.com/test", sha: MOCK_SHA_2 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      // Mocking the read response
      if (
        urlStr.includes("/contents/context%2Ftest.md") ||
        urlStr.includes("/contents/context/test.md")
      ) {
        return new Response(
          JSON.stringify({
            type: "file",
            content: Buffer.from(ORIGINAL_CONTENT, "utf8").toString("base64"),
            sha: MOCK_SHA_1,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      throw new Error(`Unhandled fetch mock: ${urlStr}`);
    });

    previousToken = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = "fake-token-for-test";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Restore rather than leave set: vitest shares a process between files in a worker, so a
    // token left behind here changes how other tests see the environment.
    if (previousToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = previousToken;
  });

  it("exercises the full read -> edit -> write -> invalidate flow", async () => {
    // 1. Read
    const { content, sha } = await readVaultFile("context/test.md");
    expect(sha).toBe(MOCK_SHA_1);
    expect(content).toContain("- old goal");

    // 2. Edit
    const updatedContent = replaceSection(content, "Goals", "- new goal");

    // 3. Write
    const result = await writeVaultFile("context/test.md", updatedContent, "Update goals", {
      today: "2026-08-22",
    });

    expect(result.commit).toBe("commit-sha");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
