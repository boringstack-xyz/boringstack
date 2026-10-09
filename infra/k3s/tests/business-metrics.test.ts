import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { YAML } from "bun";

/*
 * Business metrics contract: the CNPG custom queries and the Grafana dashboard
 * may only read the template's real tables and columns, only through the
 * column grants shipped in the drizzle migrations, and never expose columns
 * that identify or authenticate a person.
 */

const repoRoot = join(import.meta.dir, "..", "..", "..");
const drizzleDir = join(repoRoot, "apps/api/drizzle");
const monitoringDir = join(repoRoot, "infra/k3s/overlays/prod/monitoring");

// Never granted to the exporter, even as aggregates.
const DENIED_COLUMNS = new Set([
  "email",
  "first_name",
  "last_name",
  "ip",
  "user_agent",
  "metadata",
  "password_hash",
  "token_hash",
  "code_hash",
  "mfa_secret_encrypted",
  "mfa_last_totp_step",
  "stripe_customer_id",
  "stripe_subscription_id",
  "last_stripe_event_id",
  "event_id",
  "resource",
  "request_id",
]);

interface ISnapshot {
  tables: Record<string, { columns: Record<string, unknown> }>;
}

interface IQuery {
  query: string;
  primary: boolean;
  target_databases: string[];
  metrics: Array<Record<string, { usage: string }>>;
}

const unquote = (identifier: string) => identifier.trim().replace(/"/g, "");

const stripSqlComments = (sql: string) =>
  sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--.*$/gm, "");

const latestSnapshot = (): ISnapshot => {
  const journal = JSON.parse(
    readFileSync(join(drizzleDir, "meta/_journal.json"), "utf8"),
  ) as { entries: Array<{ tag: string }> };
  const tag = journal.entries.at(-1)?.tag;
  if (!tag) throw new Error("drizzle journal has no entries");
  return JSON.parse(
    readFileSync(
      join(drizzleDir, "meta", `${tag.split("_")[0]}_snapshot.json`),
      "utf8",
    ),
  ) as ISnapshot;
};

// schema.table -> column names, from the latest drizzle snapshot.
const schemaColumns = (): Map<string, Set<string>> => {
  const snapshot = latestSnapshot();
  return new Map(
    Object.entries(snapshot.tables).map(([table, value]) => [
      table,
      new Set(Object.keys(value.columns)),
    ]),
  );
};

// Grants to pg_monitor across every migration, in statement order.
const monitorGrants = () => {
  const sql = readdirSync(drizzleDir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => stripSqlComments(readFileSync(join(drizzleDir, file), "utf8")))
    .join("\n");
  const schemas = new Set<string>();
  for (const match of sql.matchAll(
    /GRANT\s+USAGE\s+ON\s+SCHEMA\s+([^;]+?)\s+TO\s+pg_monitor/gi,
  )) {
    for (const schema of (match[1] ?? "").split(",")) {
      schemas.add(unquote(schema));
    }
  }
  const columns = new Map<string, Set<string>>();
  for (const match of sql.matchAll(
    /GRANT\s+SELECT\s*\(([^)]*)\)\s+ON\s+([^;]+?)\s+TO\s+pg_monitor/gi,
  )) {
    const table = (match[2] ?? "")
      .split(".")
      .map((part) => unquote(part))
      .join(".");
    const granted = columns.get(table) ?? new Set<string>();
    for (const column of (match[1] ?? "").split(",")) {
      granted.add(unquote(column));
    }
    columns.set(table, granted);
  }
  return { schemas, columns };
};

const businessQueries = (): Record<string, IQuery> => {
  const configMap = YAML.parse(
    readFileSync(join(monitoringDir, "cnpg-business-queries.yaml"), "utf8"),
  ) as { data: { queries: string } };
  return YAML.parse(configMap.data.queries) as Record<string, IQuery>;
};

// cnpg_<query>_<column> for every non-label column.
const producedMetrics = (queries: Record<string, IQuery>) => {
  const metrics = new Map<string, { labels: Set<string> }>();
  for (const [name, query] of Object.entries(queries)) {
    const labels = new Set<string>();
    for (const entry of query.metrics) {
      for (const [column, spec] of Object.entries(entry)) {
        if (spec.usage === "LABEL") labels.add(column);
      }
    }
    for (const entry of query.metrics) {
      for (const [column, spec] of Object.entries(entry)) {
        if (spec.usage !== "LABEL") {
          metrics.set(`cnpg_${name}_${column}`, { labels });
        }
      }
    }
  }
  return metrics;
};

describe("business metrics: queries against the template schema", () => {
  const schema = schemaColumns();
  const grants = monitorGrants();
  const queries = businessQueries();

  test("every granted column exists in the schema and is not a denied column", () => {
    for (const [table, columns] of grants.columns) {
      expect(schema.has(table)).toBe(true);
      for (const column of columns) {
        expect(schema.get(table)?.has(column)).toBe(true);
        expect(DENIED_COLUMNS.has(column)).toBe(false);
      }
    }
  });

  test("the exporter can use the schemas the queries touch", () => {
    for (const table of grants.columns.keys()) {
      const [owner] = table.split(".");
      expect(grants.schemas.has(owner ?? "")).toBe(true);
    }
  });

  test("queries are primary-only and target the application database", () => {
    for (const [name, query] of Object.entries(queries)) {
      expect({ name, primary: query.primary }).toEqual({ name, primary: true });
      expect(query.target_databases).toEqual(["boringstack"]);
    }
  });

  test("every qualified column in every query is a real, granted column", () => {
    for (const [name, query] of Object.entries(queries)) {
      const sql = query.query;
      expect(sql, name).not.toMatch(/SELECT\s+\*/i);
      const aliases = new Map<string, string>();
      for (const match of sql.matchAll(
        /\b(?:FROM|JOIN)\s+(\w+)\.(\w+)\s+(\w+)/gi,
      )) {
        aliases.set(match[3] ?? "", `${match[1]}.${match[2]}`);
      }
      expect(aliases.size, name).toBeGreaterThan(0);
      const cleaned = sql
        .replace(/'[^']*'/g, "''")
        .replace(/\b(FROM|JOIN)\s+\w+\.\w+\s+\w+/gi, "$1 ")
        .replace(/\bAS\s+\w+/gi, "");
      for (const match of cleaned.matchAll(/\b(\w+)\.(\w+)\b/g)) {
        const [, alias, column] = match;
        const table = aliases.get(alias ?? "");
        expect(table, `${name}: unknown alias ${alias}`).toBeDefined();
        expect(
          schema.get(table ?? "")?.has(column ?? ""),
          `${name}: ${table}.${column} is not a column`,
        ).toBe(true);
        expect(
          grants.columns.get(table ?? "")?.has(column ?? ""),
          `${name}: ${table}.${column} is not granted to pg_monitor`,
        ).toBe(true);
      }
    }
  });

  test("each query's output columns match its declared metrics", () => {
    for (const [name, query] of Object.entries(queries)) {
      const selectList = query.query.slice(
        0,
        query.query.search(/\bFROM\b/i),
      );
      const outputs = [...selectList.matchAll(/\bAS\s+(\w+)/gi)].map(
        (match) => match[1],
      );
      const declared = query.metrics.flatMap((entry) => Object.keys(entry));
      expect(outputs.sort(), name).toEqual(declared.sort());
    }
  });
});

describe("business metrics: rendered production overlay", () => {
  const rendered = Bun.spawnSync(
    ["kubectl", "kustomize", "infra/k3s/overlays/prod"],
    { cwd: repoRoot },
  );
  if (rendered.exitCode !== 0) {
    throw new Error(rendered.stderr.toString());
  }
  const documents = rendered.stdout
    .toString()
    .split(/^---$/m)
    .filter((doc) => doc.trim() !== "")
    .map((doc) => YAML.parse(doc) as Record<string, any>);
  const resource = (kind: string, name: string) => {
    const item = documents.find(
      (doc) => doc.kind === kind && doc.metadata?.name === name,
    );
    if (!item) throw new Error(`Missing ${kind}/${name}`);
    return item;
  };

  test("the CNPG cluster loads the default and business query sets", () => {
    const names = resource("Cluster", "boringstack-db").spec.monitoring
      .customQueriesConfigMap.map((ref: { name: string }) => ref.name);
    expect(names).toEqual([
      "cnpg-default-monitoring",
      "boringstack-db-business-metrics",
    ]);
    expect(
      resource("ConfigMap", "boringstack-db-business-metrics").metadata.labels[
        "cnpg.io/reload"
      ],
    ).toBe("");
  });

  test("the PodMonitor scrapes every CNPG instance of the cluster", () => {
    const monitor = resource("PodMonitor", "boringstack-db");
    expect(monitor.spec.selector.matchLabels).toEqual({
      "cnpg.io/cluster": "boringstack-db",
    });
    expect(monitor.spec.podMetricsEndpoints[0].port).toBe("metrics");
  });

  test("the rendered queries match the source file", () => {
    const rendered = resource(
      "ConfigMap",
      "boringstack-db-business-metrics",
    ).data.queries;
    expect(Object.keys(YAML.parse(rendered))).toEqual(
      Object.keys(businessQueries()),
    );
  });

  test("the dashboard ConfigMap is picked up by the Grafana sidecar", () => {
    const dashboard = resource("ConfigMap", "boringstack-business-dashboard");
    expect(dashboard.metadata.labels.grafana_dashboard).toBe("1");
  });

  test("every dashboard query reads a metric the queries produce, grouped by its labels", () => {
    const dashboard = JSON.parse(
      resource("ConfigMap", "boringstack-business-dashboard").data[
        "boringstack-business.json"
      ],
    ) as {
      panels: Array<{
        targets: Array<{ expr: string }>;
      }>;
    };
    const produced = producedMetrics(businessQueries());
    const exprs = dashboard.panels.flatMap((panel) =>
      panel.targets.map((target) => target.expr),
    );
    expect(exprs.length).toBeGreaterThan(0);
    for (const expr of exprs) {
      for (const [metric] of expr.matchAll(/cnpg_[a-z0-9_]+/g)) {
        const known = produced.get(metric);
        expect(known, `dashboard reads unknown metric ${metric}`).toBeDefined();
        const grouped = expr.match(/\bby\s*\(([^)]*)\)/);
        for (const label of (grouped?.[1] ?? "").split(",")) {
          const name = label.trim();
          if (name === "") continue;
          expect(
            known?.labels.has(name),
            `${metric} has no label ${name}`,
          ).toBe(true);
        }
      }
    }
  });
});
