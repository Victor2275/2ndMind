-- Sync columns, the shared cursor sequence, and the trigger that maintains it.
-- V3 §1.2 · docs/SYNC_DESIGN.md §2–§4 and §7 · D-150.
--
-- Hand-edited after `drizzle-kit generate`: drizzle-kit diffs table definitions and has no
-- concept of a sequence or a trigger, so the CREATE SEQUENCE below and the trigger block at
-- the foot of this file were added by hand. The ALTERs between them are generated.
--
-- The sequence MUST be created before the ALTERs, because every `server_seq` column defaults
-- to `nextval('sync_seq')`.
CREATE SEQUENCE "sync_seq";--> statement-breakpoint
ALTER TABLE "ai_summaries" ADD COLUMN "updated_hlc" text DEFAULT '0-0-server' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_summaries" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_summaries" ADD COLUMN "server_seq" bigint DEFAULT nextval('sync_seq') NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_summaries" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bodyweight_entries" ADD COLUMN "updated_hlc" text DEFAULT '0-0-server' NOT NULL;--> statement-breakpoint
ALTER TABLE "bodyweight_entries" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "bodyweight_entries" ADD COLUMN "server_seq" bigint DEFAULT nextval('sync_seq') NOT NULL;--> statement-breakpoint
ALTER TABLE "bodyweight_entries" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "log_entries" ADD COLUMN "client_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "log_entries" ADD COLUMN "updated_hlc" text DEFAULT '0-0-server' NOT NULL;--> statement-breakpoint
ALTER TABLE "log_entries" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "log_entries" ADD COLUMN "server_seq" bigint DEFAULT nextval('sync_seq') NOT NULL;--> statement-breakpoint
ALTER TABLE "rehab_completions" ADD COLUMN "updated_hlc" text DEFAULT '0-0-server' NOT NULL;--> statement-breakpoint
ALTER TABLE "rehab_completions" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "rehab_completions" ADD COLUMN "server_seq" bigint DEFAULT nextval('sync_seq') NOT NULL;--> statement-breakpoint
ALTER TABLE "rehab_completions" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "client_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "updated_hlc" text DEFAULT '0-0-server' NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "server_seq" bigint DEFAULT nextval('sync_seq') NOT NULL;--> statement-breakpoint
ALTER TABLE "workout_sets" ADD COLUMN "updated_hlc" text DEFAULT '0-0-server' NOT NULL;--> statement-breakpoint
ALTER TABLE "workout_sets" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "workout_sets" ADD COLUMN "server_seq" bigint DEFAULT nextval('sync_seq') NOT NULL;--> statement-breakpoint
ALTER TABLE "workout_sets" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workouts" ADD COLUMN "updated_hlc" text DEFAULT '0-0-server' NOT NULL;--> statement-breakpoint
ALTER TABLE "workouts" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "workouts" ADD COLUMN "server_seq" bigint DEFAULT nextval('sync_seq') NOT NULL;--> statement-breakpoint
ALTER TABLE "workouts" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "ai_summaries_server_seq_idx" ON "ai_summaries" USING btree ("server_seq");--> statement-breakpoint
CREATE INDEX "bodyweight_server_seq_idx" ON "bodyweight_entries" USING btree ("server_seq");--> statement-breakpoint
CREATE UNIQUE INDEX "log_entries_client_id_idx" ON "log_entries" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "log_entries_server_seq_idx" ON "log_entries" USING btree ("server_seq");--> statement-breakpoint
CREATE INDEX "rehab_server_seq_idx" ON "rehab_completions" USING btree ("server_seq");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_client_id_idx" ON "tasks" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "tasks_server_seq_idx" ON "tasks" USING btree ("server_seq");--> statement-breakpoint
CREATE INDEX "workout_sets_server_seq_idx" ON "workout_sets" USING btree ("server_seq");--> statement-breakpoint
CREATE INDEX "workouts_server_seq_idx" ON "workouts" USING btree ("server_seq");--> statement-breakpoint
-- One sequence shared by every syncable table, so a single cursor orders changes across all
-- of them. Per-table sequences would need the phone to track seven cursors and would still not
-- give a total order.
--
-- Maintained by a trigger rather than by application code. Application discipline fails
-- silently here, and the failure mode is "changes stop reaching the phone" — which nobody
-- notices until data is missing. A trigger cannot be forgotten in a new code path.
--
-- `updated_hlc` is deliberately NOT touched: that is the client's clock and the thing
-- last-write-wins compares. `updated_at` is the server's receipt. Two clocks, two jobs.
CREATE FUNCTION bump_sync_seq() RETURNS trigger AS $$
BEGIN
  NEW.server_seq := nextval('sync_seq');
  NEW.updated_at := now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "workouts_bump_sync_seq" BEFORE INSERT OR UPDATE ON "workouts"
  FOR EACH ROW EXECUTE FUNCTION bump_sync_seq();--> statement-breakpoint
CREATE TRIGGER "workout_sets_bump_sync_seq" BEFORE INSERT OR UPDATE ON "workout_sets"
  FOR EACH ROW EXECUTE FUNCTION bump_sync_seq();--> statement-breakpoint
CREATE TRIGGER "tasks_bump_sync_seq" BEFORE INSERT OR UPDATE ON "tasks"
  FOR EACH ROW EXECUTE FUNCTION bump_sync_seq();--> statement-breakpoint
CREATE TRIGGER "log_entries_bump_sync_seq" BEFORE INSERT OR UPDATE ON "log_entries"
  FOR EACH ROW EXECUTE FUNCTION bump_sync_seq();--> statement-breakpoint
CREATE TRIGGER "bodyweight_entries_bump_sync_seq" BEFORE INSERT OR UPDATE ON "bodyweight_entries"
  FOR EACH ROW EXECUTE FUNCTION bump_sync_seq();--> statement-breakpoint
CREATE TRIGGER "rehab_completions_bump_sync_seq" BEFORE INSERT OR UPDATE ON "rehab_completions"
  FOR EACH ROW EXECUTE FUNCTION bump_sync_seq();--> statement-breakpoint
CREATE TRIGGER "ai_summaries_bump_sync_seq" BEFORE INSERT OR UPDATE ON "ai_summaries"
  FOR EACH ROW EXECUTE FUNCTION bump_sync_seq();
