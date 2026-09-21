CREATE TABLE "plan_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_date" date NOT NULL,
	"session_name" text,
	"detail" text,
	"type" text,
	"distance_m" integer,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "plan_overrides_plan_date_idx" ON "plan_overrides" USING btree ("plan_date");