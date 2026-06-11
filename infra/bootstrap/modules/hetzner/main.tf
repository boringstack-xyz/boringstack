# ============================================================================
# Hetzner: server + SSH key + firewall.
#
# Firewall posture:
#   - SSH (22): from ssh_allowed_ips (default: anywhere; restrict for prod).
#   - HTTPS (443) + HTTP (80): from Cloudflare IPs only.
#       Cloudflare publishes their IPv4/IPv6 ranges at /ips-v4 + /ips-v6.
#       We fetch them at plan time so the rule list stays current without
#       hand-maintaining a literal CIDR list.
#   - Everything else inbound: dropped.
# ============================================================================

terraform {
  required_providers {
    hcloud = { source = "hetznercloud/hcloud", version = "~> 1.48" }
    http   = { source = "hashicorp/http", version = "~> 3.4" }
  }
}

# ----------------------------------------------------------------------------
# Cloudflare IP ranges (fetched fresh on every plan)
# ----------------------------------------------------------------------------

data "http" "cloudflare_ips_v4" {
  url = "https://www.cloudflare.com/ips-v4"
}

data "http" "cloudflare_ips_v6" {
  url = "https://www.cloudflare.com/ips-v6"
}

locals {
  cloudflare_ips = concat(
    [for ip in split("\n", trimspace(data.http.cloudflare_ips_v4.response_body)) : ip if ip != ""],
    [for ip in split("\n", trimspace(data.http.cloudflare_ips_v6.response_body)) : ip if ip != ""],
  )
}

# ----------------------------------------------------------------------------
# SSH key
# ----------------------------------------------------------------------------

resource "hcloud_ssh_key" "operator" {
  name       = "${var.vps_name}-operator"
  public_key = var.ssh_public_key
}

# ----------------------------------------------------------------------------
# Firewall
# ----------------------------------------------------------------------------

resource "hcloud_firewall" "main" {
  name = "${var.vps_name}-fw"

  rule {
    description = "SSH"
    direction   = "in"
    protocol    = "tcp"
    port        = "22"
    source_ips  = var.ssh_allowed_ips
  }

  rule {
    description = "HTTPS from Cloudflare"
    direction   = "in"
    protocol    = "tcp"
    port        = "443"
    source_ips  = local.cloudflare_ips
  }

  rule {
    description = "HTTP from Cloudflare (for ACME HTTP-01)"
    direction   = "in"
    protocol    = "tcp"
    port        = "80"
    source_ips  = local.cloudflare_ips
  }

  rule {
    description = "ICMP"
    direction   = "in"
    protocol    = "icmp"
    source_ips  = ["0.0.0.0/0", "::/0"]
  }
}

# ----------------------------------------------------------------------------
# Server
# ----------------------------------------------------------------------------

resource "hcloud_server" "main" {
  name         = var.vps_name
  server_type  = var.vps_type
  location     = var.vps_location
  image        = var.vps_image
  ssh_keys     = [hcloud_ssh_key.operator.id]
  firewall_ids = [hcloud_firewall.main.id]
  user_data    = var.cloud_init

  public_net {
    ipv4_enabled = true
    ipv6_enabled = true
  }

  labels = {
    role    = "boringstack"
    managed = "opentofu"
  }

  # cloud-init only executes on FIRST boot, but Hetzner replaces the
  # server whenever user_data changes — so a routine tfvars edit (repo
  # URL, superuser credentials, backup settings) would otherwise destroy
  # the VPS and every Docker volume on it (Postgres data, acme.json,
  # GlitchTip). Ignore post-create drift to avoid accidental rebuilds.
  #
  # prevent_destroy (var-gated; OpenTofu 1.12+) is the second guard: any
  # plan that would destroy or -replace this server is rejected while the
  # flag is true. To deliberately rebuild a fresh box, lower the gate:
  #   tofu apply -var prevent_server_destroy=false \
  #     -replace=module.hetzner.hcloud_server.main
  lifecycle {
    ignore_changes  = [user_data]
    prevent_destroy = var.prevent_destroy
  }
}
