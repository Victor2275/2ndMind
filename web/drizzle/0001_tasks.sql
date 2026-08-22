CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"domain" text,
	"course_code" text,
	"external_id" text,
	"due_at" timestamp with time zone,
	"done_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_external_id_idx" ON "tasks" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "tasks_due_at_idx" ON "tasks" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "tasks_source_idx" ON "tasks" USING btree ("source");