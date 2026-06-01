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
