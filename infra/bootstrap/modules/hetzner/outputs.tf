output "ipv4" {
  description = "Public IPv4 of the server."
  value       = hcloud_server.main.ipv4_address
}

output "ipv6" {
  description = "Public IPv6 of the server."
  value       = hcloud_server.main.ipv6_address
}

output "server_id" {
  description = "Hetzner server resource ID."
  value       = hcloud_server.main.id
}
