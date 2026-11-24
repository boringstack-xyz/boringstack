output "ipv4" {
  description = "Public IPv4 of the agent host, or null when disabled."
  value       = one(hcloud_server.agent_host[*].ipv4_address)
}

output "ssh_target" {
  description = "Where the operator logs in. The fleet page is read through a tunnel: ssh -L 8500:127.0.0.1:8500 root@<ipv4>."
  value       = one(hcloud_server.agent_host[*].ipv4_address) == null ? null : "root@${one(hcloud_server.agent_host[*].ipv4_address)}"
}
