CREATE TABLE "academy_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"stage" text NOT NULL,
	"mode" text NOT NULL,
	"diagnostic" jsonb,
	"diagnostic_step" integer NOT NULL,
	"path_ready" boolean NOT NULL,
	"lessons_done" jsonb,
	"terms_seen" jsonb,
	"questions_asked" integer NOT NULL,
	"completed" boolean NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"kind" text,
	"ref" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"saved_object_id" text,
	"kind" text NOT NULL,
	"ref" text NOT NULL,
	"label" text NOT NULL,
	"condition" jsonb,
	"channels" jsonb,
	"status" text NOT NULL,
	"last_triggered_at" timestamp,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_public" boolean NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_item" (
	"id" text PRIMARY KEY NOT NULL,
	"collection_id" text NOT NULL,
	"saved_object_id" text NOT NULL,
	"position" integer NOT NULL,
	"added_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expert_booking" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expert_ref" text NOT NULL,
	"package_ref" text,
	"status" text NOT NULL,
	"brief_enc" text,
	"shared_context" jsonb,
	"slot_at" timestamp,
	"hold_expires_at" timestamp,
	"purchase_id" text,
	"rating" integer,
	"summary_enc" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "preference" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"display_name" text,
	"timezone" text,
	"base_currency" text NOT NULL,
	"experience" text NOT NULL,
	"goals_enc" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"status" text NOT NULL,
	"external_ref" text,
	"invoice_url" text,
	"purchased_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_object" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"ref" text NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"note_enc" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"plan" text NOT NULL,
	"status" text NOT NULL,
	"interval" text,
	"price_cents" integer,
	"currency" text NOT NULL,
	"started_at" timestamp NOT NULL,
	"renews_at" timestamp,
	"cancelled_at" timestamp,
	"external_ref" text
);
--> statement-breakpoint
CREATE TABLE "voyager_memory" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"content_enc" text NOT NULL,
	"source_event" text,
	"created_at" timestamp NOT NULL,
	"forgotten_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "academy_progress" ADD CONSTRAINT "academy_progress_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert" ADD CONSTRAINT "alert_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert" ADD CONSTRAINT "alert_saved_object_id_saved_object_id_fk" FOREIGN KEY ("saved_object_id") REFERENCES "public"."saved_object"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection" ADD CONSTRAINT "collection_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_item" ADD CONSTRAINT "collection_item_collection_id_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_item" ADD CONSTRAINT "collection_item_saved_object_id_saved_object_id_fk" FOREIGN KEY ("saved_object_id") REFERENCES "public"."saved_object"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expert_booking" ADD CONSTRAINT "expert_booking_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expert_booking" ADD CONSTRAINT "expert_booking_purchase_id_purchase_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchase"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preference" ADD CONSTRAINT "preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase" ADD CONSTRAINT "purchase_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_object" ADD CONSTRAINT "saved_object_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voyager_memory" ADD CONSTRAINT "voyager_memory_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "academy_progress_user_idx" ON "academy_progress" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "activity_user_idx" ON "activity" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "alert_user_idx" ON "alert" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "collection_user_idx" ON "collection" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "collection_item_idx" ON "collection_item" USING btree ("collection_id","saved_object_id");--> statement-breakpoint
CREATE INDEX "expert_booking_user_idx" ON "expert_booking" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "preference_user_key_idx" ON "preference" USING btree ("user_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "profile_user_idx" ON "profile" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "purchase_user_idx" ON "purchase" USING btree ("user_id","purchased_at");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_object_user_kind_ref_idx" ON "saved_object" USING btree ("user_id","kind","ref");--> statement-breakpoint
CREATE INDEX "saved_object_user_created_idx" ON "saved_object" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "subscription_user_idx" ON "subscription" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "voyager_memory_user_idx" ON "voyager_memory" USING btree ("user_id","created_at");