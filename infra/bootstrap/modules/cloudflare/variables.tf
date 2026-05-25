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
