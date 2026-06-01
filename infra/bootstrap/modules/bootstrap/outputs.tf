output "cloud_init" {
  description = "Rendered cloud-init YAML, ready to inject as a server's user_data."
  value       = local.cloud_init
  sensitive   = true # contains secrets
}
