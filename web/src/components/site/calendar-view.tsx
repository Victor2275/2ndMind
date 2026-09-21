"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * The agenda/month switch (V4 §5.8, Q422 — *"I also want to be able to switch between calendar
 * view and agenda view"*).
 *
 * Both views are rendered on the server and handed in as children. That is the whole design:
 * this component owns a boolean and nothing else, so switching costs no request, no loader, and
 * no second copy of the event-reading logic. The calendar page is `force-dynamic` and its feeds
 * are one parse — rendering both and showing one is cheaper than fetching twice.
 *
 * The choice is remembered per device, the same way the log's tab is (D-291), and read in an
 * effect for the same reason: `localStorage` does not exist while the server renders, so seeding
 * state from it is a hydration mismatch. The first paint is the agenda — the view that answers
 * "what do I have next" — and a remembered month view arrives a frame later.
 *
 * Nothing sensitive may be hard-coded here; this compiles into `/_next/static/chunks/`. The
 * events themselves never reach this file: they are already HTML by the time they arrive.
 */

const KEY = "2m_calendar_view";

type View = "agenda" | "month";

export function CalendarView({ agenda, month }: { agenda: ReactNode; month: ReactNode }) {
  const [view, setView] = useState<View>("agenda");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(KEY);
      if (stored === "month" || stored === "agenda") setView(stored);
    } catch {
      // A private window, or site data blocked. The agenda is the right default anyway.
    }
  }, []);

  const choose = (next: View) => {
    setView(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // The view still switches; it just will not be remembered.
    }
  };

  return (
    <div>
      {/* A two-state switch, not two buttons that happen to look related: `aria-pressed` says
          which one is on, and the group is labelled so a screen reader hears what it switches. */}
      <div
        role="group"
        aria-label="Calendar view"
        className="mb-4 inline-flex gap-1 rounded-control border border-border p-1"
      >
        {(["agenda", "month"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => choose(option)}
            aria-pressed={view === option}
            className={`min-h-11 press rounded-control px-3 text-xs capitalize transition-colors duration-fast ease-standard ${
              view === option
                ? "bg-primary/12 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      {/* Both subtrees stay mounted and one is hidden, so switching back does not re-run the
          `<details>` state, the scroll position or anything else the browser owns. */}
      <div hidden={view !== "agenda"}>{agenda}</div>
      <div hidden={view !== "month"}>{month}</div>
    </div>
  );
}
