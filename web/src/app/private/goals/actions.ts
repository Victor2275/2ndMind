"use server";

import { revalidatePath } from "next/cache";

import { draftSprintGoals } from "@/lib/ai/goal-drafts";
import { requireSession } from "@/lib/auth/dal";
import { db, isDatabaseConfigured } from "@/lib/db/client";
import { isCalendarConfigured, loadCalendars } from "@/lib/calendar/load";
import { summarise } from "@/lib/log/categories";
import { entriesBetween } from "@/lib/log/queries";
import { applyApprovals, fingerprint, isStale, type ProposalState } from "@/lib/proposals/types";
import { GOAL_DOMAINS, type ActionState } from "@/lib/sprint-goals";
import {
  currentGoals,
  dayBounds,
  listDoneBetween,
  listTasks,
  replaceGoals,
  zoneOffsetMinutes,
} from "@/lib/tasks/queries";

/**
 * Draft next week's goals, and apply the parts Victor approves.
 *
 * Both actions begin with `requireSession()`. A Server Action is a POST endpoint with a
 * guessable id, so being reachable only from a page behind `proxy.ts` is not protection.
 *
 * The model never writes. `proposeGoals` returns a proposal; `approveGoals` takes the values
 * that came back from the review UI. Between them sits a human, which is the entire point of
 * §2.1 and the reason these are two actions rather than one.
 */

const WEEK_MS = 7 * 86_400_000;

function describe(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("DATABASE_URL")) return message;
  if (message.includes("relation") && message.includes("does not exist")) {
    return "The tasks table is missing. Run `npm run db:migrate`.";
  }
  return message;
}

/** Current goals as the proposal layer sees them: one entry per domain, blank when unset. */
async function goalState(): Promise<{ key: string; value: string }[]> {
  const rows = await currentGoals(db());
  return GOAL_DOMAINS.map((d) => ({
    key: d.key,
    value: rows.find((r) => r.domain === d.key)?.title ?? "",
  }));
}

export async function proposeGoals(
  _prev: ProposalState | null,
  _formData: FormData,
): Promise<ProposalState> {
  await requireSession();
  if (!isDatabaseConfigured()) {
    return { ok: false, message: "DATABASE_URL is not set, so there is nothing to draft from." };
  }

  const now = new Date();
  const { start, end } = dayBounds(now, zoneOffsetMinutes(now));
  const weekAgo = new Date(start.getTime() - WEEK_MS);

  try {
    const handle = db();
    const [current, done, open] = await Promise.all([
      goalState(),
      listDoneBetween(handle, weekAgo, end),
      listTasks(handle, { limit: 50 }),
    ]);

    // Log lines are one-line summaries only, the same reduction the daily summary makes: it
    // keeps the prompt small and means no more of the log reaches Google than the question
    // needs. Health data does not travel through this path at all — bodyweight and rehab are
    // their own tables and are not read here.
    let weekLog = "";
    try {
      const entries = await entriesBetween(handle, weekAgo, end);
      weekLog = entries.map((e) => `- ${summarise(e.category, e.data, e.note)}`).join("\n");
    } catch (error) {
      console.error("Goal draft: could not read the week's log:", error);
    }

    let upcoming = "";
    if (isCalendarConfigured()) {
      try {
        // A calendar that is slow or down must not stop Victor drafting goals, so this is a
        // best-effort addition to the prompt rather than a precondition.
        const { google, canvas } = await loadCalendars(end, new Date(end.getTime() + WEEK_MS));
        upcoming = [...google.events, ...canvas.events]
          .slice(0, 20)
          .map((event) => `- ${event.summary}`)
          .join("\n");
      } catch (error) {
        console.error("Goal draft: could not read the calendar:", error);
      }
    }

    const result = await draftSprintGoals({
      domains: GOAL_DOMAINS.map((d) => ({ key: d.key, label: d.label })),
      currentGoals: current
        .filter((c) => c.value !== "")
        .map((c) => `- ${c.key}: ${c.value}`)
        .join("\n"),
      weekTasks: [
        ...done.map((t) => `- done: ${t.title}`),
        ...open.filter((t) => !t.doneAt && t.source !== "goal").map((t) => `- open: ${t.title}`),
      ].join("\n"),
      weekLog,
      upcoming,
    });

    if (!result.ok) return { ok: false, message: result.message };

    const byDomain = new Map(result.goals.map((g) => [g.domain, g]));

    return {
      ok: true,
      message: `Proposed ${result.goals.length} goal(s). Nothing is saved until you approve.`,
      proposal: {
        kind: "sprint-goals",
        // Every domain, not only the ones the model spoke to: a domain it skipped should
        // still be visible and editable, otherwise the review shows a partial picture.
        items: GOAL_DOMAINS.map((d) => {
          const before = current.find((c) => c.key === d.key)?.value ?? "";
          const draft = byDomain.get(d.key);
          return {
            key: d.key,
            label: d.label,
            before: before === "" ? null : before,
            after: draft?.title ?? before,
            ...(draft?.why ? { note: draft.why } : {}),
          };
        }),
        // Captured from the same read the proposal was built on, so approving after an edit
        // elsewhere is detected rather than silently overwriting it.
        basis: fingerprint(current),
        generatedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    return { ok: false, message: describe(error) };
  }
}

export async function approveGoals(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();
  if (!isDatabaseConfigured()) {
    return { ok: false, message: "DATABASE_URL is not set, so there is nowhere to save this." };
  }

  const basis = String(formData.get("basis") ?? "");

  // Only ticked items. An unticked one is not sent, so it carries through untouched — that is
  // how rejection leaves no trace, and it needs no branch of its own.
  const approvals = GOAL_DOMAINS.filter((d) => formData.get(`approve:${d.key}`) === "on").map(
    (d) => ({ key: d.key, value: String(formData.get(`value:${d.key}`) ?? "") }),
  );

  if (approvals.length === 0) {
    return { ok: false, message: "Nothing approved, so nothing was changed." };
  }

  try {
    const current = await goalState();

    // Recomputed here, never taken from the form. The check is against what the database says
    // right now, which is the only thing that can tell us the world moved.
    if (isStale({ basis }, current)) {
      return {
        ok: false,
        message:
          "The goals changed since this was drafted, so nothing was saved. Draft again to " +
          "see them against the current set.",
      };
    }

    const next = applyApprovals(current, approvals);
    await replaceGoals(
      db(),
      next.map((n) => ({ domain: n.key, title: n.value })),
    );

    revalidatePath("/private");
    return { ok: true, message: `Approved ${approvals.length}, saved ${next.length} goal(s).` };
  } catch (error) {
    return { ok: false, message: describe(error) };
  }
}
