ALTER TABLE "log_entries" ADD COLUMN "tags" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "tags" text[] DEFAULT ARRAY[]::text[] NOT NULL;