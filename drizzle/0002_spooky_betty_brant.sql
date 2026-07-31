CREATE TABLE "voyager_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"subject" text NOT NULL,
	"day" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "voyager_usage_subject_day_idx" ON "voyager_usage" USING btree ("subject","day");