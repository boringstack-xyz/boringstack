variable "zone_id" {
  type        = string
  description = "Cloudflare zone ID for the target domain."
}

variable "domain" {
  type        = string
  description = "Apex domain."
}

variable "server_ip" {
  type        = string
  description = "Public IPv4 address of the server (Hetzner output)."
}

variable "server_ip6" {
  type        = string
  description = "Public IPv6 address of the server."
}

variable "enable_bot_blocking" {
  type        = bool
  description = "Whether to create the edge bot/scanner-path block rule."
}

variable "bot_block_paths" {
  type        = list(string)
  description = "URI substrings blocked at the edge (case-insensitive). Review against your own routes before adding app-legit paths."
}

variable "block_suspicious_user_agents" {
  type        = bool
  description = "Also block empty / known-scanner user agents in the bot-block rule."
}

variable "enable_auth_rate_limit" {
  type        = bool
  description = "Whether to create the edge rate-limit rule on /api/auth/*."
}

variable "auth_rate_limit_requests" {
  type        = number
  description = "Requests allowed per period per IP on /api/auth/* before the managed challenge kicks in."
}

variable "auth_rate_limit_period" {
  type        = number
  description = "Rate-limit window in seconds (Cloudflare: 10, 60, 120, 300, 600, or 3600)."
}

variable "enable_edge_cache" {
  type        = bool
  description = "Whether to create the edge cache rule (cache hashed assets, bypass the API)."
}

variable "enable_dnssec" {
  type        = bool
  description = "Whether to enable DNSSEC on the zone."
}
