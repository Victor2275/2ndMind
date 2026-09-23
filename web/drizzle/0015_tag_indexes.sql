CREATE INDEX "log_entries_tags_idx" ON "log_entries" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "tasks_tags_idx" ON "tasks" USING gin ("tags");