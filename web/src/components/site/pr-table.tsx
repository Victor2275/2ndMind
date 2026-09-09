"use client";

import { SearchIcon } from "lucide-react";
import { useMemo, useState } from "react";

import { searchExercises } from "@/lib/athletics/exercise-search";
import type { StrengthRecord } from "@/lib/athletics/prs";

/**
 * Every strength record, searchable (V4 Phase 2.6, Q409).
 *
 * ## Why a table and not more cards
 *
 * The cards above it show the twelve most recent movements, which is the right answer to "what
 * have I been doing". It is the wrong answer to the question this is for: **you are standing at
 * a rack and want to know what you did last time.** That is a lookup, it is about one exercise
 * you can already name, and it has to work when the exercise is the fortieth most recent rather
 * than the third.
 *
 * So: one row per movement, all of them, with a search box. Rows are deliberately dense and the
 * numbers are monospaced — this is read at arm's length, in a hurry, and column alignment is
 * what makes a number scannable rather than readable.
 *
 * The same fuzzy matcher the exercise picker uses, so `bnch` finds it here too and there is one
 * idea of what "searching for a movement" means in this app.
 *
 * Nothing sensitive may appear in this file — it compiles into `/_next/static/chunks/`.
 */

const CELL = "px-2 py-1.5 font-mono text-xs";

export function PrTable({ records }: { records: StrengthRecord[] }) {
  const [query, setQuery] = useState("");

  // `searchExercises` ranks by `name`, so the records are adapted to that shape rather than the
  // matcher being taught a second one.
  const shown = useMemo(() => {
    const named = records.map((record) => ({ name: record.exercise, record }));
    return searchExercises(named, query, 200).map((row) => row.record);
  }, [records, query]);

  if (records.length === 0) return null;

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold tracking-tight">All records</h2>
        <span className="font-mono text-xs text-muted-foreground">
          {shown.length === records.length
            ? `${records.length} movements`
            : `${shown.length} of ${records.length}`}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <SearchIcon className="icon-sm shrink-0 text-muted-foreground" aria-hidden />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find a movement"
          aria-label="Find a movement"
          autoComplete="off"
          className="w-full rounded-md border border-border bg-card/60 px-2.5 py-1.5 text-sm text-foreground transition-colors focus:border-primary/60 focus:outline-none"
        />
      </div>

      {/* Wide content scrolls inside itself rather than pushing the page sideways. */}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[30rem] border-collapse">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-2 py-1.5 eyebrow text-muted-foreground">Movement</th>
              <th className="px-2 py-1.5 text-right eyebrow text-muted-foreground">Heaviest</th>
              <th className="px-2 py-1.5 text-right eyebrow text-muted-foreground">e1RM</th>
              <th className="px-2 py-1.5 text-right eyebrow text-muted-foreground">Sets</th>
              <th className="px-2 py-1.5 text-right eyebrow text-muted-foreground">Last</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((record) => (
              <tr key={record.exercise} className="border-b border-border/50">
                <td className="px-2 py-1.5 text-sm text-foreground">{record.exercise}</td>
                <td className={`${CELL} text-right`}>
                  {record.heaviest ? `${record.heaviest.weightLbs} × ${record.heaviest.reps}` : "—"}
                </td>
                <td className={`${CELL} text-right`}>{record.bestE1rm?.e1rm ?? "—"}</td>
                <td className={`${CELL} text-right text-muted-foreground`}>{record.workingSets}</td>
                <td className={`${CELL} text-right text-muted-foreground`}>
                  {record.lastPerformed.toISOString().slice(0, 10)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {shown.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">Nothing matches “{query.trim()}”.</p>
      )}
    </section>
  );
}
