"use client";

import { useRouter } from "next/navigation";

import { ExerciseEditForm } from "@/components/site/exercise-edit-form";
import { PageHeader } from "@/components/site/page-shell";

/**
 * Creating a new exercise (V4 Phase 2++ Stage 4).
 *
 * A client component and not `force-dynamic` server metadata like its siblings, because the
 * form it wraps is entirely local — the write goes through the outbox like every other athletics
 * mutation (`lib/athletics/session.ts`), so there is nothing for a server render to contribute.
 */
export default function NewExercisePage() {
  const router = useRouter();

  return (
    <main className="max-w-2xl pb-16">
      <PageHeader eyebrow="Athletics" title="New exercise" />
      <div className="mt-6">
        <ExerciseEditForm
          onCancel={() => router.push("/private/athletics/exercises")}
          onSaved={(entry) =>
            router.push(
              `/private/athletics/exercises/${encodeURIComponent(entry.seedKey ?? entry.name)}`,
            )
          }
        />
      </div>
    </main>
  );
}
