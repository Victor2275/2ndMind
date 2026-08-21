CREATE TABLE "workout_sets" (
	"id" serial PRIMARY KEY NOT NULL,
	"workout_id" integer NOT NULL,
	"exercise" text NOT NULL,
	"set_index" integer DEFAULT 0 NOT NULL,
	"set_type" text DEFAULT 'normal' NOT NULL,
	"weight_lbs" numeric(7, 2),
	"reps" integer,
	"distance_m" numeric(10, 2),
	"duration_s" integer,
	"spm" integer,
	"rpe" numeric(4, 2)
);
--> statement-breakpoint
CREATE TABLE "workouts" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_id" text,
	"performed_at" timestamp with time zone NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workout_sets" ADD CONSTRAINT "workout_sets_workout_id_workouts_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workout_sets_workout_id_idx" ON "workout_sets" USING btree ("workout_id");--> statement-breakpoint
CREATE INDEX "workout_sets_exercise_idx" ON "workout_sets" USING btree ("exercise");--> statement-breakpoint
CREATE UNIQUE INDEX "workouts_external_id_idx" ON "workouts" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "workouts_performed_at_idx" ON "workouts" USING btree ("performed_at");