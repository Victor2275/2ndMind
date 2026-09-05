<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 2ndMind Web

Read `context.md` in this directory before doing anything here. It states the scope,
architecture, and non-negotiables.

Read `DECISIONS.md` before changing anything that looks deliberate. Every non-obvious choice
is logged there with its reason and how to reverse it. If Victor asks for something to be
undone, look it up first — several entries bundle a bug fix with a style choice and say
explicitly which half must survive a reversal. Add an entry for every decision you make.

Four rules that are easy to violate by accident:

1. **Public routes must never import a private loader or read a non-whitelisted field.**
   The vault at `../context/` holds a GPA, per-course grades, transcripts, and a phone number.
   Public pages are statically generated, so anything they read is baked into a world-readable
   bundle.
2. **The vault is written through the GitHub Contents API, never `fs.writeFile`.**
   Vercel functions run on an ephemeral read-only filesystem. Filesystem writes work locally
   and fail silently in production.
3. **Never hard-code anything sensitive in a `"use client"` component.**
   Client components compile into `/_next/static/chunks/`, served without authentication —
   confirmed by finding private-page UI copy fetchable by anyone. Private data may reach these
   components as props at render time; it may not appear in their source, including
   placeholders, examples, and default values.
4. **A `"use server"` module may only export async functions.**
   Exporting a constant from one is a build error, not a lint nit. Non-async shared values go
   in a plain module — see `lib/sprint-goals.ts`. This has been got wrong twice.

5. **Hiding a field from the markup does not hide it from the bundle.**
   Public pages are statically generated, so anything left in a projection in
   `lib/vault/public.ts` ships whether or not a component renders it. When Victor asks for
   something hidden, take it out of the projection — see D-114, where pursuit `facts` held
   erg splits he had just made private.

Commands: `npm run dev`, `npm test`, `npm run typecheck`, `npm run build`, `npm run shots`, `npm run e2e`
(layout and resume page-count gate, dev server must be running), `npm run freeze` (offline
snapshot of the site).
