output "records" {
  description = "The DNS records this module created."
  value = {
    apex = "${var.domain}      -> ${var.server_ip} / ${var.server_ip6} (proxied)"
    www  = "www.${var.domain}  -> CNAME ${var.domain} (proxied, 301 to apex)"
  }
}

output "edge_security" {
  description = "Edge WAF status for this zone."
  value = {
    bot_block = var.enable_bot_blocking ? "blocking ${length(var.bot_block_paths)} scanner path(s) at the edge" : "disabled"
  }
}
