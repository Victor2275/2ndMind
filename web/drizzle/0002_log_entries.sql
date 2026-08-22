CREATE TABLE "log_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"search_text" text DEFAULT '' NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "log_entries_occurred_at_idx" ON "log_entries" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "log_entries_category_idx" ON "log_entries" USING btree ("category");