# ============================================================================
# Agent host: an always-on Linux VM that runs factory agents for people who
# steer them from a phone or a laptop (Claude Code Remote Control).
#
# Off by default: `enabled = false` creates nothing. This is a blueprint. The
# factory never applies it, and agents never run an apply, destroy or import
# (the factory guard refuses them). A person applies it, on purpose.
#
# Posture:
#   - Inbound: SSH only, from `ssh_allowed_ips`, key-only (see cloud-init).
#     No web ports. The fleet page binds 127.0.0.1 and is reached by tunnel.
#   - Outbound: open. Claude Code, Remote Control, git and GitHub need it.
#   - Host firewall (ufw) allows SSH only, as a second layer.
#   - Unattended security upgrades. The server cannot be deleted or rebuilt
#     while `delete_protection` is true.
# ============================================================================

terraform {
  # The module uses no 1.12-only feature (no prevent_destroy), so it accepts 1.11.
  required_version = ">= 1.11.0"

  required_providers {
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "~> 1.48"
    }
  }
}

provider "hcloud" {
  token = var.hetzner_api_token
}

locals {
  enabled = var.enabled ? 1 : 0

  cloud_init = templatefile("${path.module}/templates/cloud-init.yaml.tftpl", {
    agent_user        = var.agent_user
    repo_url          = var.repo_url
    bun_version       = var.bun_version
    host_script       = file("${path.module}/templates/agent-host.sh")
    add_person_script = file("${path.module}/templates/add-person.sh")
  })
}

resource "hcloud_ssh_key" "operator" {
  count      = local.enabled
  name       = "${var.name}-operator"
  public_key = var.ssh_public_key
}

resource "hcloud_firewall" "agent_host" {
  count = local.enabled
  name  = "${var.name}-fw"

  rule {
    description = "SSH (key-only, see cloud-init)"
    direction   = "in"
    protocol    = "tcp"
    port        = "22"
    source_ips  = var.ssh_allowed_ips
  }

  rule {
    description = "ICMP"
    direction   = "in"
    protocol    = "icmp"
    source_ips  = ["0.0.0.0/0", "::/0"]
  }
}

resource "hcloud_server" "agent_host" {
  count        = local.enabled
  name         = var.name
  server_type  = var.server_type
  location     = var.location
  image        = var.image
  ssh_keys     = [hcloud_ssh_key.operator[0].id]
  firewall_ids = [hcloud_firewall.agent_host[0].id]
  user_data    = local.cloud_init

  delete_protection  = var.delete_protection
  rebuild_protection = var.delete_protection

  public_net {
    ipv4_enabled = true
    ipv6_enabled = true
  }

  labels = {
    role    = "agent-host"
    managed = "opentofu"
  }

  # cloud-init runs on first boot only. Replacing the server on a user_data
  # change would destroy the agents' checkouts and their state.
  lifecycle {
    ignore_changes = [user_data]
  }
}
