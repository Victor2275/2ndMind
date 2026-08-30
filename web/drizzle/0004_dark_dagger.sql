CREATE TABLE "ai_summaries" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"period_start" date NOT NULL,
	"summary" text NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ai_summaries_kind_period_idx" ON "ai_summaries" USING btree ("kind","period_start");--> statement-breakpoint
CREATE INDEX "ai_summaries_period_idx" ON "ai_summaries" USING btree ("period_start");