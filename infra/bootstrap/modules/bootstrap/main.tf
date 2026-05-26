# ============================================================================
# Bootstrap module.
#
# Renders a cloud-init YAML payload that:
#   1. Installs Docker, the compose plugin, git, and a couple of utilities.
#   2. Writes the rendered compose/.env contents to disk.
#   3. Writes the bootstrap.sh script to /opt/boringstack/bootstrap.sh.
#   4. Runs the script once (clones the monorepo, then kicks off
#      `STACK=prod ./scripts/compose-up.sh`).
#
# Cloud-init handles ONLY the bare-minimum install + run-once. The actual
# stack wiring lives in bootstrap.sh — readable bash, easy to test, versioned
# in this repo. When something fails on first boot, the operator can ssh in
# and `bash -x /opt/boringstack/bootstrap.sh` to debug.
# ============================================================================

locals {
  # Derive the GHCR namespace and image names from the monorepo URL. Release
  # workflows publish distinct packages from the same repo:
  # ghcr.io/<owner>/<repo>-api and ghcr.io/<owner>/<repo>-ui.
  # e.g. "https://github.com/boringstack-xyz/boringstack" →
  # ("boringstack-xyz", "boringstack-api", "boringstack-ui")
  # ghcr.io paths are case-insensitive but conventionally lowercase.
  _normalized_monorepo_repo = trimsuffix(
    replace(replace(var.monorepo_repo, "https://github.com/", ""), "git@github.com:", ""),
    ".git"
  )
  _monorepo_parts = split("/", local._normalized_monorepo_repo)

  image_owner    = lower(element(local._monorepo_parts, 0))
  repo_name      = lower(element(local._monorepo_parts, 1))
  api_image_name = "${local.repo_name}-api"
  ui_image_name  = "${local.repo_name}-ui"

  compose_env_values = {
    stack                      = "prod"
    public_ui_host             = var.domain
    acme_email                 = var.acme_email
    image_owner                = local.image_owner
    api_image_name             = local.api_image_name
    ui_image_name              = local.ui_image_name
    postgres_password          = var.postgres_password
    valkey_password            = var.valkey_password
    jwt_secret                 = var.jwt_secret
    email_provider             = var.email_provider
    email_from                 = var.email_from
    cloudflare_account_id      = var.cloudflare_account_id
    cloudflare_email_api_token = var.cloudflare_email_api_token
    resend_api_key             = var.resend_api_key
    sendgrid_api_key           = var.sendgrid_api_key
    google_oauth_client_id     = var.google_oauth_client_id
    google_oauth_client_secret = var.google_oauth_client_secret
    github_oauth_client_id     = var.github_oauth_client_id
    github_oauth_client_secret = var.github_oauth_client_secret
    stripe_secret_key          = var.stripe_secret_key
    stripe_webhook_secret      = var.stripe_webhook_secret
    sentry_dsn                 = var.sentry_dsn
    vite_sentry_dsn            = var.vite_sentry_dsn
    superuser_email            = var.superuser_email
    superuser_password         = var.superuser_password
  }

  # Docker Compose treats single-quoted .env values literally, avoiding
  # accidental interpolation if a copied secret contains '$' or '#'.
  compose_env = {
    for key, value in local.compose_env_values : key => "'${replace(value, "'", "\\'")}'"
  }

  env_file_contents = templatefile("${path.module}/templates/compose.env.tftpl", local.compose_env)

  bootstrap_config_json = jsonencode({
    monorepo_repo         = var.monorepo_repo
    backups_enabled       = var.backups_enabled
    rclone_remote_name    = var.rclone_remote_name
    rclone_remote_path    = var.rclone_remote_path
    backup_retention_days = var.backup_retention_days
  })

  cloud_init = templatefile("${path.module}/templates/cloud-init.yaml.tftpl", {
    env_file_contents     = local.env_file_contents
    bootstrap_script      = file("${path.module}/templates/bootstrap.sh")
    bootstrap_config_json = local.bootstrap_config_json
  })
}
