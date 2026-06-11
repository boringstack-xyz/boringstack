# Monitoring integration

The k3s target does **not** ship Prometheus/Grafana/Loki. It plugs into the
cluster's existing [kube-prometheus-stack](https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack):

- **Metrics** — `servicemonitor.yaml` registers the `api` Service so the cluster
  Prometheus scrapes it. Make sure:
  1. The ServiceMonitor carries whatever label your Prometheus
     `serviceMonitorSelector` matches (often `release: <helm-release>`), or the
     stack is installed with `serviceMonitorSelectorNilUsesHelmValues=false`.
  2. Prometheus is allowed to discover ServiceMonitors in `boringstack-prod`
     (its `serviceMonitorNamespaceSelector` must match this namespace).

- **Logs** — Promtail/Alloy in the cluster already scrapes pod stdout by
  namespace/pod labels; no per-app manifest needed. The pods log to stdout.

- **Dashboards** — the BoringStack Grafana dashboards live in
  `infra/compose/compose/grafana/dashboards/`. To auto-import them into the
  cluster Grafana (sidecar discovery), copy the JSON files into
  `./dashboards/` here and uncomment the `configMapGenerator` in
  `kustomization.yaml`. The generated ConfigMap is labelled
  `grafana_dashboard: "1"`, which the Grafana sidecar watches for.

  ```bash
  mkdir -p dashboards
  cp ../../../../compose/compose/grafana/dashboards/boringstack-*.json dashboards/
  ```

  (We don't reference the compose tree directly because ArgoCD/kustomize block
  path traversal outside the kustomization root by default.)
