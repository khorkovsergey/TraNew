CREATE TABLE IF NOT EXISTS "chart_layout" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"state" text NOT NULL,
	"schema_version" integer NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chart_script" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"document" text NOT NULL,
	"schema_version" integer NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"short_description" text NOT NULL,
	"description" text NOT NULL,
	"cover_image_url" text,
	"cover_gradient" text,
	"status" text NOT NULL,
	"visibility" text NOT NULL,
	"format" text NOT NULL,
	"event_type" text NOT NULL,
	"organizer_id" text NOT NULL,
	"source_type" text NOT NULL,
	"external_url" text,
	"external_domain" text,
	"external_trusted" boolean NOT NULL,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"timezone" text NOT NULL,
	"registration_deadline" timestamp,
	"language" jsonb NOT NULL,
	"country" text,
	"city" text,
	"venue_name" text,
	"venue_address" text,
	"latitude" text,
	"longitude" text,
	"online_meeting_url" text,
	"capacity" integer,
	"registration_count" integer NOT NULL,
	"waitlist_count" integer NOT NULL,
	"waitlist_enabled" boolean NOT NULL,
	"price_type" text NOT NULL,
	"price_amount" integer,
	"currency" text,
	"experience_level" text NOT NULL,
	"topics" jsonb NOT NULL,
	"markets" jsonb,
	"tags" jsonb,
	"learning_outcomes" jsonb,
	"intended_audience" text,
	"important_notice" text,
	"agenda" jsonb,
	"speakers" jsonb,
	"is_featured" boolean NOT NULL,
	"is_promoted" boolean NOT NULL,
	"created_by" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL,
	"published_at" timestamp,
	"moderation_reason" text,
	"cancellation_reason" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_bookmark" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_draft" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"event_id" text,
	"payload" jsonb NOT NULL,
	"step" integer NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_metric" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"metric" text NOT NULL,
	"day" timestamp NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_moderation" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"reason" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_notification_preference" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"enabled" boolean NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_registration" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"user_id" text NOT NULL,
	"status" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"company" text,
	"role" text,
	"experience_level" text,
	"event_updates_consent" boolean NOT NULL,
	"terms_accepted" boolean NOT NULL,
	"waitlist_position" integer,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_report" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"reporter_id" text,
	"reason" text NOT NULL,
	"detail" text,
	"resolved" boolean NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organizer" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"initials" text NOT NULL,
	"type" text NOT NULL,
	"verification_status" text NOT NULL,
	"description" text,
	"website" text,
	"country" text,
	"follower_count" integer NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organizer_follow" (
	"id" text PRIMARY KEY NOT NULL,
	"organizer_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "voyager_file" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"bytes" integer NOT NULL,
	"body_enc" text NOT NULL,
	"mode" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "voyager_workspace" (
	"user_id" text PRIMARY KEY NOT NULL,
	"library" text NOT NULL,
	"schema_version" integer NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "role" text NOT NULL DEFAULT 'user';--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "chart_layout" ADD CONSTRAINT "chart_layout_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "chart_script" ADD CONSTRAINT "chart_script_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "event" ADD CONSTRAINT "event_organizer_id_organizer_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizer"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "event" ADD CONSTRAINT "event_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "event_bookmark" ADD CONSTRAINT "event_bookmark_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "event_bookmark" ADD CONSTRAINT "event_bookmark_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "event_draft" ADD CONSTRAINT "event_draft_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "event_draft" ADD CONSTRAINT "event_draft_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "event_metric" ADD CONSTRAINT "event_metric_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "event_moderation" ADD CONSTRAINT "event_moderation_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "event_moderation" ADD CONSTRAINT "event_moderation_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "event_notification_preference" ADD CONSTRAINT "event_notification_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "event_registration" ADD CONSTRAINT "event_registration_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "event_registration" ADD CONSTRAINT "event_registration_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "event_report" ADD CONSTRAINT "event_report_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "event_report" ADD CONSTRAINT "event_report_reporter_id_user_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "organizer" ADD CONSTRAINT "organizer_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "organizer_follow" ADD CONSTRAINT "organizer_follow_organizer_id_organizer_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."organizer"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "organizer_follow" ADD CONSTRAINT "organizer_follow_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "voyager_file" ADD CONSTRAINT "voyager_file_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "voyager_workspace" ADD CONSTRAINT "voyager_workspace_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "chart_layout_user_name_idx" ON "chart_layout" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chart_layout_user_updated_idx" ON "chart_layout" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "chart_script_user_name_idx" ON "chart_script" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chart_script_user_updated_idx" ON "chart_script" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "event_slug_idx" ON "event" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_status_starts_idx" ON "event" USING btree ("status","starts_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_organizer_idx" ON "event" USING btree ("organizer_id","starts_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_created_by_idx" ON "event" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_city_idx" ON "event" USING btree ("country","city");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "event_bookmark_idx" ON "event_bookmark" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_bookmark_user_idx" ON "event_bookmark" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_draft_user_idx" ON "event_draft" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "event_metric_idx" ON "event_metric" USING btree ("event_id","metric","day");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_moderation_event_idx" ON "event_moderation" USING btree ("event_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "event_notification_pref_idx" ON "event_notification_preference" USING btree ("user_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "event_registration_idx" ON "event_registration" USING btree ("event_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_registration_user_idx" ON "event_registration" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_registration_waitlist_idx" ON "event_registration" USING btree ("event_id","waitlist_position");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_report_event_idx" ON "event_report" USING btree ("event_id","resolved");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_report_created_idx" ON "event_report" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organizer_slug_idx" ON "organizer" USING btree ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "organizer_user_idx" ON "organizer" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organizer_follow_idx" ON "organizer_follow" USING btree ("organizer_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "voyager_file_user_idx" ON "voyager_file" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "voyager_file_user_name_idx" ON "voyager_file" USING btree ("user_id","name");