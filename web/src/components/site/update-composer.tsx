"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { publishUpdate } from "@/app/private/now/actions";
import type { ActionState } from "@/lib/sprint-goals";

/**
 * Writing an update onto the public Working page.
 *
 * Nothing sensitive may be hard-coded here: this compiles into `/_next/static/chunks/`, which
 * is served without authentication. The project list arrives as a prop at render time, and it
 * is public content anyway.
 */

export type ActiveProject = { slug: string; title: string; updateCount: number };

function PublishButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-primary/50 px-4 py-2 text-sm text-primary transition-colors hover:border-primary hover:bg-primary/10 disabled:opacity-60"
    >
      {/* "Committing" rather than "Saving": this is a git commit and a rebuild, not a row
          update, and the wait is long enough that calling it a save would feel broken. */}
      {pending ? "Committing…" : "Publish update"}
    </button>
  );
}

export function UpdateComposer({
  projects,
  today,
}: {
  projects: ActiveProject[];
  today: string;
}) {
  const [state, action] = useActionState<ActionState | null, FormData>(publishUpdate, null);
  const [slug, setSlug] = useState(projects[0]?.slug ?? "");

  // The textarea is uncontrolled and remounts when this key changes, which empties it.
  //
  // Clearing optimistically in the submit handler would lose a written paragraph whenever
  // GitHub timed out, and this writer has an 8s deadline, so that is a real Tuesday. Clearing
  // from an effect is the other obvious move and React rejects it outright. Keying on the
  // commit URL — unique per success, unchanged on failure — resets on exactly the right edge
  // with no state of its own.
  const draftKey = state?.ok ? (state.url ?? "committed") : "draft";

  if (projects.length === 0) {
    return (
      <p className="rounded-md border border-border bg-card/40 px-4 py-3 text-sm text-muted-foreground">
        No project is marked <code className="font-mono text-xs">status: active</code>. Set that
        in a project&apos;s frontmatter and it appears here and on /now.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <div className="min-w-[12rem] flex-1">
          <label
            htmlFor="update-slug"
            className="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-muted-foreground"
          >
            Project
          </label>
          <select
            id="update-slug"
            name="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-card/70 px-3 py-2 text-sm text-foreground focus:border-primary/60 focus:outline-none"
          >
            {projects.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.title}
                {p.updateCount === 0 ? " — no updates yet" : ` — ${p.updateCount}`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="update-date"
            className="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-muted-foreground"
          >
            Date
          </label>
          {/* Editable, because updates get written up on a Sunday for something that happened
              on Wednesday, and the date is the public label. */}
          <input
            id="update-date"
            name="date"
            type="date"
            defaultValue={today}
            className="mt-1 rounded-md border border-border bg-card/70 px-3 py-2 font-mono text-sm text-foreground focus:border-primary/60 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="update-body"
          className="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-muted-foreground"
        >
          What happened
        </label>
        <textarea
          key={draftKey}
          id="update-body"
          name="body"
          rows={5}
          defaultValue=""
          placeholder="Markdown. This is published — write it for someone who has not seen the project."
          className="mt-1 w-full rounded-md border border-border bg-card/70 px-3 py-2 text-sm leading-relaxed text-foreground focus:border-primary/60 focus:outline-none"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <PublishButton />
        {state && (
          <p
            role="status"
            className={
              state.ok
                ? "text-xs text-muted-foreground"
                : "text-xs text-destructive-foreground"
            }
          >
            {state.message}
            {state.url && (
              <>
                {" "}
                <a href={state.url} className="link-wipe text-primary">
                  commit
                </a>
              </>
            )}
          </p>
        )}
      </div>
    </form>
  );
}
