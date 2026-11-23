CREATE TABLE "app"."feedback_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"moment" varchar(32) NOT NULL,
	"state" varchar(16) DEFAULT 'shown' NOT NULL,
	"answer" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."product_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" varchar(40) NOT NULL,
	"context" varchar(40) DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."feedback_answers" ADD CONSTRAINT "feedback_answers_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "app"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."feedback_answers" ADD CONSTRAINT "feedback_answers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."product_events" ADD CONSTRAINT "product_events_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "app"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."product_events" ADD CONSTRAINT "product_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_feedback_answers_user_moment" ON "app"."feedback_answers" USING btree ("user_id","moment");--> statement-breakpoint
CREATE INDEX "idx_feedback_answers_account_id" ON "app"."feedback_answers" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_feedback_answers_created_at" ON "app"."feedback_answers" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_product_events_account_id_created_at" ON "app"."product_events" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_product_events_created_at" ON "app"."product_events" USING btree ("created_at");