-- Business metrics for the cluster Grafana come from CloudNativePG's metrics
-- exporter running aggregate queries (sign-ups per day, active users, paid
-- accounts per plan, cancellations per day, Stripe event counts) defined in
-- infra/k3s/overlays/prod/monitoring/cnpg-business-queries.yaml.
-- The exporter is not a superuser: it runs as pg_monitor (CNPG <= 1.26) or as
-- cnpg_metrics_exporter, which inherits pg_monitor. Granting to the built-in
-- pg_monitor role covers both and exists in every environment.
--
-- Column-level on purpose: only what the counts need. No emails, names, IPs,
-- user agents, audit metadata, password or MFA material, or Stripe identifiers.
GRANT USAGE ON SCHEMA "audit", "auth", "billing" TO pg_monitor;
--> statement-breakpoint
GRANT SELECT ("created_at") ON "auth"."users" TO pg_monitor;
--> statement-breakpoint
GRANT SELECT ("user_id", "action", "created_at") ON "audit"."audit_log" TO pg_monitor;
--> statement-breakpoint
GRANT SELECT ("plan_id", "status", "source", "revoked_at", "updated_at") ON "billing"."account_plans" TO pg_monitor;
--> statement-breakpoint
GRANT SELECT ("id", "name") ON "billing"."plans" TO pg_monitor;
--> statement-breakpoint
GRANT SELECT ("type") ON "billing"."stripe_webhook_events" TO pg_monitor;
