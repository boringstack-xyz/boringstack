output "records" {
  description = "The DNS records this module created."
  value = {
    apex = "${var.domain}      -> ${var.server_ip} / ${var.server_ip6} (proxied)"
    www  = "www.${var.domain}  -> CNAME ${var.domain} (proxied, 301 to apex)"
  }
}

output "edge_security" {
  description = "Edge security posture for this zone."
  value = {
    bot_block       = var.enable_bot_blocking ? "blocking scanner paths + dotfiles${var.block_suspicious_user_agents ? " + bad user-agents" : ""}" : "disabled"
    auth_rate_limit = var.enable_auth_rate_limit ? "${var.auth_rate_limit_requests} req / ${var.auth_rate_limit_period}s on /api/auth/* (managed challenge)" : "disabled"
    edge_cache      = var.enable_edge_cache ? "hashed assets cached at edge; /api bypassed" : "disabled"
    dnssec          = var.enable_dnssec ? "enabled" : "disabled"
  }
}

output "dnssec_ds_record" {
  description = "DS record to add at an external registrar. Empty when DNSSEC is off or the domain is at Cloudflare Registrar (where activation is automatic)."
  value       = var.enable_dnssec ? one(cloudflare_zone_dnssec.this[*].ds) : null
}
