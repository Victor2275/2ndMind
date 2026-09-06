# What I need from you

**Written 2026-08-25 · Requested for Thursday 2026-08-27 · You fly 2026-08-29**

Everything here is data only I cannot invent. Nothing in this document asks you to write
prose about a project — that is `docs/V2_PLAN.md` §1.3 and it is separate.

The document is split by **whether it needs a network connection**, because ten days of the
next fortnight are on a plane or in Taiwan. Do §1 before you board. §2 is plane work: a text
editor, no connection, no repo checkout required if you would rather type into notes and paste
later.

---

## 1 · Before you fly — needs a connection (~30 min total)

### 1.1 · Buy the domain — ~10 min, ~$10.50/yr — **DONE 2026-08-25**

Full instructions are in `docs/V2_PLAN.md` §7.1. The short version: **Cloudflare Registrar**, which
sells at cost with no first-year discount that doubles on renewal. Then tell me the registrar
you used, and nothing else — I do not need the account.

**Do this before the passkey work, not after.** Changing the domain invalidates the passkey
you enrolled on `victorgusev.vercel.app`, because a passkey is bound to its origin. Buying
first means you enrol once instead of twice.

> **Done.** `victorgusev.com` is live and canonical; `www` 307s to it. Passkeys are now
> scoped to the apex and accept both origins, so flipping which one is primary can never
> force a re-enrolment again.

### 1.2 · Publish the internship spreadsheet as CSV — ~5 min — **still open**

**Updated 2026-08-30: you can now paste the ordinary link from your address bar.** The app
converts a `/edit#gid=…` URL into Google's CSV export endpoint, so there is nothing to
reformat. What it cannot do is grant access — the site fetches with no Google credentials, so
the sheet has to be readable by an anonymous request. Two ways, and they are not equivalent:

| | What you paste | What becomes readable |
|---|---|---|
| **Publish to web** (File → Share → Publish to web → the applications tab → CSV) | the `/pub?output=csv` link | **only that tab**, as a snapshot Google re-publishes |
| **Link sharing** (Share → General access → Anyone with the link → Viewer) | the ordinary `/edit` link | **the whole spreadsheet** — every tab, to anyone holding the link |

**Prefer Publish to web** if the spreadsheet has any tab you would not put on the open
internet. It is one extra menu and it exposes one tab instead of all of them. Link sharing is
the faster path and the right one only if the entire document is already fine to expose.

Either way, send me the URL — or set `JOB_SHEET_CSV_URL` in Vercel yourself.

> **§7.6 is built and waiting for this URL.** The parser was written and tested against
> your archived export, so the only thing missing is the live link: set
> `JOB_SHEET_CSV_URL` in Vercel and `/private/work` shows the real pipeline. Until then
> that panel explains itself and the rest of the page works.
>
> The archived CSV is a **test fixture, never a fallback** — nothing at runtime reads it.
> Serving months-old applications as though they were current would be worse than saying
> the sheet is unreachable.
>
> **The URL is a credential.** Anyone holding it can read the sheet, so it goes in Vercel
> and never in a file in the repo.

This is the same shape as your calendar feeds, which is why it is cheap: a URL the app fetches
and parses, no OAuth, no Google API project, no cost. Note that **the URL is a credential** —
anyone holding it can read that sheet — so it goes in Vercel's environment variables the way
`GOOGLE_CALENDAR_KEY` does, never into the repo.

**Also paste me the header row and two or three example rows** (redact company names if you
like — I need the *shape*, not the content). With that I can write and test the parser offline
while you are away.

> **Read-only.** Publishing to web gives me read access. *Editing* the sheet from the Jobs tab
> is a much larger job — it needs the real Sheets API, a service account and write scopes. See
> `docs/V2_PLAN.md` §7 for why that one is V3 and what it costs.

### 1.3 · Confirm the four images — ~2 min — **shipped, confirmation still welcome**

These are already in `context/assets/`. I need to know I have them right, and one line of alt
text each. Reply inline:

| File | I assume it is | Correct? | Alt text (one line, for screen readers and SEO) |
|---|---|---|---|
| `5SecondRule.png` | Five Second Rule — hero | | |
| `MicromouseSim.png` | Micromouse Simulator — hero | | |
| `taskable.png` | TaskAble — hero | | |
| `ProfilePhoto.jpg` | You, for the About page | | |

`MicromouseSim.png` is only 6.5 KB, which usually means a small screenshot rather than a
photograph. If a larger version exists, it will look better — D-074 exists because
low-information images cost 180px each on a phone and earn nothing.

> **Answered and shipped.** You said no larger Micromouse image exists, so it runs as-is.
> All four are live (§7.3); TaskAble and Five Second Rule use `image_fit: contain` because
> `cover` cropped their titles off. **Alt text is still the open half** — the images
> currently carry generated descriptions, and one line each from you would replace them.

### 1.4 · The Proof link — ~1 min — **DONE 2026-08-25**

Culinary is being replaced by a link to Proof. Which URL should it point at — the live app, or
the `/projects/proof` case study on this site?

> **Assumed the live app** — <https://proof-cdvj.onrender.com> — since you described Proof
> as the thing you actually use for recipes, and a case study is not that. Say the word and
> it points at `/projects/proof` instead; it is a one-line change.

---

## 2 · On the plane — no connection needed

Fill these in wherever is convenient. Plain text is fine; I will do the formatting.

### 2.1 · Filament inventory — **no longer needed, 2026-09-06**

> **Withdrawn.** Victor's answer was that he wants to add spools on the site rather than hand
> over a table, so the data entry became the feature. `/private/hobbies` now has add and edit
> forms for spools and printers (§5.1, D-189). Nothing below is required.

### 2.1 · Filament inventory (original brief)

One row per spool. **Amount** in whatever you actually measure — grams remaining, or a
fraction, or "about half"; I will normalise it, and a rough number now beats an exact one
never.

```
material | brand | colour name | colour hex (if you know it) | amount left | notes
---------|-------|-------------|----------------------------|-------------|------
PLA      | ...   | ...         | #...                       | ...         | ...
```

- **Colour hex is worth the effort** — it is what lets the site show a real swatch instead of
  a word. If you do not know it, name the colour and I will approximate.
- Include empty or nearly-empty spools; "what am I about to run out of" is half the point.
- If you keep this list somewhere already, send that instead and skip the table.

### 2.2 · Printers

```
name/model | status | notes
-----------|--------|------
...        | ...    | ...
```

For **status**, give me the vocabulary you actually use — the set of states you would want to
see, e.g. `idle / printing / needs maintenance / down`. I would rather build your words than
invent a taxonomy you then have to translate in your head.

Also: what do you want to know at a glance when you open this page? "Which printer is free
right now" and "what do I need to reorder" are different pages, and knowing which one it is
decides the layout.

### 2.3 · Current projects, for the Working page

For each project you are actively working on:

- **Name**
- **One line** on what it is
- **Where it is right now** — the current state, in a sentence or two
- **What is next**
- **Photos you have or want to take** — just describe them; the upload happens later

Three or four is plenty. This page is meant to show motion, so a project with nothing to
report does not belong on it.

### 2.4 · Resumes to publish

You want to upload your own PDFs rather than serve the generated ones. Tell me:

1. **Which files**, and what each should be called publicly ("Resume — Software Engineering").
2. **Which is the default** if someone clicks a bare "Resume" link.
3. **What happens to the generated ones.** Three options, and this one is a real decision:
   - *Replace* — `/resume/swe` serves your PDF. The generator stops being user-facing.
   - *Alongside* — both exist, with the uploaded one primary.
   - *Fallback* — the generated one shows where no upload exists.

   Worth knowing before you choose: the generated resume is built from the same vault entries
   as the project and experience pages, so it cannot drift from them. An uploaded PDF can, and
   silently — it becomes a second source of truth for your bullet points. That is the whole
   cost of this feature, and it is not a reason to skip it, only a reason to pick option 3 if
   you are unsure.

The PDFs themselves need a connection, so send those when you land — or drop them in
`context/assets/resumes/` before you fly if they are on this machine already.

---

## 3 · Not on this list, on purpose

- **Case-study prose** — `docs/V2_PLAN.md` §1.3, 17 sections outstanding. Run
  `python scripts/case_study_status.py` for the live count. Solenoid is one section from
  complete and is the best twenty minutes on the list.
- **Anything I can read from the repo.** If it is already in the vault I will not ask for it.
