CREATE TABLE "error_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"fingerprint" text NOT NULL,
	"source" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"stack" text DEFAULT '' NOT NULL,
	"route" text DEFAULT '' NOT NULL,
	"build_id" text DEFAULT '' NOT NULL,
	"agent" text DEFAULT '' NOT NULL,
	"seen_count" integer DEFAULT 1 NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "error_reports_fingerprint_idx" ON "error_reports" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "error_reports_last_seen_idx" ON "error_reports" USING btree ("last_seen_at");