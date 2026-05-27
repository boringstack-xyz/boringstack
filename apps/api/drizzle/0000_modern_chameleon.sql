CREATE SCHEMA "app";
--> statement-breakpoint
CREATE SCHEMA "audit";
--> statement-breakpoint
CREATE SCHEMA "auth";
--> statement-breakpoint
CREATE SCHEMA "billing";
--> statement-breakpoint
CREATE SCHEMA "notifications";
--> statement-breakpoint
CREATE TABLE "app"."account_feature_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"feature_key" varchar(100) NOT NULL,
	"value" jsonb NOT NULL,
	"expires_at" timestamp with time zone,
	"reason" text DEFAULT '' NOT NULL,
	"visibility" varchar(16) DEFAULT 'internal' NOT NULL,
	"granted_by_user_id" uuid NOT NULL,
	"granted_by_membership_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by_user_id" uuid,
	"revoked_reason" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "app"."account_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"email" varchar(320) NOT NULL,
	"role_to_assign" varchar(32) NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"invited_by_membership_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_invitations_token_hash_key" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "app"."account_join_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"email" varchar(320) NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "app"."account_ownership_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"from_user_id" uuid NOT NULL,
	"to_user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"declined_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_ownership_transfers_token_hash_key" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "app"."accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"stripe_customer_id" varchar(255),
	"claimed_domain" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "accounts_stripe_customer_id_key" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
CREATE TABLE "app"."widgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit"."audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"actor_membership_id" uuid,
	"target_account_id" uuid,
	"target_user_id" uuid,
	"target_membership_id" uuid,
	"action" varchar(100) NOT NULL,
	"resource" varchar(255),
	"request_id" varchar(64),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip" varchar(64),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit"."redactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"original_user_id_hash" varchar(64) NOT NULL,
	"redacted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reason" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"family_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"previous_token_hash" varchar(64),
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."email_verification_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_verification_tokens_token_hash_key" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "auth"."password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_hash_key" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "auth"."user_auth_providers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(50) NOT NULL,
	"provider_user_id" varchar(255) NOT NULL,
	"password_hash" varchar(255) DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_auth_providers_provider_provider_user_id_key" UNIQUE("provider","provider_user_id")
);
--> statement-breakpoint
CREATE TABLE "auth"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"first_name" varchar(100) DEFAULT '' NOT NULL,
	"last_name" varchar(100) DEFAULT '' NOT NULL,
	"email_verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_platform_admin" boolean DEFAULT false NOT NULL,
	CONSTRAINT "users_email_key" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "billing"."account_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"plan_id" integer NOT NULL,
	"status" varchar(32) NOT NULL,
	"current_period_end" timestamp with time zone,
	"source" varchar(32) DEFAULT 'stripe' NOT NULL,
	"stripe_subscription_id" varchar(255),
	"stripe_subscription_created_at" timestamp with time zone,
	"last_stripe_event_id" varchar(255),
	"last_stripe_event_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "billing"."plan_features" (
	"plan_id" integer NOT NULL,
	"feature_key" varchar(100) NOT NULL,
	"value" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_features_pkey" PRIMARY KEY("plan_id","feature_key")
);
--> statement-breakpoint
CREATE TABLE "billing"."plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"stripe_price_id" varchar(255) DEFAULT '' NOT NULL,
	"stripe_product_id" varchar(255) DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_name_key" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "billing"."stripe_webhook_events" (
	"event_id" varchar(255) PRIMARY KEY NOT NULL,
	"type" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth"."account_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(32) NOT NULL,
	"invited_by_user_id" uuid,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_reason" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "notifications"."notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"rendered" jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'unread' NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications"."notification_dedup" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dedup_key" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications"."notification_delivery" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" uuid NOT NULL,
	"channel" varchar(30) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications"."notification_preference" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"channel" varchar(30) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications"."push_subscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh_key" text NOT NULL,
	"auth_key" text NOT NULL,
	"user_agent" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."account_feature_overrides" ADD CONSTRAINT "account_feature_overrides_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "app"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."account_feature_overrides" ADD CONSTRAINT "account_feature_overrides_granted_by_user_id_fkey" FOREIGN KEY ("granted_by_user_id") REFERENCES "auth"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."account_invitations" ADD CONSTRAINT "account_invitations_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "app"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."account_join_requests" ADD CONSTRAINT "account_join_requests_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "app"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."account_join_requests" ADD CONSTRAINT "account_join_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."account_ownership_transfers" ADD CONSTRAINT "account_ownership_transfers_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "app"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."account_ownership_transfers" ADD CONSTRAINT "account_ownership_transfers_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."account_ownership_transfers" ADD CONSTRAINT "account_ownership_transfers_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."widgets" ADD CONSTRAINT "widgets_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "app"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit"."audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."user_auth_providers" ADD CONSTRAINT "user_auth_providers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."account_plans" ADD CONSTRAINT "account_plans_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "app"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."account_plans" ADD CONSTRAINT "account_plans_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "billing"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing"."plan_features" ADD CONSTRAINT "plan_features_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "billing"."plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."account_memberships" ADD CONSTRAINT "account_memberships_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "app"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth"."account_memberships" ADD CONSTRAINT "account_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications"."notification" ADD CONSTRAINT "notification_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications"."notification_delivery" ADD CONSTRAINT "notification_delivery_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"."notification"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications"."notification_preference" ADD CONSTRAINT "notification_preference_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications"."push_subscription" ADD CONSTRAINT "push_subscription_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_account_feature_overrides_account_id" ON "app"."account_feature_overrides" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_account_feature_overrides_feature_key" ON "app"."account_feature_overrides" USING btree ("feature_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_account_feature_overrides_active" ON "app"."account_feature_overrides" USING btree ("account_id","feature_key") WHERE revoked_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_account_invitations_account_id" ON "app"."account_invitations" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_account_invitations_email" ON "app"."account_invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_account_invitations_token_hash" ON "app"."account_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_account_invitations_active" ON "app"."account_invitations" USING btree ("account_id",lower("email")) WHERE accepted_at IS NULL AND revoked_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_account_join_requests_account_id" ON "app"."account_join_requests" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_account_join_requests_user_id" ON "app"."account_join_requests" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_account_join_requests_pending" ON "app"."account_join_requests" USING btree ("account_id","user_id") WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX "idx_account_ownership_transfers_account_id" ON "app"."account_ownership_transfers" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_account_ownership_transfers_token_hash" ON "app"."account_ownership_transfers" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_account_ownership_transfers_pending" ON "app"."account_ownership_transfers" USING btree ("account_id") WHERE accepted_at IS NULL AND declined_at IS NULL AND cancelled_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_accounts_deleted_at" ON "app"."accounts" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_accounts_claimed_domain" ON "app"."accounts" USING btree ("claimed_domain");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_accounts_claimed_domain_active" ON "app"."accounts" USING btree ("claimed_domain") WHERE claimed_domain IS NOT NULL AND deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_widgets_account_id" ON "app"."widgets" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_audit_log_user_id" ON "audit"."audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_log_action" ON "audit"."audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_audit_log_created_at" ON "audit"."audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_log_target_account_id" ON "audit"."audit_log" USING btree ("target_account_id");--> statement-breakpoint
CREATE INDEX "idx_redactions_original_user_id_hash" ON "audit"."redactions" USING btree ("original_user_id_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_sessions_token_hash_unique" ON "auth"."sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_sessions_previous_token_hash" ON "auth"."sessions" USING btree ("previous_token_hash");--> statement-breakpoint
CREATE INDEX "idx_sessions_family_id" ON "auth"."sessions" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_user_id" ON "auth"."sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_expires_at" ON "auth"."sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_email_verification_tokens_token_hash" ON "auth"."email_verification_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_email_verification_tokens_user_id" ON "auth"."email_verification_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_password_reset_tokens_token_hash" ON "auth"."password_reset_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_password_reset_tokens_user_id" ON "auth"."password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_auth_providers_provider_id" ON "auth"."user_auth_providers" USING btree ("provider","provider_user_id");--> statement-breakpoint
CREATE INDEX "idx_user_auth_providers_user_id" ON "auth"."user_auth_providers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "auth"."users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_is_platform_admin" ON "auth"."users" USING btree ("is_platform_admin");--> statement-breakpoint
CREATE INDEX "idx_account_plans_account_id" ON "billing"."account_plans" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_account_plans_status" ON "billing"."account_plans" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_account_plans_current" ON "billing"."account_plans" USING btree ("account_id") WHERE revoked_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_account_memberships_account_id" ON "auth"."account_memberships" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_account_memberships_user_id" ON "auth"."account_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_account_memberships_active_user" ON "auth"."account_memberships" USING btree ("account_id","user_id") WHERE revoked_at IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_account_memberships_active_owner" ON "auth"."account_memberships" USING btree ("account_id") WHERE role = 'owner' AND revoked_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_notification_recipient_status_created_at" ON "notifications"."notification" USING btree ("recipient_user_id","status","created_at");--> statement-breakpoint
CREATE INDEX "idx_notification_event_type" ON "notifications"."notification" USING btree ("event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_notification_dedup_key_unique" ON "notifications"."notification_dedup" USING btree ("dedup_key");--> statement-breakpoint
CREATE INDEX "idx_notification_dedup_expires_at" ON "notifications"."notification_dedup" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_notification_delivery_notification_channel" ON "notifications"."notification_delivery" USING btree ("notification_id","channel");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_notification_preference_user_event_channel" ON "notifications"."notification_preference" USING btree ("user_id","event_type","channel");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_push_subscription_user_endpoint" ON "notifications"."push_subscription" USING btree ("user_id","endpoint");--> statement-breakpoint
CREATE INDEX "idx_push_subscription_user_id" ON "notifications"."push_subscription" USING btree ("user_id");