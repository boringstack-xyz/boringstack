#!/bin/sh
# Render alertmanager.yml from env vars, then exec the Alertmanager binary.
#
# Why this script exists: Alertmanager has no native env-var substitution in
# its config file, but we want a "set one env var and you're done" UX for
# wiring Slack/Discord/webhook receivers. This entrypoint builds the receiver
# block dynamically based on which ALERTMANAGER_* env vars are populated,
# then hands off to /bin/alertmanager.
#
# Empty env → that receiver block is omitted entirely (Alertmanager refuses
# to load a config with an empty URL, so we can't just leave placeholders).
# If neither receiver is configured, the route fires alerts into the
# Alertmanager UI only — a valid setup for "I want to see alerts at
# :9093 but not pager myself yet."
#
# Discord trick: Discord's webhook accepts Slack-format payloads when the
# URL ends in `/slack`. Set ALERTMANAGER_SLACK_WEBHOOK_URL to your Discord
# webhook with `/slack` appended and the Slack block below handles it.

set -eu

CFG=/tmp/alertmanager.yml

cat > "$CFG" <<'EOF'
global:
  resolve_timeout: 5m

route:
  receiver: "default"
  group_by: [alertname, severity, component]
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  routes:
    # Critical alerts (severity=page) re-notify hourly.
    - matchers: [severity="page"]
      receiver: "default"
      repeat_interval: 1h
    # Warnings (severity=warn) re-notify every 12h so they don't pager-spam.
    - matchers: [severity="warn"]
      receiver: "default"
      repeat_interval: 12h

receivers:
  - name: "default"
EOF

if [ -n "${ALERTMANAGER_SLACK_WEBHOOK_URL:-}" ]; then
  cat >> "$CFG" <<EOF
    slack_configs:
      - api_url: "${ALERTMANAGER_SLACK_WEBHOOK_URL}"
        channel: "${ALERTMANAGER_SLACK_CHANNEL:-#alerts}"
        send_resolved: true
        title: '[{{ .Status | toUpper }}{{ if eq .Status "firing" }}:{{ .Alerts.Firing | len }}{{ end }}] {{ .CommonLabels.alertname }}'
        text: |-
          {{ range .Alerts -}}
          *Severity:* \`{{ .Labels.severity }}\` *Component:* \`{{ .Labels.component }}\`
          *Summary:* {{ .Annotations.summary }}
          {{ if .Annotations.description }}*Details:* {{ .Annotations.description }}{{ end }}
          {{ end }}
EOF
fi

if [ -n "${ALERTMANAGER_WEBHOOK_URL:-}" ]; then
  cat >> "$CFG" <<EOF
    webhook_configs:
      - url: "${ALERTMANAGER_WEBHOOK_URL}"
        send_resolved: true
EOF
fi

echo "[alertmanager-entrypoint] rendered config:"
sed 's/^/  /' "$CFG"

exec /bin/alertmanager \
  --config.file="$CFG" \
  --storage.path=/alertmanager \
  "$@"
