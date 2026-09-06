import { NextResponse } from "next/server";

import { db, isDatabaseConfigured } from "@/lib/db/client";
import { entriesBetween } from "@/lib/log/queries";
import { cronRequestIsAuthentic, localDayBounds } from "@/lib/push/cron";
import { notifyAllDevices } from "@/lib/push/send";

/**
 * The evening nudge (V3 §4.1, D-185). Scheduled for ~21:00 Pacific by `vercel.json`.
 *
 * **It is silent when the day has been logged**, and that is the whole design. A reminder that
 * arrives every evening regardless is a reminder you learn to swipe away in a week, at which
 * point it costs attention and buys nothing. This one only ever appears on a day that would
 * otherwise have no record, so its presence carries the information.
 *
 * "Logged" means any entry at all, in any category, in Victor's own day — not the server's.
 * A day boundary computed in UTC would call an entry made at 5pm Pacific "tomorrow" and stay
 * quiet on a day that really was empty.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!cronRequestIsAuthentic(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "no database" }, { status: 503 });
  }

  const { start, end, label } = localDayBounds();
  const logged = await entriesBetween(db(), start, end);

  if (logged.length > 0) {
    // Reported rather than silent-in-the-logs too: a job that does nothing and says nothing is
    // indistinguishable from a job that did not run.
    return NextResponse.json({ day: label, logged: logged.length, sent: 0, reason: "logged" });
  }

  const result = await notifyAllDevices({
    title: "Nothing logged today",
    body: "A line about training, study or reading takes fifteen seconds.",
    url: "/private/log",
    // One tag for this job, so two quiet days replace rather than stack.
    tag: "evening-nudge",
  });

  return NextResponse.json({ day: label, logged: 0, ...result });
}
