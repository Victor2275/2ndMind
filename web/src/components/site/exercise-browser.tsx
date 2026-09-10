"use client";

import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ExerciseList } from "@/components/site/exercise-list";
import { SYNC_DONE_EVENT } from "@/components/site/sync-runner";
import { localCatalogue, localEfforts, mergeCatalogue, withLocal } from "@/lib/athletics/local";
import type { LocalExercise } from "@/lib/athletics/local";
import type { Effort } from "@/lib/athletics/prs";

/**
 * The standalone exercise browser at `/private/athletics/exercises` (V4 Phase 2++ Stage 4).
 *
 * Reads the phone, same as `SessionLogger` and for the same reason (D-224): the catalogue is
 * bundled, merged with whatever the device has mirrored, and available before any network call
 * completes. `ExerciseList` is the component this shares with the logger's picker sheet.
 */
export function ExerciseBrowser() {
  const [mirrored, setMirrored] = useState<LocalExercise[]>([]);
  const [efforts, setEfforts] = useState<Effort[]>([]);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    const bump = () => setGeneration((n) => n + 1);
    window.addEventListener(SYNC_DONE_EVENT, bump);
    return () => window.removeEventListener(SYNC_DONE_EVENT, bump);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void withLocal(async (db) => {
      const [list, history] = await Promise.all([localCatalogue(db), localEfforts(db)]);
      if (cancelled) return;
      setMirrored(list);
      setEfforts(history);
    });
    return () => {
      cancelled = true;
    };
  }, [generation]);

  const catalogue = useMemo(() => mergeCatalogue(mirrored), [mirrored]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Link
          href="/private/athletics/exercises/new"
          className="flex min-h-10 items-center gap-1.5 rounded-md border border-dashed border-border px-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        >
          <PlusIcon className="icon-sm" aria-hidden />
          New exercise
        </Link>
      </div>
      <ExerciseList entries={catalogue} efforts={efforts} />
    </div>
  );
}
