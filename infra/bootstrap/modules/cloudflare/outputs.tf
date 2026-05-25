output "records" {
  description = "The DNS records this module created."
  value = {
    apex = "${var.domain}      -> ${var.server_ip} / ${var.server_ip6} (proxied)"
    www  = "www.${var.domain}  -> CNAME ${var.domain} (proxied, 301 to apex)"
  }
}
