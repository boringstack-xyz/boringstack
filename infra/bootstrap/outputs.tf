output "vps_ipv4" {
  description = "Public IPv4 of the Hetzner server."
  value       = module.hetzner.ipv4
}

output "vps_ipv6" {
  description = "Public IPv6 of the Hetzner server."
  value       = module.hetzner.ipv6
}

output "ssh_command" {
  description = "Ready-to-paste SSH command to reach the server."
  value       = "ssh root@${module.hetzner.ipv4}"
}

output "site_url" {
  description = "Where BoringStack will be reachable once cloud-init finishes (a minute or two after apply completes)."
  value       = "https://${var.domain}"
}

output "api_url" {
  description = "API base URL (same-origin path routing on the apex)."
  value       = "https://${var.domain}/api"
}

output "dns_records" {
  description = "DNS records created in the Cloudflare zone."
  value       = module.cloudflare.records
}

output "next_steps" {
  description = "What's still manual after apply."
  value       = <<-EOT

    Apply finished. The VPS is up and cloud-init is bootstrapping the stack.

    1. Wait ~3-5 minutes for cloud-init to finish on first boot.
       Check progress:  ssh root@${module.hetzner.ipv4} 'cloud-init status --wait'

    2. Verify the site:  curl -sI https://${var.domain}/health

    3. Manual steps that stay manual (none of these block the deploy, but the
       relevant features stay disabled until you complete them):

       - Cloudflare Workers Paid (if using Cloudflare Email Service):
         https://dash.cloudflare.com → Workers & Pages → Plans
       - OAuth apps (Google / GitHub): create in each provider's
         dashboard, then add credentials before first apply or update
         compose/.env on the server and restart the stack.
       - Stripe products + prices: create in the Stripe dashboard, then
         configure STRIPE_PRICE_ID_* in compose/api.prod.env on the server.

    See https://boringstack.xyz/topics/provisioning-with-tofu/ for the full
    picture.
  EOT
}
