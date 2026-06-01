# Security hardening (checklist)

Actionable defaults for this template and anything you deploy from it. Nothing here replaces a threat model for your product.

## Secrets and git

- **Never** commit production `.env`, `rclone.conf`, OAuth refresh tokens, TLS private keys, or database dumps.
- Prefer a **secret manager** (1Password, Doppler, Vault, cloud provider secret store) and inject at deploy time.
- If a secret ever touched git, assume compromise: **rotate** the credential and purge history if the repo was public or widely forked.

## TLS and ACME

- **HTTP-01** (what the bundled Traefik prod overlay uses) needs reachable **port 80** for the ACME challenge. If you lock the origin to Cloudflare-only IPs, renewals can break unless you temporarily relax rules or use **DNS-01**.
- **DNS-01**: Traefik can obtain certs via a DNS provider API. Stronger fit when port 80 is closed on the origin. See [Traefik ACME DNS challenge](https://doc.traefik.io/traefik/https/acme/#dnschallenge) and your DNS provider’s docs.
- Read [single-host firewall and TLS](runbooks/single-host-firewall-and-tls.md) before tightening firewalls around renewal.

## Docker socket and Traefik

- Traefik is configured with **read-only** access to `/var/run/docker.sock`. That is still **highly sensitive**: anyone who can trick Traefik or escape the container classically had a path toward host control in many setups. Mitigations: keep Traefik and images **patched**, restrict who can reach the Docker API, consider **socket-proxy** or rootless Docker where feasible.

## Postgres exposure

- Do not publish Postgres to the public internet without a **narrow** ACL and a clear operational reason.
- Prefer **SSH tunnel**, **Tailscale/WireGuard**, or **private subnet** access for humans and batch jobs.

## Backups

- Encrypt artifacts **before** upload; use a **backup-only** cloud identity; run **restore drills**. Details: [backup-offsite.md](backup-offsite.md).

## Observability

- Grafana and Prometheus should not be world-readable on the internet. Keep them on localhost-bound ports, VPN, or behind Traefik with auth when exposed.

