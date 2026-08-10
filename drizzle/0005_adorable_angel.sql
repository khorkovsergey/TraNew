CREATE TABLE "product_telemetry_event" (
	"id" text PRIMARY KEY NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"occurred_at" timestamp NOT NULL,
	"received_at" timestamp NOT NULL,
	"event_name" text NOT NULL,
	"event_kind" text NOT NULL,
	"surface" text,
	"route_template" text,
	"session_id" text NOT NULL,
	"visitor_key_hash" text,
	"user_key_hash" text,
	"auth_state" text NOT NULL,
	"entitlement" text,
	"acquisition_source" text,
	"device_class" text,
	"feature_state" text NOT NULL,
	"properties" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "telemetry_occurred_idx" ON "product_telemetry_event" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "telemetry_name_occurred_idx" ON "product_telemetry_event" USING btree ("event_name","occurred_at");--> statement-breakpoint
CREATE INDEX "telemetry_session_occurred_idx" ON "product_telemetry_event" USING btree ("session_id","occurred_at");--> statement-breakpoint
CREATE INDEX "telemetry_surface_occurred_idx" ON "product_telemetry_event" USING btree ("surface","occurred_at");--> statement-breakpoint
CREATE INDEX "telemetry_user_occurred_idx" ON "product_telemetry_event" USING btree ("user_key_hash","occurred_at");--> statement-breakpoint
CREATE INDEX "telemetry_received_idx" ON "product_telemetry_event" USING btree ("received_at");