# ============================================================================
# Top-level composition.
#
# This file wires three modules:
#   1. bootstrap  - renders cloud-init YAML from variables + bootstrap.sh
#   2. hetzner    - creates the VPS (passes the cloud-init as user_data) + SSH
#                   key + firewall scoped to Cloudflare IPs
#   3. cloudflare - DNS records + opinionated zone settings + www→apex redirect
#
# Run order is implicit from data dependencies: bootstrap renders first, the
# Hetzner module consumes it as user_data, Cloudflare records point at the
# Hetzner server's IP.
# ============================================================================

terraform {
  required_version = ">= 1.12.0"

  required_providers {
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "~> 1.48"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
    http = {
      source  = "hashicorp/http"
      version = "~> 3.4"
    }
  }

  # --------------------------------------------------------------------------
  # Remote state (OPT-IN). Default is local state — a terraform.tfstate file on
  # the operator's machine. That's fine for a quick spin-up, but it is a single
  # point of failure for anything long-lived: lose the machine (or the file)
  # and you lose the ability to plan, reconcile, or safely destroy the stack —
  # made worse now that the VPS carries delete_protection. Move state to
  # Cloudflare R2 (S3-compatible, no egress fees, an account you already have):
  #
  #   1. Create an R2 bucket and an R2 API token (Object Read & Write).
  #   2. cp backend.hcl.example backend.hcl   # gitignored; fill in bucket + account id
  #   3. export AWS_ACCESS_KEY_ID=<r2 access key id>
  #      export AWS_SECRET_ACCESS_KEY=<r2 secret access key>
  #   4. Uncomment the block below, then migrate the existing local state:
  #        tofu init -backend-config=backend.hcl -migrate-state
  #
  # R2 speaks the S3 API, so we use the s3 backend with AWS-specific preflight
  # disabled and native lockfile locking (S3 conditional writes — no DynamoDB;
  # requires OpenTofu >= 1.10, already guaranteed by required_version above).
  # --------------------------------------------------------------------------
  # backend "s3" {
  #   region                      = "auto" # R2 ignores it, but the s3 backend still requires a value
  #   use_lockfile                = true   # state locking via S3 conditional writes (no DynamoDB)
  #   use_path_style              = true
  #   skip_credentials_validation = true
  #   skip_region_validation      = true
  #   skip_requesting_account_id  = true
  #   skip_metadata_api_check     = true
  #   skip_s3_checksum            = true # R2 rejects the AWS streaming-checksum trailer
  #   # bucket, key, endpoints.s3 -> backend.hcl (see backend.hcl.example)
  # }
}

provider "hcloud" {
  token = var.hetzner_api_token
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# ----------------------------------------------------------------------------
# Render the cloud-init payload first; both Hetzner (as user_data) and the
# operator (via DEPLOY.md debugging) may want to inspect it.
# ----------------------------------------------------------------------------

module "bootstrap" {
  source = "./modules/bootstrap"

  domain        = var.domain
  monorepo_repo = var.monorepo_repo

  # Compose stack secrets
  jwt_secret        = var.jwt_secret
  postgres_password = var.postgres_password
  valkey_password   = var.valkey_password
  acme_email        = var.acme_email

  # Optional integrations
  email_provider               = var.email_provider
  email_from                   = var.email_from
  cloudflare_account_id        = var.cloudflare_account_id
  cloudflare_email_api_token   = var.cloudflare_email_api_token
  resend_api_key               = var.resend_api_key
  sendgrid_api_key             = var.sendgrid_api_key
  google_oauth_client_id       = var.google_oauth_client_id
  google_oauth_client_secret   = var.google_oauth_client_secret
  github_oauth_client_id       = var.github_oauth_client_id
  github_oauth_client_secret   = var.github_oauth_client_secret
  linkedin_oauth_client_id     = var.linkedin_oauth_client_id
  linkedin_oauth_client_secret = var.linkedin_oauth_client_secret
  stripe_secret_key            = var.stripe_secret_key
  stripe_webhook_secret        = var.stripe_webhook_secret
  sentry_dsn                   = var.sentry_dsn
  vite_sentry_dsn              = var.vite_sentry_dsn

  # Backups
  backups_enabled       = var.backups_enabled
  rclone_remote_name    = var.rclone_remote_name
  rclone_remote_path    = var.rclone_remote_path
  backup_retention_days = var.backup_retention_days

  # Optional first-boot superuser
  superuser_email    = var.superuser_email
  superuser_password = var.superuser_password

  # Private GHCR auth
  ghcr_username = var.ghcr_username
  ghcr_token    = var.ghcr_token
}

# ----------------------------------------------------------------------------
# Hetzner: server + SSH key + firewall (Cloudflare IPs for 80/443, configurable
# for SSH). Cloud-init runs once on first boot from the rendered payload.
# ----------------------------------------------------------------------------

module "hetzner" {
  source = "./modules/hetzner"

  vps_name        = var.vps_name
  vps_type        = var.vps_type
  vps_location    = var.vps_location
  vps_image       = var.vps_image
  ssh_public_key  = var.ssh_public_key
  ssh_allowed_ips = var.ssh_allowed_ips
  cloud_init      = module.bootstrap.cloud_init
  prevent_destroy = var.prevent_server_destroy
}

# ----------------------------------------------------------------------------
# Cloudflare: A/AAAA for apex + api., CNAME for www., zone settings + redirect.
# ----------------------------------------------------------------------------

module "cloudflare" {
  source = "./modules/cloudflare"

  zone_id    = var.cloudflare_zone_id
  domain     = var.domain
  server_ip  = module.hetzner.ipv4
  server_ip6 = module.hetzner.ipv6

  enable_bot_blocking          = var.enable_bot_blocking
  bot_block_paths              = var.bot_block_paths
  block_suspicious_user_agents = var.block_suspicious_user_agents
  enable_auth_rate_limit       = var.enable_auth_rate_limit
  auth_rate_limit_requests     = var.auth_rate_limit_requests
  auth_rate_limit_period       = var.auth_rate_limit_period
  enable_edge_cache            = var.enable_edge_cache
  enable_dnssec                = var.enable_dnssec
}
