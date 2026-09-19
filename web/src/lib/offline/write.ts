import { searchTextFor, UNSORTED_CATEGORY, writableCategoryByKey } from "@/lib/log/categories";
import { readField, readRows, takeBodyweight } from "@/lib/log/form";
import { readTags } from "@/lib/log/tags";
import { HlcClock } from "@/lib/sync/hlc";
import { deviceId, enqueue, loadClock, openSyncDb, saveClock } from "@/lib/sync/store";
import type { ActionState } from "@/lib/sprint-goals";

/**
 * Writing a log entry with no signal (V3 §2.2).
 *
 * The same `FormData` the Server Action reads, put into the outbox instead of into Postgres.
 * That is the whole trick: §1.2 built the local store and §1.3 built the flush, so an entry
 * enqueued here is picked up by the ordinary sync loop and sent the moment there is a network,
 * by exactly the path `roundtrip.test.ts` already covers. Nothing new had to be trusted.
 *
 * **It reuses the reading half rather than reimplementing it.** `readField`, `readRows` and
 * `takeBodyweight` are the same functions the action calls, so an entry written on a plane and
 * an entry written at a desk are shaped identically. Two parsers for one form is how a field
 * ends up meaning one thing offline and another thing online, and nothing would ever say so.
 *
 * What is deliberately *not* here: `summarise`. The server derives the summary line and the
 * search text on insert, so computing them here would be a second implementation racing the
 * first. Only `searchText` is sent, because the column is `notNull` and the phone's copy has to
 * be searchable before it has ever synced.
 */

/** The shape `useActionState` wants, so this drops into the same form as the Server Action. */
export type LocalWrite = (prev: ActionState | null, formData: FormData) => Promise<ActionState>;

/**
 * Writes the entry into the outbox and returns what the form should say.
 *
 * `onWritten` is how the caller asks for a flush without this module importing a component.
 */
export function localLogWriter(onWritten?: () => void): LocalWrite {
  return async (_prev, formData) => {
    const key = String(formData.get("category") ?? "");
    const category = writableCategoryByKey(key);
    if (!category) return { ok: false, message: "Unknown category." };

    const note = String(formData.get("note") ?? "").trim();

    const data: Record<string, unknown> = {};
    for (const field of category.fields) {
      const value = readField(formData, field);
      if (value !== null && value !== false) data[field.name] = value;
    }

    const rows = category.rows ? readRows(formData, category.rows) : [];
    if (category.rows && rows.length > 0) data[category.rows.name] = rows;

    const tags = readTags(formData);

    const { weight, problem } = takeBodyweight(data);

    if (
      Object.keys(data).length === 0 &&
      note === "" &&
      tags.length === 0 &&
      weight === null &&
      problem === null
    ) {
      return { ok: false, message: "Nothing to log — fill in a field or write a note." };
    }

    const dayRaw = String(formData.get("occurredOn") ?? "").trim();
    const backdated = /^\d{4}-\d{2}-\d{2}$/.test(dayRaw);
    // Noon local rather than midnight, same as the action: a midnight timestamp rendered in a
    // zone behind UTC shows as the previous day.
    const occurredAt = backdated ? new Date(`${dayRaw}T19:00:00Z`) : new Date();

    try {
      const db = await openSyncDb();
      try {
        /**
         * One clock, ticked once per op, and saved before the writes are done.
         *
         * Loading it fresh each time rather than holding a module-level instance: two tabs of
         * the installed app would otherwise each hold their own copy of a clock that is
         * supposed to be per-device, and issue colliding stamps.
         */
        const clock = new HlcClock(await deviceId(db), Date.now, await loadClock(db));

        const wrote = Object.keys(data).length > 0 || note !== "" || tags.length > 0;
        if (wrote) {
          await enqueue(db, {
            entity: "log_entry",
            op: "create",
            row: {
              clientId: crypto.randomUUID(),
              category: key,
              occurredAt: occurredAt.toISOString(),
              note,
              data,
              searchText: searchTextFor(key, data, note),
              tags,
            },
            hlc: clock.tick(),
          });
        }

        if (weight !== null) {
          await enqueue(db, {
            entity: "bodyweight",
            op: "create",
            // `measuredOn` is the natural key, so a second weigh-in on the same day replaces
            // the first rather than creating a duplicate — offline and online alike.
            row: { measuredOn: localDay(occurredAt), weightLbs: weight, note: "" },
            hlc: clock.tick(),
          });
        }

        await saveClock(db, clock.state);
        onWritten?.();

        const saved = wrote ? `Saved to ${category.label} on this phone.` : "Weighed in.";
        return {
          ok: true,
          // §5.2: the entry is safe and it is not on the server, and those are different.
          queued: true,
          message: problem ? `${saved} ${problem}` : `${saved} It will send when you reconnect.`,
        };
      } finally {
        db.close();
      }
    } catch {
      // IndexedDB refused — a private window, or a blocked upgrade. Saying so is the only
      // honest answer: there is nowhere to put this and the form still holds what was typed.
      return {
        ok: false,
        message: "This device will not open its local store, so the entry was not saved.",
      };
    }
  };
}

/**
 * The capture box with no signal (D-164).
 *
 * Same two destinations as the Server Action — an unsorted note, or a task in the inbox — and
 * both are writable entities, so both go into the outbox and are sent by the ordinary flush.
 * Filing them happens later, online, on a screen that needs a server anyway.
 */
export function localCaptureWriter(onWritten?: () => void): LocalWrite {
  return async (_prev, formData) => {
    const text = String(formData.get("text") ?? "").trim();
    if (text === "") return { ok: false, message: "Write it down first." };

    const asTask = String(formData.get("as") ?? "note") === "task";

    try {
      const db = await openSyncDb();
      try {
        const clock = new HlcClock(await deviceId(db), Date.now, await loadClock(db));

        if (asTask) {
          await enqueue(db, {
            entity: "task",
            op: "create",
            row: {
              clientId: crypto.randomUUID(),
              title: text,
              source: "inbox",
              domain: null,
              courseCode: null,
              dueAt: null,
              doneAt: null,
              notes: "",
            },
            hlc: clock.tick(),
          });
        } else {
          await enqueue(db, {
            entity: "log_entry",
            op: "create",
            row: {
              clientId: crypto.randomUUID(),
              category: UNSORTED_CATEGORY,
              occurredAt: new Date().toISOString(),
              note: text,
              data: {},
              searchText: searchTextFor(UNSORTED_CATEGORY, {}, text),
            },
            hlc: clock.tick(),
          });
        }

        await saveClock(db, clock.state);
        onWritten?.();
        return {
          ok: true,
          queued: true,
          message: asTask ? "Held as a task. It will send." : "Noted. It will send.",
        };
      } finally {
        db.close();
      }
    } catch {
      return {
        ok: false,
        message: "This device will not open its local store, so it was not saved.",
      };
    }
  };
}

/**
 * The local day as `YYYY-MM-DD`.
 *
 * `toISOString()` answers in UTC, and from 5pm in California onward that is already tomorrow —
 * which would file an evening's weigh-in under the wrong day. Same trap the action and the
 * cached panels each already document.
 */
function localDay(at: Date): string {
  return new Date(at.getTime() - at.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}
