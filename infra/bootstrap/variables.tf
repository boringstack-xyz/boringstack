# ============================================================================
# Provider credentials
# ============================================================================

variable "hetzner_api_token" {
  type        = string
  description = "Hetzner Cloud API token with read+write scope."
  sensitive   = true

  validation {
    condition     = length(trimspace(var.hetzner_api_token)) > 0
    error_message = "hetzner_api_token must not be empty."
  }
}

variable "cloudflare_api_token" {
  type        = string
  description = "Cloudflare API token with Zone:DNS:Edit, Zone:Zone Settings:Edit, and Zone:Rulesets:Edit on the target zone."
  sensitive   = true

  validation {
    condition     = length(trimspace(var.cloudflare_api_token)) > 0
    error_message = "cloudflare_api_token must not be empty."
  }
}

variable "cloudflare_zone_id" {
  type        = string
  description = "Cloudflare zone ID for the target domain (find in the zone's overview page, right sidebar)."

  validation {
    condition     = length(trimspace(var.cloudflare_zone_id)) > 0
    error_message = "cloudflare_zone_id must not be empty."
  }
}

# ============================================================================
# Domain + access
# ============================================================================

variable "domain" {
  type        = string
  description = "Apex domain BoringStack will run under, e.g. \"boringstack.example\"."

  validation {
    condition     = length(regexall("^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$", var.domain)) > 0 && !startswith(var.domain, "www.")
    error_message = "domain must be a bare lowercase apex domain with no scheme, path, or leading www."
  }
}

variable "ssh_public_key" {
  type        = string
  description = "Public SSH key to install on the VPS for operator access. Paste the full string including key-type prefix."

  validation {
    condition     = length(regexall("^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp(256|384|521)|sk-ssh-ed25519@openssh\\.com|sk-ecdsa-sha2-nistp256@openssh\\.com)\\s+[A-Za-z0-9+/]+={0,3}(\\s+.*)?$", trimspace(var.ssh_public_key))) > 0
    error_message = "ssh_public_key must be a valid OpenSSH public key."
  }
}

variable "ssh_allowed_ips" {
  type        = list(string)
  description = "Source CIDRs allowed to reach SSH (port 22). No default on purpose — opening an admin port to the world must be an explicit operator choice (your IP, bastion, or VPN range; [\"0.0.0.0/0\", \"::/0\"] if you really mean anywhere)."

  validation {
    condition     = length(var.ssh_allowed_ips) > 0 && alltrue([for cidr in var.ssh_allowed_ips : can(cidrhost(cidr, 0))])
    error_message = "ssh_allowed_ips must contain at least one valid IPv4 or IPv6 CIDR. Set it explicitly — e.g. [\"203.0.113.7/32\"] for a single admin IP."
  }
}

# ============================================================================
# Edge security (Cloudflare WAF)
# ============================================================================

variable "enable_bot_blocking" {
  type        = bool
  description = "Block common bot/scanner probe paths at the Cloudflare edge, before they reach the origin. Uses one custom WAF rule in the http_request_firewall_custom phase."
  default     = true
}

variable "bot_block_paths" {
  type        = list(string)
  description = "URI substrings blocked at the edge (case-insensitive, substring match). Review against your own routes before changing — e.g. drop \"/backend/\" if your app legitimately serves it. Must not overlap /.well-known/acme-challenge/ (breaks ACME)."
  default = [
    "/.env", "/.git/", "/.aws/", "/actuator/", "/wp-admin/", "/wp-login",
    "/xmlrpc", "/phpmyadmin/", "/laravel/", "/backend/", "/config.php",
    "/server-status",
  ]

  validation {
    condition     = alltrue([for p in var.bot_block_paths : !strcontains(p, "/.well-known/acme-challenge")])
    error_message = "bot_block_paths must not include /.well-known/acme-challenge — blocking it breaks Let's Encrypt HTTP-01 cert issuance."
  }
}

variable "block_suspicious_user_agents" {
  type        = bool
  description = "Also block empty / known-scanner user agents (sqlmap, nikto, …) in the edge bot-block rule."
  default     = true
}

variable "enable_auth_rate_limit" {
  type        = bool
  description = "Rate-limit /api/auth/* at the Cloudflare edge (Managed Challenge). Uses Cloudflare's one free rate-limiting rule; if your plan rejects it, set this false."
  default     = true
}

variable "auth_rate_limit_requests" {
  type        = number
  description = "Requests per period per IP on /api/auth/* before the managed challenge triggers."
  default     = 20

  validation {
    condition     = var.auth_rate_limit_requests >= 1 && floor(var.auth_rate_limit_requests) == var.auth_rate_limit_requests
    error_message = "auth_rate_limit_requests must be a whole number >= 1."
  }
}

variable "auth_rate_limit_period" {
  type        = number
  description = "Rate-limit window in seconds. Cloudflare allows 10, 60, 120, 300, 600, or 3600."
  default     = 60

  validation {
    condition     = contains([10, 60, 120, 300, 600, 3600], var.auth_rate_limit_period)
    error_message = "auth_rate_limit_period must be one of 10, 60, 120, 300, 600, 3600."
  }
}

variable "enable_edge_cache" {
  type        = bool
  description = "Cache Vite's content-hashed /assets/* at the Cloudflare edge and bypass cache for /api/*."
  default     = true
}

variable "enable_dnssec" {
  type        = bool
  description = "Enable DNSSEC on the zone. Automatic if the domain is at Cloudflare Registrar; otherwise add the DS record (see the dnssec_ds_record output) at your registrar."
  default     = true
}

# ============================================================================
# VPS sizing + placement
# ============================================================================

variable "vps_type" {
  type        = string
  description = "Hetzner server type. cx32 = 4 vCPU / 8 GB; the default sizing target. See https://www.hetzner.com/cloud for current options."
  default     = "cx32"
}

variable "vps_location" {
  type        = string
  description = "Hetzner data centre: fsn1 (Falkenstein, DE), nbg1 (Nuremberg, DE), hel1 (Helsinki, FI), ash (Ashburn, US), hil (Hillsboro, US)."
  default     = "fsn1"
}

variable "vps_image" {
  type        = string
  description = "OS image. Cloud-init expects a Debian/Ubuntu family image."
  default     = "ubuntu-24.04"
}

variable "vps_name" {
  type        = string
  description = "Server name (label in the Hetzner UI; not a DNS record)."
  default     = "boringstack"

  validation {
    condition     = length(regexall("^[A-Za-z0-9]([A-Za-z0-9.-]{0,61}[A-Za-z0-9])?$", var.vps_name)) > 0
    error_message = "vps_name must start and end with a letter or digit and contain only letters, digits, dots, and hyphens."
  }
}

variable "prevent_server_destroy" {
  type        = bool
  description = "When true (default), block tofu from destroying or replacing the VPS — it holds all persistent Docker volumes (Postgres, acme.json, GlitchTip). Flip to false (e.g. -var prevent_server_destroy=false) only when deliberately rebuilding the host."
  default     = true
}

# ============================================================================
# Repo to clone on first boot
# ============================================================================

variable "monorepo_repo" {
  type        = string
  description = "Git URL for the BoringStack monorepo to clone on first boot. Override to point at your fork."
  default     = "https://github.com/boringstack-xyz/boringstack"

  validation {
    condition     = can(regex("^(https://github\\.com/|git@github\\.com:)[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+(\\.git)?$", trimspace(var.monorepo_repo)))
    error_message = "monorepo_repo must be a GitHub URL: https://github.com/owner/repo or git@github.com:owner/repo (.git optional). A malformed value otherwise only fails inside cloud-init on the booted server."
  }
}

# ============================================================================
# Private GHCR pull credentials
# ============================================================================
#
# WUD and `docker compose pull` both fetch the api + ui images from GHCR
# at first boot. Public packages need no auth; the moment the fork goes
# private, anonymous pulls fail with "manifest unknown" and the stack
# silently stops getting updates. Render `~/.docker/config.json` from a
# PAT scoped `read:packages` so private images pull cleanly.
#
# To generate the PAT:
#   GitHub → Settings → Developer settings → Personal access tokens
#   → Tokens (classic) → Generate new token → select read:packages.
#
# Rotate at least annually; the bootstrap script writes whatever value
# is in tfvars on every apply, so a `tofu apply` is the rotation tool.

variable "ghcr_username" {
  type        = string
  description = "GitHub username the GHCR PAT belongs to. Leave empty if the fork's GHCR packages are public — pulls run anonymously."
  default     = ""

  validation {
    condition     = length(regexall("[\r\n\\s]", var.ghcr_username)) == 0
    error_message = "ghcr_username must fit on one line and contain no whitespace."
  }
}

variable "ghcr_token" {
  type        = string
  description = "GitHub PAT (classic) with read:packages scope. Required when ghcr_username is set. Rotate at least annually; `tofu apply` rewrites the docker config on the box."
  default     = ""
  sensitive   = true

  validation {
    condition     = length(regexall("[\r\n]", var.ghcr_token)) == 0
    error_message = "ghcr_token must fit on one line."
  }
}

# ============================================================================
# Stack secrets (rendered into compose/.env on first boot)
# ============================================================================

variable "jwt_secret" {
  type        = string
  description = "JWT signing secret (32+ chars). Rotating this invalidates every outstanding session."
  sensitive   = true

  validation {
    condition     = length(var.jwt_secret) >= 32 && length(regexall("[\r\n]", var.jwt_secret)) == 0
    error_message = "jwt_secret must be at least 32 characters and fit on one line."
  }
}

variable "postgres_password" {
  type        = string
  description = "Password for the Postgres `app` user (compose-stack-internal)."
  sensitive   = true

  validation {
    condition     = length(var.postgres_password) >= 16 && length(regexall("[\r\n]", var.postgres_password)) == 0
    error_message = "postgres_password must be at least 16 characters and fit on one line."
  }
}

variable "valkey_password" {
  type        = string
  description = "Password for Valkey (required in production)."
  sensitive   = true

  validation {
    condition     = length(var.valkey_password) >= 16 && length(regexall("[\r\n]", var.valkey_password)) == 0
    error_message = "valkey_password must be at least 16 characters and fit on one line."
  }
}

variable "acme_email" {
  type        = string
  description = "Real email Let's Encrypt sends cert-expiry warnings to. Must be valid; example.com domains are rejected."

  validation {
    condition     = length(regexall("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", var.acme_email)) > 0 && length(regexall("@example\\.(com|org|net)$", lower(var.acme_email))) == 0
    error_message = "acme_email must be a real email address, not an example.com/org/net placeholder."
  }
}

# ============================================================================
# Optional integrations
# ============================================================================

variable "email_provider" {
  type        = string
  description = "Empty string disables outbound email. Otherwise: cloudflare | resend | sendgrid."
  default     = ""

  validation {
    condition     = contains(["", "cloudflare", "resend", "sendgrid"], var.email_provider)
    error_message = "email_provider must be empty or one of: cloudflare, resend, sendgrid."
  }
}

variable "email_from" {
  type        = string
  description = "Sender address. Must be on a domain you've verified with the chosen provider."
  default     = ""

  validation {
    condition     = var.email_from == "" || length(regexall("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", var.email_from)) > 0
    error_message = "email_from must be empty or a valid email address."
  }
}

variable "cloudflare_account_id" {
  type        = string
  description = "Required when email_provider=cloudflare."
  default     = ""

  validation {
    condition     = length(regexall("[\r\n]", var.cloudflare_account_id)) == 0
    error_message = "cloudflare_account_id must fit on one line."
  }
}

variable "cloudflare_email_api_token" {
  type        = string
  description = "Cloudflare token scoped Email Sending: Edit. Required when email_provider=cloudflare."
  default     = ""
  sensitive   = true

  validation {
    condition     = length(regexall("[\r\n]", var.cloudflare_email_api_token)) == 0
    error_message = "cloudflare_email_api_token must fit on one line."
  }
}

variable "resend_api_key" {
  type        = string
  description = "Required when email_provider=resend."
  default     = ""
  sensitive   = true

  validation {
    condition     = length(regexall("[\r\n]", var.resend_api_key)) == 0
    error_message = "resend_api_key must fit on one line."
  }
}

variable "sendgrid_api_key" {
  type        = string
  description = "Required when email_provider=sendgrid."
  default     = ""
  sensitive   = true

  validation {
    condition     = length(regexall("[\r\n]", var.sendgrid_api_key)) == 0
    error_message = "sendgrid_api_key must fit on one line."
  }
}

variable "google_oauth_client_id" {
  type        = string
  description = "Google OAuth — leave empty to disable Google login."
  default     = ""

  validation {
    condition     = length(regexall("[\r\n]", var.google_oauth_client_id)) == 0
    error_message = "google_oauth_client_id must fit on one line."
  }
}

variable "google_oauth_client_secret" {
  type        = string
  description = ""
  default     = ""
  sensitive   = true

  validation {
    condition     = length(regexall("[\r\n]", var.google_oauth_client_secret)) == 0
    error_message = "google_oauth_client_secret must fit on one line."
  }
}

variable "github_oauth_client_id" {
  type        = string
  description = "GitHub OAuth — leave empty to disable GitHub login."
  default     = ""

  validation {
    condition     = length(regexall("[\r\n]", var.github_oauth_client_id)) == 0
    error_message = "github_oauth_client_id must fit on one line."
  }
}

variable "github_oauth_client_secret" {
  type        = string
  description = "GitHub OAuth — paired with github_oauth_client_id."
  default     = ""
  sensitive   = true

  validation {
    condition     = length(regexall("[\r\n]", var.github_oauth_client_secret)) == 0
    error_message = "github_oauth_client_secret must fit on one line."
  }
}

variable "linkedin_oauth_client_id" {
  type        = string
  description = "LinkedIn OAuth — leave empty to disable LinkedIn login."
  default     = ""

  validation {
    condition     = length(regexall("[\r\n]", var.linkedin_oauth_client_id)) == 0
    error_message = "linkedin_oauth_client_id must fit on one line."
  }
}

variable "linkedin_oauth_client_secret" {
  type        = string
  description = "LinkedIn OAuth — paired with linkedin_oauth_client_id."
  default     = ""
  sensitive   = true

  validation {
    condition     = length(regexall("[\r\n]", var.linkedin_oauth_client_secret)) == 0
    error_message = "linkedin_oauth_client_secret must fit on one line."
  }
}

variable "stripe_secret_key" {
  type        = string
  description = "Stripe secret key. Leave empty to disable billing."
  default     = ""
  sensitive   = true

  validation {
    condition     = length(regexall("[\r\n]", var.stripe_secret_key)) == 0
    error_message = "stripe_secret_key must fit on one line."
  }
}

variable "stripe_webhook_secret" {
  type        = string
  description = "Stripe webhook signing secret."
  default     = ""
  sensitive   = true

  validation {
    condition     = length(regexall("[\r\n]", var.stripe_webhook_secret)) == 0
    error_message = "stripe_webhook_secret must fit on one line."
  }
}

variable "sentry_dsn" {
  type        = string
  description = "API-side Sentry / GlitchTip DSN. Leave empty to skip error tracking."
  default     = ""

  validation {
    condition     = length(regexall("[\r\n]", var.sentry_dsn)) == 0
    error_message = "sentry_dsn must fit on one line."
  }
}

variable "vite_sentry_dsn" {
  type        = string
  description = "UI-side Sentry / GlitchTip DSN."
  default     = ""

  validation {
    condition     = length(regexall("[\r\n]", var.vite_sentry_dsn)) == 0
    error_message = "vite_sentry_dsn must fit on one line."
  }
}

# ============================================================================
# Backups (optional; cron + rclone)
# ============================================================================

variable "backups_enabled" {
  type        = bool
  description = "If true, bootstrap.sh schedules nightly Postgres backups via rclone. Requires rclone_remote_* vars."
  default     = false
}

variable "rclone_remote_name" {
  type        = string
  description = "Name of the rclone remote (configured separately on the host)."
  default     = ""

  validation {
    condition     = var.rclone_remote_name == "" || length(regexall("^[A-Za-z0-9_.-]+$", var.rclone_remote_name)) > 0
    error_message = "rclone_remote_name must be empty or contain only letters, digits, underscores, dots, and hyphens."
  }
}

variable "rclone_remote_path" {
  type        = string
  description = "Path within the rclone remote where backups land."
  default     = ""

  validation {
    condition     = var.rclone_remote_path == "" || length(regexall("^[A-Za-z0-9._~/-]+$", var.rclone_remote_path)) > 0
    error_message = "rclone_remote_path must be empty or contain only letters, digits, dots, underscores, tildes, slashes, and hyphens."
  }
}

variable "backup_retention_days" {
  type        = number
  description = "How many days of backups to keep at the remote."
  default     = 30

  validation {
    condition     = var.backup_retention_days >= 1 && floor(var.backup_retention_days) == var.backup_retention_days
    error_message = "backup_retention_days must be a whole number of days greater than or equal to 1."
  }
}

# ============================================================================
# Optional first-boot superuser
# ============================================================================

variable "superuser_email" {
  type        = string
  description = "If set together with superuser_password, the api-migrate job creates a user with admin role on first boot. Empty = no user seeded; sign up via the registration flow."
  default     = ""

  validation {
    condition     = var.superuser_email == "" || length(regexall("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", var.superuser_email)) > 0
    error_message = "superuser_email must be empty or a valid email address."
  }
}

variable "superuser_password" {
  type        = string
  description = "Initial password for the superuser. Rotate via the password-reset flow after first login. Empty disables the bootstrap."
  default     = ""
  sensitive   = true
}
