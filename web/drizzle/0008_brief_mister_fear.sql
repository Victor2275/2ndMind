CREATE TABLE "filament_spools" (
	"id" serial PRIMARY KEY NOT NULL,
	"material" text NOT NULL,
	"brand" text DEFAULT '' NOT NULL,
	"colour_name" text DEFAULT '' NOT NULL,
	"colour_hex" text,
	"grams_remaining" integer DEFAULT 0 NOT NULL,
	"grams_full" integer DEFAULT 1000 NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "printers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'idle' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "filament_spools_remaining_idx" ON "filament_spools" USING btree ("grams_remaining");