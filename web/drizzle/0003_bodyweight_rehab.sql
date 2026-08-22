CREATE TABLE "bodyweight_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"measured_on" date NOT NULL,
	"weight_lbs" numeric(6, 2) NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rehab_completions" (
	"id" serial PRIMARY KEY NOT NULL,
	"completed_on" date NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "bodyweight_measured_on_idx" ON "bodyweight_entries" USING btree ("measured_on");--> statement-breakpoint
CREATE UNIQUE INDEX "rehab_day_slug_idx" ON "rehab_completions" USING btree ("completed_on","slug");--> statement-breakpoint
CREATE INDEX "rehab_completed_on_idx" ON "rehab_completions" USING btree ("completed_on");