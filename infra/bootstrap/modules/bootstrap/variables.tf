variable "domain" {
  type = string
}

variable "monorepo_repo" {
  type = string
}

# Stack secrets

variable "jwt_secret" {
  type      = string
  sensitive = true
}

variable "postgres_password" {
  type      = string
  sensitive = true
}

variable "valkey_password" {
  type      = string
  sensitive = true
}

variable "acme_email" {
  type = string
}

# Optional integrations (each may be empty)

variable "email_provider" {
  type = string
}

variable "email_from" {
  type = string
}

variable "cloudflare_account_id" {
  type = string
}

variable "cloudflare_email_api_token" {
  type      = string
  sensitive = true
}

variable "resend_api_key" {
  type      = string
  sensitive = true
}

variable "sendgrid_api_key" {
  type      = string
  sensitive = true
}

variable "google_oauth_client_id" {
  type = string
}

variable "google_oauth_client_secret" {
  type      = string
  sensitive = true
}

variable "github_oauth_client_id" {
  type = string
}

variable "github_oauth_client_secret" {
  type      = string
  sensitive = true
}

variable "linkedin_oauth_client_id" {
  type = string
}

variable "linkedin_oauth_client_secret" {
  type      = string
  sensitive = true
}

variable "stripe_secret_key" {
  type      = string
  sensitive = true
}

variable "stripe_webhook_secret" {
  type      = string
  sensitive = true
}

variable "sentry_dsn" {
  type = string
}

variable "vite_sentry_dsn" {
  type = string
}

# Backups

variable "backups_enabled" {
  type = bool
}

variable "rclone_remote_name" {
  type = string
}

variable "rclone_remote_path" {
  type = string
}

variable "backup_retention_days" {
  type = number
}

variable "superuser_email" {
  type    = string
  default = ""
}

variable "superuser_password" {
  type      = string
  default   = ""
  sensitive = true
}

# Private GHCR auth (empty = anonymous pulls)

variable "ghcr_username" {
  type    = string
  default = ""
}

variable "ghcr_token" {
  type      = string
  default   = ""
  sensitive = true
}
