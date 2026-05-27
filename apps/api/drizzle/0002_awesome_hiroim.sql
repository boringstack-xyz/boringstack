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
ALTER TABLE "app"."account_ownership_transfers" ADD CONSTRAINT "account_ownership_transfers_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "app"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."account_ownership_transfers" ADD CONSTRAINT "account_ownership_transfers_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."account_ownership_transfers" ADD CONSTRAINT "account_ownership_transfers_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_account_ownership_transfers_account_id" ON "app"."account_ownership_transfers" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_account_ownership_transfers_token_hash" ON "app"."account_ownership_transfers" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_account_ownership_transfers_pending" ON "app"."account_ownership_transfers" USING btree ("account_id") WHERE accepted_at IS NULL AND declined_at IS NULL AND cancelled_at IS NULL;
