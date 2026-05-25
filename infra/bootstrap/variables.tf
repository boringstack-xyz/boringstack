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
  description = "Source CIDRs allowed to reach SSH (port 22). Defaults to anywhere; restrict to your bastion / VPN for hardening."
  default     = ["0.0.0.0/0", "::/0"]

  validation {
    condition     = length(var.ssh_allowed_ips) > 0 && alltrue([for cidr in var.ssh_allowed_ips : can(cidrhost(cidr, 0))])
    error_message = "ssh_allowed_ips must contain at least one valid IPv4 or IPv6 CIDR."
  }
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

# ============================================================================
# Repos to clone on first boot
# ============================================================================

variable "api_repo" {
  type        = string
  description = "Git URL for the api-template repo to clone on first boot. Override to point at your fork."
  default     = "https://github.com/boringstack-xyz/api-template"

  validation {
    condition     = length(trimspace(var.api_repo)) > 0 && length(regexall("[\r\n]", var.api_repo)) == 0
    error_message = "api_repo must be a single-line Git URL."
  }
}

variable "ui_repo" {
  type        = string
  description = "Git URL for the ui-template repo."
  default     = "https://github.com/boringstack-xyz/ui-template"

  validation {
    condition     = length(trimspace(var.ui_repo)) > 0 && length(regexall("[\r\n]", var.ui_repo)) == 0
    error_message = "ui_repo must be a single-line Git URL."
  }
}

variable "infra_repo" {
  type        = string
  description = "Git URL for the infra-docker-compose-template repo."
  default     = "https://github.com/boringstack-xyz/infra-docker-compose-template"

  validation {
    condition     = length(trimspace(var.infra_repo)) > 0 && length(regexall("[\r\n]", var.infra_repo)) == 0
    error_message = "infra_repo must be a single-line Git URL."
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
  description = ""
  default     = ""
  sensitive   = true

  validation {
    condition     = length(regexall("[\r\n]", var.github_oauth_client_secret)) == 0
    error_message = "github_oauth_client_secret must fit on one line."
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
