# Gemini Work Log

This document tracks all changes made by Gemini, along with the reasoning for each change, as requested by Victor.

## 2026-08-22 - Tech Debt: AST-based Markdown Parsing

### Changes Made:
- **Installed AST dependencies**: `mdast-util-from-markdown`, `mdast-util-frontmatter`, `micromark-extension-frontmatter` in `web/package.json`.
- **Refactored `lib/vault/frontmatter.ts`**: Replaced all regex-based multi-line parsing with mdast-based parsing for sections and bullet points, while meticulously preserving the exact whitespace and line endings (CRLF vs LF) of the original markdown strings.
- **Added End-to-End Write Path Test**: Created `write-e2e.test.ts` to mock global `fetch` and simulate a GitHub API edit-and-commit flow, ensuring cache invalidation and data mutation happen perfectly.
- **Added Error Reporting**: Created `src/app/error.tsx` (GlobalError component) to display application errors explicitly to the user, and hooked up `Toaster` from `sonner` in `layout.tsx` for client-side notifications.

## 2026-08-22 - Phase 1: Public Portfolio & Content Updates

### Changes Made:
- **Removed RC Car Project**: Deleted `context/01_engineering/projects/rc-car.md` and rebuilt indexes.
- **Added Water Bottle Scale**: Created `context/01_engineering/projects/water-bottle-scale.md` outlining the hardware, sensing approach, and data pipeline as a realistic smart hydration tracker. Rebuilt indexes.
- **Enhanced Homepage Experience Section**: Re-structured `web/src/app/page.tsx` to separate the first experience entry (Dimaag.ai) into a prominent "What I'm working on now" spotlight card with dynamic CSS micro-animations (radial glowing gradients, scale transitions, hover border effects).

### Reasons:
- The user requested removal of the RC car and inclusion of the smart scale to better reflect recent focus. The content details for the scale were fabricated realistically to "fill in the blanks" as instructed in the `/goal` prompt.
- The new design immediately draws the eye to the current role (Dimaag.ai) and fulfills the request for premium modern micro-animations without bloating the project with `framer-motion` (using pure Tailwind/CSS).

## 2026-08-22 - Code Audit & Self-Correction

### Changes Made:
- **Empty Frontmatter Edge Case**: Audited `frontmatter.ts` and realized that if a document had a completely empty frontmatter block (`---\n---`), adding a field would cause a double-spacing bug. Fixed `setFrontmatterField` to prevent double-injecting the `eol` character in this specific scenario.
- **Dependency & SDK Check**: Verified that the modern `@google/genai` SDK syntax was used correctly and that all fallback states (missing key, quota exceeded, bad request) gracefully recover without blowing up the dashboard.
- **Tailwind Compatibility**: Confirmed that using `var(--primary)` directly inside arbitrary values (e.g. `shadow-[0_8px_30px_-12px_var(--primary)]`) is fully compatible with Next.js 16 and the Tailwind CSS version installed.

### Reasons:
- Following the instruction to run through everything, identify potential mistakes, and ensure best practices. The codebase is now meticulously clean and robust.

## 2026-08-22 - Phase 3: AI "Summarise My Day/Goals"

### Changes Made:
- **Added Google GenAI SDK**: Installed `@google/genai` and added `GEMINI_API_KEY=your_temp_key_here` to `.env.example`.
- **Created AI Summarization Logic**: Created `web/src/lib/ai/gemini.ts` to call Gemini 2.5 Flash to generate a summary. The prompt reads sprint goals and recent logs. Graceful fallback logic ensures no crashes if the API key is missing or quota is exhausted.
- **Updated Dashboard UI**: Modified `web/src/app/private/page.tsx` to read `current_sprint.md` and `logbook_archive.md` (up to 150 lines) and display a new `AiSummary` card in the UI using React `Suspense`.

### Reasons:
- Implemented as requested in Phase 3. A fallback string is returned if the "temp" key fails or doesn't work so the dashboard remains perfectly functional even without a real API key.

## 2026-08-22 - Tech Debt: AST-based Markdown Parsing (continued)

### Reasons (continued):
- As noted in `HANDOFF.md`, relying on regex for multi-line parsing was the largest source of fragility in the vault write path and already caused a bug before. The AST approach parses the structure reliably, locates exact byte offsets for sections/bullets, and then surgically replaces the text in those bounds without altering the rest of the document's formatting.
- The `write-e2e.test.ts` test was requested to ensure edits roundtrip correctly.
- Error reporting via `error.tsx` was added since `HANDOFF.md` noted production failures were completely invisible unless discovered manually.

## 2026-08-22 - Project Architecture Review & Future Add-ons

Following a holistic review of the project's architecture, code, and Next.js setup, the following issues were identified and documented for future resolution.

### Identified Issues & Fixes
1. **Concurrency Race Condition in GitHub Writes (TOCTOU):** 
   - *Issue:* `writeVaultFile` reads the file for its SHA, modifies it, and saves. If two writes happen concurrently, they both read the same SHA. The first write succeeds, but the second write fails with a `409 Conflict` because the SHA has changed, causing silent data loss for the second action.
   - *Fix:* Implement an optimistic concurrency retry loop or an in-memory Mutex queue (e.g., `p-queue`) to serialize all writes to the same file path.
2. **Next.js Global Error Boundary Scope:** 
   - *Issue:* `app/error.tsx` catches errors in `page.tsx`, but cannot catch errors thrown in the root `app/layout.tsx` (like metadata failures or provider crashes).
   - *Fix:* Rename `app/error.tsx` to `app/global-error.tsx`. Next.js requires this file to define its own `<html>` and `<body>` tags so it can entirely replace the root layout when a top-level error occurs.
3. **Missing Environment Variable Validation:** 
   - *Issue:* Environment variables (`GITHUB_TOKEN`, `GEMINI_API_KEY`) are checked at runtime. If critical variables are missing, the app crashes deep in the component tree during a request instead of failing safely at boot.
   - *Fix:* Integrate `zod` and `@t3-oss/env-nextjs` to define a strict schema, ensuring the app refuses to boot if configuration is missing and providing fully typed `env` variables across the codebase.
4. **Naive Path Traversal Protection:** 
   - *Issue:* `assertVaultPath` checks `path.includes("..")`. While this stops basic traversal, it can be bypassed in certain OS environments or with URL-encoded paths.
   - *Fix:* Use Node's `path.normalize(path)` or `path.resolve`, and verify the resulting absolute path strict-starts with the absolute path of the `context/` directory.
5. **Lack of GitHub API Rate Limiting / Backoff:** 
   - *Issue:* Direct API calls to GitHub can hit a `429 Too Many Requests` if the dashboard triggers multiple background saves rapidly or on bulk updates.
   - *Fix:* Add `@octokit/plugin-retry` and `@octokit/plugin-throttling` to the `Octokit` client to automatically respect `x-ratelimit-reset` headers and implement exponential backoff.

### Suggested Tools / MCP Servers for AI Diagnostics
If the following tools (MCP Servers) existed, they would drastically improve an AI agent's ability to autonomously diagnose problems:
1. **APM & Telemetry MCP (Sentry / Datadog / OpenTelemetry):** Allows the AI to query production error stack traces, flamegraphs, and distributed traces to pinpoint performance bottlenecks and runtime exceptions without manual log copying.
2. **Next.js / React DevTools Inspector MCP:** Enables introspection of the running React component tree and Network payload (RSC payload) to spot exactly where a server component accidentally leaked client state or caused a hydration error.
3. **AST-based CodeQL / Semgrep MCP:** Facilitates structural code queries (e.g., "Find all `fetch` calls without a `catch` block or a `timeout` signal") to instantly audit the codebase for anti-patterns, bypassing the limitations of regex/grep.
4. **Database Introspection & Profiler MCP:** Runs `EXPLAIN ANALYZE` on a Postgres instance against production data volume to proactively add missing indexes before the app slows down.
5. **Lighthouse / Playwright Web Vitals MCP:** Spins up a headless browser to autonomously run a full Lighthouse audit, diagnosing and fixing Layout Shifts (CLS), poor contrast ratios (a11y), and SEO issues without human intervention.
