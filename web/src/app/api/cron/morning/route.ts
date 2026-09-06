import { NextResponse } from "next/server";

import { db, isDatabaseConfigured } from "@/lib/db/client";
import { listDueBy } from "@/lib/tasks/queries";
import { cronRequestIsAuthentic, localDayBounds } from "@/lib/push/cron";
import { notifyAllDevices } from "@/lib/push/send";

/**
 * The morning digest (V3 §4.1, D-185). Scheduled for ~08:00 Pacific by `vercel.json`.
 *
 * One message naming what is due by the end of today, from the tasks table — which is where
 * Canvas assignments and Google calendar items already land, so this needs no second source.
 *
 * **Silent when nothing is due**, for the same reason the evening job is silent on a logged
 * day: the plan itself flagged this trigger as the one most likely to duplicate notifications
 * Canvas and Google already send, and a digest that arrives every morning saying "nothing" is
 * the fastest way to teach someone to ignore the channel.
 *
 * The body names up to three, then counts the rest. A notification is read in a glance on a
 * lock screen; a list of nine is a wall that gets dismissed unread, and the count is enough to
 * decide whether to open the app.
 */
export const dynamic = "force-dynamic";

const NAMED = 3;

export async function GET(request: Request) {
  if (!cronRequestIsAuthentic(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "no database" }, { status: 503 });
  }

  const { end, label } = localDayBounds();
  const due = await listDueBy(db(), end);

  if (due.length === 0) {
    return NextResponse.json({ day: label, due: 0, sent: 0, reason: "nothing due" });
  }

  const named = due.slice(0, NAMED).map((task) => task.title);
  const rest = due.length - named.length;
  const body = rest > 0 ? `${named.join(" · ")} — and ${rest} more` : named.join(" · ");

  const result = await notifyAllDevices({
    title: due.length === 1 ? "One thing due today" : `${due.length} things due today`,
    body,
    url: "/private",
    tag: "morning-digest",
  });

  return NextResponse.json({ day: label, due: due.length, ...result });
}
