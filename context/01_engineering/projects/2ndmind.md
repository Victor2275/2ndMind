---
updated: 2026-09-12
domain: engineering
stability: volatile
summary: Personal knowledge vault that publishes itself — a public portfolio and a private second brain over one markdown source of truth.
read_when: Portfolio; what Victor is working on now; how the site and vault are built.
title: 2ndMind
slug: 2ndmind
order: 8
status: active
year: 2026
category: software
tags: [web, full-stack, ai, pwa, self-hosted]
stack: [Next.js, TypeScript, React, Tailwind, Postgres, Drizzle, WebAuthn]
links:
  github: https://github.com/Victor2275/2ndMind
  live: https://victorgusev.com
image: /assets/2ndmind.png
resume_variants: []
public: true
bullets:
  - >-
    Built a full-stack Next.js app that renders one markdown vault as two surfaces: a
    statically generated public portfolio and an auth-gated private second brain
  - >-
    Implemented self-hosted WebAuthn passkey authentication with no user table and no
    third-party auth vendor, backed by Postgres for enrolled credentials
  - >-
    Shipped an installable offline-first PWA with a service worker, IndexedDB outbox, and a
    hybrid-logical-clock sync engine reconciling writes made with no connection
  - >-
    Designed a public-field allowlist enforced by tests so private data — training logs,
    grades, health metrics — cannot reach the public bundle even by accident
---

# 2ndMind

This site. A personal knowledge vault, written in markdown, that renders itself as two
different surfaces from one source of truth: a static public portfolio for hiring managers,
and an authenticated private tool Victor actually uses daily — training log, task tracker,
calendar, resume tailoring, and a daily/weekly AI summary.

## The problem

Most portfolio sites are a one-time export: write a resume, paste it into a template, forget
it until the next job search. The vault behind this one is alive year-round — training data,
coursework, project notes — and a portfolio that cannot read from the same place it is
written to always drifts out of date. The private half had to be worth opening every day, or
logging would migrate back to whatever app already existed for it.

## Architecture

Next.js App Router over one markdown vault. Public routes are built from an explicit
per-field allowlist rather than the raw vault entry, so a private field added tomorrow is
private by default — a test fails the build if a public route ever imports a private loader.
Private routes are server-rendered and session-gated, reading and writing the same files
through the GitHub Contents API (Vercel functions have no writable filesystem and no git
binary).

Auth is self-hosted WebAuthn — a passkey ceremony plus a signed session cookie, no vendor,
because there is exactly one user. Training and log data live in Postgres (Neon + Drizzle);
everything else — projects, experience, coursework, brand, standards — is markdown, read at
request time.

The private app is also an installable PWA: a service worker, an IndexedDB-backed outbox, and
a hybrid-logical-clock sync engine that reconciles edits made with no connection, built and
proven against a real database rather than a mock.

## What did not work

The original plan used Clerk for passkey auth. Its passkey tier is Pro-only and priced for
multi-tenant products — pure overhead for an app with exactly one account — so it was dropped
for a hand-rolled WebAuthn ceremony with the credential stored as plainly as the threat model
allows.

An early version of offline support passed every automated test and still froze on real plane
wifi: `navigator.onLine` reports `true` on a connection that answers nothing, and a `fetch`
with no deadline never rejects. Fixing it meant treating "connected" and "reachable" as two
different, separately-tested claims.

## Measured results

1,738 tests across 119 files as of this writing, covering session forgery/expiry, vault
frontmatter parsing, the public-field allowlist, and sync conflict resolution against a real
embedded Postgres rather than a mock. The offline round trip is proven end to end on a real
phone: a training session logged in airplane mode reaches the database exactly once on
reconnect.

## Updates

### 2026-09-12

Made the source public and added self-serve device enrollment: a new passkey now finishes
enrolling itself the moment the browser ceremony completes, with no environment edit and no
redeploy, backed by a small Postgres table instead of an env var.

### 2026-09-10

Phase 6 closed: link previews, a real favicon, an About page that leads with a claim, the
resume PDF as the primary download, and four hand-authored system diagrams.

## Notes

The repository was private during development and made public once a full pass confirmed no
secrets or personal records were tracked — `.env.example` never carries real values, and
`context/99_archive/`, `context/private/` and saved DARS audits are gitignored outright.

`resume_variants: []` is deliberate, not an oversight: this entry is meant to live on
`/projects` and `/now` for now, not on a printed resume yet. Add a variant here when it
should appear on one.
