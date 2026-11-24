variable "enabled" {
  type        = bool
  default     = false
  description = "Create the agent host. Off by default: nothing is created until this is true."
}

variable "hetzner_api_token" {
  type        = string
  sensitive   = true
  description = "Hetzner Cloud API token with read and write access to the project."
}

variable "name" {
  type        = string
  default     = "boringstack-agent-host"
  description = "Server name, and the prefix for the SSH key and firewall."
}

variable "server_type" {
  type        = string
  default     = "cpx32"
  description = "Hetzner server type. Check the current list before applying; types change."
}

variable "location" {
  type        = string
  default     = "fsn1"
  description = "Hetzner location."
}

variable "image" {
  type        = string
  default     = "ubuntu-24.04"
  description = "OS image. The bootstrap assumes Ubuntu 24.04 (apt and systemd)."
}

variable "ssh_public_key" {
  type        = string
  description = "Public SSH key of the operator who logs in as root (key-only)."
}

variable "ssh_allowed_ips" {
  type        = list(string)
  description = "Source CIDRs allowed to reach SSH. Required, with no default: a host that runs agents should not be open to the world by accident."
}

variable "agent_user" {
  type        = string
  default     = "agent"
  description = "Non-root Linux user that runs the factory, Claude Code and tmux."
}

variable "repo_url" {
  type        = string
  description = "HTTPS git URL of the BoringStack repository the agent user clones."
}

variable "bun_version" {
  type        = string
  default     = "1.4.5"
  description = "Bun version the host installs. Matches the repository's pinned Bun."
}

variable "delete_protection" {
  type        = bool
  default     = true
  description = "Block deletion and rebuild of the server in Hetzner. Lower it only for a deliberate rebuild."
}
