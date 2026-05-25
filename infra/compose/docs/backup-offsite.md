# Postgres backups and off-site sync

Logical dumps are **one layer** of a backup story. Treat off-site files as **sensitive** (they are your data) and assume the upload path can fail or be abused.

## One-off dump (Compose service name `postgres`)

From the `compose/` directory, with the stack running:

```bash
set -a; source .env 2>/dev/null || true; set +a
DUMP="/tmp/db_backup_$(date +%Y%m%d%H%M%S).sql.gz"
docker compose exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-app}" -d "${POSTGRES_DB:-app}" | gzip > "$DUMP"
ls -la "$DUMP"
```

Restore (destructive; always test on a **throwaway** database first):

```bash
gunzip -c "$DUMP" | docker compose exec -T postgres \
  psql -U "${POSTGRES_USER:-app}" -d "${POSTGRES_DB:-app}"
```

## Encrypt before upload (recommended)

Uploading **plain** `.sql.gz` to object storage means anyone with bucket access (or a mis-ACL) reads the full database.

**age** (simple):

```bash
DUMP="/tmp/db_backup_$(date +%Y%m%d%H%M%S).sql.gz"
ENC="${DUMP}.age"
docker compose exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-app}" -d "${POSTGRES_DB:-app}" | gzip > "$DUMP"
age -r "$AGE_PUBLIC_KEY" -o "$ENC" "$DUMP"
rm -f "$DUMP"
# upload "$ENC" only; decrypt with age -i key.txt -d on restore
```

**GPG** (if you already standardize on it):

```bash
gpg --encrypt --recipient your@email.com -o "${DUMP}.gpg" "$DUMP"
rm -f "$DUMP"
```

Store the **private** key or age identity **outside** the repo (password manager, HSM, or sealed CI secret).

## Off-site copy (rclone)

1. Install [rclone](https://rclone.org/) on the host (or on a **dedicated** backup runner).
2. Run `rclone config` **on that machine only**. Keep `rclone.conf` at `~/.config/rclone/rclone.conf` with `chmod 600`. **Never commit** remotes, client secrets, or refresh tokens to git.
3. Prefer a **backup-only** cloud principal (narrow scope: one bucket or folder, no unrelated APIs).
4. Upload:

```bash
export RCLONE_REMOTE_NAME="myremote"
export RCLONE_REMOTE_PATH="backups/db"
rclone copy "$ENC" "${RCLONE_REMOTE_NAME}:${RCLONE_REMOTE_PATH}" --progress --checksum
```

5. After `rclone` reports success, delete local ciphertext if you trust the remote retention policy:

```bash
rm -f "$ENC"
```

6. **Alert on failure**: non-zero exit from `pg_dump`, `age`/`gpg`, or `rclone` must page someone (cron mail, webhook, metrics).

## Restore drills (do these on a schedule)

Quarterly (or after every schema change):

1. Pick a random backup artifact from cold storage.
2. Restore into a **new** empty database name on a non-production host.
3. Run a **smoke query** (row count on a known table, or `SELECT 1`).
4. Time the restore; that is your realistic **RTO**.

If you never drill, you do not have backups; you have **hope**.

## Cron wrapper

Run as a dedicated Unix user with minimal rights:

```cron
30 2 * * * /path/to/backup-wrapper.sh >> /var/log/db-backup.log 2>&1
```

See [backup-wrapper.example.sh](../scripts/backup-wrapper.example.sh) for a starting skeleton.

## When `pg_dump` is not enough

For **point-in-time recovery** and smaller RPO, add **continuous archiving** (WAL) or a dedicated tool:

- [pgBackRest](https://pgbackrest.org/)
- [WAL-G](https://github.com/wal-g/wal-g)
- Managed Postgres from your cloud (backups + PITR as a product)

This template does not ship WAL archiving; it documents the upgrade path.

## What not to do

- Do not commit `rclone` remotes, OAuth tokens, or age/GPG **private** keys to any repo.
- Do not expose Postgres **5432** to `0.0.0.0/0` for “easier backups”; use a tunnel, VPN, or private network.
