---
description: Run the weekly 2ndMind sprint ritual — close out the past week, set next week's goals, check freshness.
---

Run the weekly sprint ritual for the 2ndMind vault. Do these steps in order:

1. Read `context/04_operations/current_sprint.md`. Summarize what it currently says (goals, academic tracker checkboxes) back to me in a few lines.
2. Ask me what got done this week and what didn't, one question at a time if needed — don't guess.
3. Append a short bulleted entry to `context/04_operations/logbook_archive.md` under "Past Sprint Summaries" for the week that's closing. Keep it to what I actually tell you; no invented detail.
4. Rewrite `context/04_operations/current_sprint.md`'s "Active Sprint Goals" section with the three priorities I give you for the new week (Engineering/Career, Athletics, Academics). Update the Academic Tracker checkboxes if I mention anything upcoming.
5. Bump `updated:` in the frontmatter of both files to today's date.
6. Run `python scripts/audit_freshness.py` and tell me if anything else in the vault is flagged stale.
7. Show me a `git diff` of both files before committing anything, and only commit if I confirm.
