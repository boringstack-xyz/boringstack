variable "vps_name" {
  type        = string
  description = "Server label."
}

variable "vps_type" {
  type        = string
  description = "Hetzner server type."
}

variable "vps_location" {
  type        = string
  description = "Hetzner datacenter."
}

variable "vps_image" {
  type        = string
  description = "OS image (Debian/Ubuntu family for cloud-init)."
}

variable "ssh_public_key" {
  type        = string
  description = "Public SSH key string."
}

variable "ssh_allowed_ips" {
  type        = list(string)
  description = "Source CIDRs allowed to reach SSH."
}

variable "cloud_init" {
  type        = string
  description = "Rendered cloud-init YAML, injected as the server's user_data."
}

variable "prevent_destroy" {
  type        = bool
  description = "Guard the VPS against destroy/replace. Set false only for a deliberate rebuild."
}
