# ============================================================================
# Cloudflare: DNS records + opinionated zone settings + www→apex redirect.
#
# Records:
#   apex      A     -> server IPv4 (proxied)
#   apex      AAAA  -> server IPv6 (proxied)
#   www.apex CNAME  -> apex      (proxied; redirect-rule sends www → apex)
#
# Same-origin routing: Traefik path-routes /api/* on the apex to the api
# container, so there is no api.<domain> record. If you need a separate api
# subdomain (cross-origin deployment), re-add the A/AAAA pair and update
# infra/compose/compose/docker-compose.production-labels.yml
# to use Host(`${PUBLIC_API_HOST}`) on the api router.
#
# Zone settings match what production-labels.yml expects from Traefik upstream:
#   SSL mode             strict        (CF↔origin uses real Let's Encrypt cert)
#   HTTP→HTTPS redirect  ruleset below (ACME HTTP-01 path is left alone)
#   Min TLS              1.2
#   HSTS                 enabled, 6 months
#   Browser Integrity    on
# ============================================================================

terraform {
  required_providers {
    cloudflare = { source = "cloudflare/cloudflare" }
  }
}

# ----------------------------------------------------------------------------
# DNS records (all proxied — orange cloud)
# ----------------------------------------------------------------------------

resource "cloudflare_dns_record" "apex_a" {
  zone_id = var.zone_id
  name    = "@"
  type    = "A"
  content = var.server_ip
  proxied = true
  ttl     = 1 # auto when proxied
  comment = "BoringStack apex (managed by OpenTofu)"
}

resource "cloudflare_dns_record" "apex_aaaa" {
  zone_id = var.zone_id
  name    = "@"
  type    = "AAAA"
  content = var.server_ip6
  proxied = true
  ttl     = 1
  comment = "BoringStack apex (managed by OpenTofu)"
}

resource "cloudflare_dns_record" "www_cname" {
  zone_id = var.zone_id
  name    = "www"
  type    = "CNAME"
  content = var.domain
  proxied = true
  ttl     = 1
  comment = "Redirected to apex by ruleset below (managed by OpenTofu)"
}

# ----------------------------------------------------------------------------
# Zone-wide settings (opinionated production defaults)
# ----------------------------------------------------------------------------

locals {
  zone_settings = {
    ssl                      = "strict"
    always_use_https         = "off" # handled by the redirect ruleset below
    automatic_https_rewrites = "on"
    min_tls_version          = "1.2"
    tls_1_3                  = "on"
    opportunistic_encryption = "on"
    browser_check            = "on"
    http3                    = "on"
    "0rtt"                   = "off" # avoid replay risk for state-changing API requests
    websockets               = "on"
    brotli                   = "on"
    early_hints              = "on"
  }
}

resource "cloudflare_zone_setting" "main" {
  for_each = local.zone_settings

  zone_id    = var.zone_id
  setting_id = each.key
  value      = each.value
}

resource "cloudflare_zone_setting" "security_header" {
  zone_id    = var.zone_id
  setting_id = "security_header"
  value = {
    strict_transport_security = {
      enabled            = true
      max_age            = 15768000 # 6 months
      include_subdomains = true
      preload            = false # opt-in; submit to hstspreload.org separately
      nosniff            = true
    }
  }
}

# ----------------------------------------------------------------------------
# Redirects (using a Cloudflare ruleset; replaces the legacy Page Rule
# mechanism). Applied at the http_request_dynamic_redirect phase.
# ----------------------------------------------------------------------------

resource "cloudflare_ruleset" "www_redirect" {
  zone_id     = var.zone_id
  name        = "boringstack-redirects"
  description = "Redirect www.${var.domain} to apex and HTTP to HTTPS (managed by OpenTofu)"
  kind        = "zone"
  phase       = "http_request_dynamic_redirect"

  rules = [
    {
      ref         = "www_to_apex"
      description = "301 www to apex"
      expression  = "(http.host eq \"www.${var.domain}\" and not starts_with(http.request.uri.path, \"/.well-known/acme-challenge/\"))"
      action      = "redirect"
      enabled     = true
      action_parameters = {
        from_value = {
          status_code = 301
          target_url = {
            expression = "concat(\"https://${var.domain}\", http.request.uri.path)"
          }
          preserve_query_string = true
        }
      }
    },
    {
      ref         = "http_to_https"
      description = "301 HTTP to HTTPS except ACME HTTP-01"
      expression  = "(http.request.scheme eq \"http\" and not starts_with(http.request.uri.path, \"/.well-known/acme-challenge/\"))"
      action      = "redirect"
      enabled     = true
      action_parameters = {
        from_value = {
          status_code = 301
          target_url = {
            expression = "concat(\"https://\", http.host, http.request.uri.path)"
          }
          preserve_query_string = true
        }
      }
    }
  ]
}

# ----------------------------------------------------------------------------
# Edge WAF: block common bot/scanner probe paths (/.env, /.git/, /wp-admin, …)
# at the http_request_firewall_custom phase, before they reach the origin.
# A single rule ORs every configured path; matching is case-insensitive and
# substring-based so a path matches anywhere in the URI.
# ----------------------------------------------------------------------------

locals {
  bot_block_expression = join(" or ", [
    for p in var.bot_block_paths : "(lower(http.request.uri.path) contains \"${p}\")"
  ])
}

resource "cloudflare_ruleset" "bot_block" {
  count = var.enable_bot_blocking ? 1 : 0

  zone_id     = var.zone_id
  name        = "boringstack-bot-block"
  description = "Block common bot/scanner probe paths at the edge (managed by OpenTofu)"
  kind        = "zone"
  phase       = "http_request_firewall_custom"

  rules = [
    {
      ref         = "block_scanner_paths"
      description = "Block known bot/scanner probe paths"
      expression  = local.bot_block_expression
      action      = "block"
      enabled     = true
    }
  ]
}
