CREATE TABLE "auth"."session_retired_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth"."session_retired_tokens" ADD CONSTRAINT "session_retired_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_session_retired_tokens_hash_unique" ON "auth"."session_retired_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_session_retired_tokens_family_id" ON "auth"."session_retired_tokens" USING btree ("family_id");
--> statement-breakpoint
/*
 * Backfill the one generation of replay evidence the sessions table already
 * holds. `previous_token_hash` is what refresh used to detect a replay; the
 * lookup now goes through this table, so without this every credential
 * already retired before the upgrade becomes an unknown token — refused,
 * but no longer triggering family revocation or an audit event, which is
 * the whole point of detecting a replay.
 *
 * `ON CONFLICT DO NOTHING` because the hash is unique here and a session
 * could in principle share one with a row inserted after deploy.
 */
INSERT INTO "auth"."session_retired_tokens" ("session_id", "family_id", "token_hash")
SELECT "id", "family_id", "previous_token_hash"
FROM "auth"."sessions"
WHERE "previous_token_hash" IS NOT NULL
ON CONFLICT ("token_hash") DO NOTHING;
