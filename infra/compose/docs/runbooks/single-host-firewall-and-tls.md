# Single-host firewall and TLS renewal

Generic notes for a small VPS (for example Hetzner, OVH, or any Linux host) when HTTP(S) is fronted by **Cloudflare** and TLS is terminated on the box (nginx, Caddy, Traefik, or similar) with **Let’s Encrypt** (Certbot or ACME via proxy).

This is not a copy-paste for one provider. Adapt names, IPs, and consoles to your host and DNS.

## Goals

- Only **Cloudflare** (or your chosen CDN) should reach **80/tcp and 443/tcp** on the origin, unless you intentionally expose direct HTTP for debugging.
- **SSH** should be reachable only from addresses you control (home IP, bastion, or tailnet).
- **Database ports** should not be public. If a SaaS (BI tool, managed backup) must reach Postgres, allow **only** that provider’s published IP ranges, and prefer a private link or SSH tunnel when you can.

## Layering

Typical stack:

1. **Cloud / VPS firewall** (Hetzner Cloud Firewall, AWS security groups, etc.): first line, enforced outside the VM.
2. **UFW** (or nftables) on the host: second line, easy to reason about on Debian/Ubuntu.

Keep both in sync conceptually: if UFW allows 443 from anywhere but the cloud firewall only allows Cloudflare, you still get the intended effect. If both restrict to Cloudflare, you have defense in depth.

## Cloudflare IP ranges on the origin

If traffic must go through Cloudflare, restrict **80** and **443** to [Cloudflare’s published IP ranges](https://www.cloudflare.com/ips/) (IPv4 and IPv6). Those lists change; refresh your rules periodically.

On **UFW**, that means many `allow from <cidr> to any port 80,443 proto tcp` rules (or an equivalent nftables set). Example shape (do **not** treat as an up-to-date CIDR list):

```bash
sudo ufw allow from 203.0.113.0/24 to any port 80,443 proto tcp
# ...repeat for each current Cloudflare CIDR from their docs...
```

You can script generation from the official JSON/text lists so updates are repeatable.

## SSH

```bash
sudo ufw allow OpenSSH
# or: sudo ufw allow from YOUR_HOME_IP to any port 22 proto tcp
sudo ufw enable
sudo ufw status verbose
```

Prefer SSH keys, disable password auth, and consider `Fail2ban` or only allowing SSH over a VPN or tailnet.

## DNS-01 vs HTTP-01 (pick deliberately)

| Challenge   | What it needs                                                                                                       | When it fits                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **HTTP-01** | Let’s Encrypt (or the CA) can reach your host on **port 80** for `http://<hostname>/.well-known/acme-challenge/...` | Simple VPS, origin can expose 80 during issuance/renewal, or you terminate HTTP at the edge and forward challenges.            |
| **DNS-01**  | Your ACME client creates a **TXT** record at `_acme-challenge.<hostname>` via your DNS provider’s API               | Origin **port 80 is closed**, split-horizon DNS, wildcard certs, or you want renewal **without** poking holes in UFW for HTTP. |

This repo’s **Traefik production overlay** uses **HTTP-01** on the `web` entrypoint. If you hard-lock 80 to Cloudflare-only or disable it entirely, plan to **switch Traefik to a DNS challenge** resolver for your provider, or renew through a separate process that updates certs on disk Traefik reads.

## TLS renewal (Let’s Encrypt) when 80/443 are locked down

HTTP-01 challenges need **port 80** reachable by Let’s Encrypt from the internet **unless** you use DNS-01 (recommended when HTTP is closed to non-Cloudflare clients).

If you use **HTTP-01** behind Cloudflare:

- During renewal, you may need to **temporarily** allow direct HTTP to the origin (or use Cloudflare “DNS only” / gray cloud for the ACME hostname while renewing). Exact steps depend on Cloudflare settings and whether Orange Cloud proxies ACME paths.

Operational checklist (high level):

1. Note current firewall rules (cloud + UFW).
2. Open what ACME needs (often **80** from the Let’s Encrypt network, or switch to **DNS-01** and avoid that).
3. Run renewal (`certbot renew` or your ACME client).
4. Restore strict rules and verify `sudo ufw status verbose` and the cloud firewall UI.

If **Certbot** fails silently, check that **both** the **cloud firewall** and **UFW** allow the probe path for the duration of renewal.

## Provider firewall console

Whatever your host uses (Hetzner “Firewalls”, etc.), document for your team:

- Which rules apply to which servers.
- Who may change them.
- How to roll back if SSH is accidentally blocked (serial console / rescue mode / out-of-band).

## Further reading

- Cloudflare: [IP ranges](https://www.cloudflare.com/ips/)
- Let’s Encrypt: [challenge types](https://letsencrypt.org/docs/challenge-types/)
