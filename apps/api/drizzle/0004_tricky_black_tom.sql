CREATE TABLE "app"."admin_feed_item_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_key" varchar(200) NOT NULL,
	"state" varchar(16) NOT NULL,
	"observed_count" integer DEFAULT 0 NOT NULL,
	"snoozed_until" timestamp with time zone,
	"actor_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_feed_item_states_item_key_key" UNIQUE("item_key")
);
--> statement-breakpoint
CREATE TABLE "app"."email_campaign_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_campaign_recipients_campaign_user_key" UNIQUE("campaign_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "app"."email_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"status" varchar(16) DEFAULT 'draft' NOT NULL,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" uuid,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."users" ADD COLUMN "marketing_consent_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "idx_email_campaigns_created_at" ON "app"."email_campaigns" USING btree ("created_at");