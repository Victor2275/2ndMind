import { z } from "zod";

import { ENTITIES, WRITABLE, type Entity } from "@/lib/sync/entities";

/**
 * The wire format between the phone and `/api/sync` (V3 §1.3, `docs/SYNC_DESIGN.md` §6–§7).
 *
 * Shared by both sides on purpose: the client builds requests from these schemas and the
 * server validates with the same ones, so a field added on one side cannot silently fail to
 * arrive on the other. Nothing here may import `server-only` — this module is in the browser
 * bundle, which also means **nothing sensitive belongs in it**. Shapes and field names only.
 */

/** ISO strings on the wire; the server coerces to `Date` at the column boundary. */
const isoDate = z.iso.datetime({ offset: true });

/**
 * Per-entity payload schemas. These are the *only* columns the phone may set — deliberately
 * not the whole row. `server_seq`, `updated_at` and `id` are the server's, and a client that
 * could set them could rewrite the cursor and make its own changes invisible to itself.
 */
export const PAYLOADS = {
  log_entry: z.object({
    clientId: z.uuid(),
    category: z.string().min(1).max(64),
    occurredAt: isoDate,
    note: z.string().max(20_000).default(""),
    data: z.record(z.string(), z.unknown()).default({}),
    searchText: z.string().max(40_000).default(""),
  }),
  task: z.object({
    clientId: z.uuid(),
    title: z.string().min(1).max(2_000),
    source: z.string().max(32).default("manual"),
    domain: z.string().max(64).nullable().default(null),
    courseCode: z.string().max(64).nullable().default(null),
    dueAt: isoDate.nullable().default(null),
    doneAt: isoDate.nullable().default(null),
    notes: z.string().max(20_000).default(""),
  }),
  bodyweight: z.object({
    measuredOn: z.iso.date(),
    weightLbs: z.number().positive().max(2_000),
    note: z.string().max(2_000).default(""),
  }),
  rehab: z.object({
    completedOn: z.iso.date(),
    slug: z.string().min(1).max(128),
  }),
} as const;

export type WritableEntity = keyof typeof PAYLOADS;

/** Compile-time proof that `PAYLOADS` and `WRITABLE` cannot drift apart. */
const _writableCovered: Record<WritableEntity, true> = {
  log_entry: true,
  task: true,
  bodyweight: true,
  rehab: true,
};
void _writableCovered;

export const opSchema = z.object({
  opId: z.uuid(),
  entity: z.enum(WRITABLE as unknown as [WritableEntity, ...WritableEntity[]]),
  op: z.enum(["create", "update", "delete"]),
  clientId: z.string().min(1).max(256),
  payload: z.record(z.string(), z.unknown()),
  hlc: z.string().min(3).max(128),
});

export type WireOp = z.infer<typeof opSchema>;

/**
 * 100 is a guess (`SYNC_DESIGN.md` §11.3). The only cost of being wrong is latency on the
 * first sync after a long gap, and the cap is enforced server-side so a client bug cannot ask
 * for an unbounded batch.
 */
export const MAX_OPS = 100;
export const MAX_CHANGES = 100;

export const syncRequestSchema = z.object({
  ops: z.array(opSchema).max(MAX_OPS),
  /** The highest `server_seq` this device has already merged. */
  since: z.number().int().nonnegative(),
});

export type SyncRequest = z.infer<typeof syncRequestSchema>;

/**
 * What happened to one op. Four of the five mean "stop sending this" — only `rejected` is a
 * failure, and the distinction is the whole reason ops carry an `opId`.
 */
export type OpStatus =
  | "applied" // written
  | "duplicate" // this exact op had already landed; a retry after a lost response
  | "stale" // a newer write already won, so the op is satisfied
  | "superseded" // a later op in the same batch overwrote it before it was written
  | "rejected"; // permanent: malformed, unknown entity, bad payload

export type OpResult = { opId: string; status: OpStatus; reason?: string };

export type ChangeRow = {
  entity: Entity;
  row: Record<string, unknown>;
  updatedHlc: string;
  deletedAt: string | null;
  serverSeq: number;
};

export type SyncResponse = {
  results: OpResult[];
  changes: ChangeRow[];
  /** The new watermark. Only ever advances past changes actually included. */
  cursor: number;
  /** True when more changes are waiting above `cursor` — flush again rather than waiting. */
  hasMore: boolean;
};

/** Guard used by the client when narrowing an unknown entity from the wire. */
export function isEntity(value: unknown): value is Entity {
  return typeof value === "string" && (ENTITIES as readonly string[]).includes(value);
}
