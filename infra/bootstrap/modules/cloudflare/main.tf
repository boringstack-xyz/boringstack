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
    cloudflare = { source = "cloudflare/cloudflare", version = "~> 5.0" }
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
# Edge WAF: block bot/scanner traffic at the http_request_firewall_custom phase,
# before it reaches the origin. One rule ORs three clauses:
#   1. known CMS/scanner probe paths (var.bot_block_paths)
#   2. any hidden dot-path (/.git, /.ssh, /.htpasswd, …) except the ACME
#      challenge dir, which Traefik needs reachable over HTTP for certs
#   3. empty or known-scanner user agents (toggle: block_suspicious_user_agents)
# Matching is case-insensitive and substring-based.
# ----------------------------------------------------------------------------

locals {
  # lower(p) so matching is genuinely case-insensitive regardless of how the
  # operator writes the pattern — both sides of `contains` are lowercased.
  bot_block_path_clause = length(var.bot_block_paths) > 0 ? join(" or ", [
    for p in var.bot_block_paths : "(lower(http.request.uri.path) contains \"${lower(p)}\")"
  ]) : ""

  bot_block_dotfile_clause = "(lower(http.request.uri.path) contains \"/.\" and not starts_with(lower(http.request.uri.path), \"/.well-known/\"))"

  scanner_user_agents = ["sqlmap", "nikto", "nessus", "masscan", "zgrab", "nmap", "dirbuster", "fimap", "wpscan"]

  bot_block_ua_clause = var.block_suspicious_user_agents ? "(${join(" or ", concat(
    ["http.user_agent eq \"\""],
    [for ua in local.scanner_user_agents : "lower(http.user_agent) contains \"${lower(ua)}\""]
  ))})" : ""

  bot_block_expression = join(" or ", compact([
    local.bot_block_path_clause,
    local.bot_block_dotfile_clause,
    local.bot_block_ua_clause,
  ]))
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
      description = "Block scanner paths, hidden dotfiles, and bad user-agents"
      expression  = local.bot_block_expression
      action      = "block"
      enabled     = true
    }
  ]
}

# ----------------------------------------------------------------------------
# Edge rate limit: throttle credential-stuffing / brute force against the auth
# endpoints, in front of the API's own Valkey limiter. Uses Cloudflare's one
# free rate-limiting rule. Managed Challenge lets real users through while
# stalling scripted abuse.
# ----------------------------------------------------------------------------

resource "cloudflare_ruleset" "auth_rate_limit" {
  count = var.enable_auth_rate_limit ? 1 : 0

  zone_id     = var.zone_id
  name        = "boringstack-auth-rate-limit"
  description = "Rate-limit /api/auth/* at the edge (managed by OpenTofu)"
  kind        = "zone"
  phase       = "http_ratelimit"

  rules = [
    {
      ref         = "rl_auth_endpoints"
      description = "Throttle credential-stuffing against /api/auth/*"
      expression  = "(starts_with(http.request.uri.path, \"/api/auth/\"))"
      action      = "managed_challenge"
      enabled     = true
      ratelimit = {
        characteristics     = ["ip.src", "cf.colo.id"]
        period              = var.auth_rate_limit_period
        requests_per_period = var.auth_rate_limit_requests
        mitigation_timeout  = var.auth_rate_limit_period
      }
    }
  ]
}

# ----------------------------------------------------------------------------
# Edge cache: cache Vite's content-hashed build assets aggressively, and never
# cache the API. Hashed asset filenames change on every deploy, so a long edge
# TTL is safe; index.html / dynamic HTML stay uncached by Cloudflare default.
# ----------------------------------------------------------------------------

resource "cloudflare_ruleset" "edge_cache" {
  count = var.enable_edge_cache ? 1 : 0

  zone_id     = var.zone_id
  name        = "boringstack-cache"
  description = "Edge-cache hashed assets; bypass the API (managed by OpenTofu)"
  kind        = "zone"
  phase       = "http_request_cache_settings"

  rules = [
    {
      ref         = "no_cache_api"
      description = "Never cache API responses"
      expression  = "(starts_with(http.request.uri.path, \"/api/\"))"
      action      = "set_cache_settings"
      enabled     = true
      action_parameters = {
        cache = false
      }
    },
    {
      ref         = "cache_hashed_assets"
      description = "Cache Vite's content-hashed assets for a year"
      expression  = "(starts_with(http.request.uri.path, \"/assets/\"))"
      action      = "set_cache_settings"
      enabled     = true
      action_parameters = {
        cache = true
        edge_ttl = {
          mode    = "override_origin"
          default = 31536000
        }
        browser_ttl = {
          mode    = "override_origin"
          default = 31536000
        }
      }
    }
  ]
}

# ----------------------------------------------------------------------------
# DNSSEC: signs the zone so resolvers can detect tampered DNS answers. Free.
# If the domain is registered at Cloudflare Registrar this is fully automatic;
# on an external registrar, paste the `dnssec_ds_record` output's DS record
# into the registrar once (see outputs.tf).
# ----------------------------------------------------------------------------

resource "cloudflare_zone_dnssec" "this" {
  count = var.enable_dnssec ? 1 : 0

  zone_id = var.zone_id
  status  = "active"
}
