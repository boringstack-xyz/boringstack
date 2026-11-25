import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import type { IPreviewEnvironment } from "../environment";
import { previewSettingsOf } from "./preview.config";
import { proxyVarsOf } from "./preview-routes";

const NO_PREVIEW: IPreviewEnvironment = {
  domain: undefined,
  publicScheme: undefined,
  publicPort: undefined,
  authProvider: undefined,
  authClientId: undefined,
  authClientSecret: undefined,
  authCookieSecret: undefined,
  authEmailDomain: undefined,
  authGithubOrg: undefined,
  authGithubTeam: undefined,
};

const REPO = resolve(import.meta.dir, "..", "..", "..");
const PROXY_FILE = join(
  REPO,
  "infra",
  "compose",
  "compose",
  "preview-proxy.yml"
);
const MANIFEST = join(REPO, ".tsforge", "scaffold-manifest.json");
const ENVIRONMENT = join(REPO, "tools", "factory", "environment.ts");

interface IService {
  readonly image?: string;
  readonly profiles?: readonly string[];
  readonly healthcheck?: unknown;
  readonly logging?: { options?: Record<string, string> };
  readonly deploy?: { resources?: { limits?: { memory?: string } } };
  readonly security_opt?: readonly string[];
}

interface IComposeFile {
  readonly services: Record<string, IService>;
}

interface IManifestField {
  readonly key: string;
  readonly kind: string;
}

const isManifest = (
  value: unknown
): value is { readonly fields: readonly IManifestField[] } =>
  typeof value === "object" &&
  value !== null &&
  "fields" in value &&
  Array.isArray(value.fields);

const isComposeFile = (value: unknown): value is IComposeFile =>
  typeof value === "object" && value !== null && "services" in value;

const parsed: unknown = Bun.YAML.parse(readFileSync(PROXY_FILE, "utf8"));

if (!isComposeFile(parsed)) {
  throw new Error("preview-proxy.yml has no services");
}

const compose: IComposeFile = parsed;
const raw = readFileSync(PROXY_FILE, "utf8");

describe("preview proxy compose policy", () => {
  test("every service has a pinned image, a healthcheck, log rotation, a memory limit and no-new-privileges", () => {
    for (const [name, service] of Object.entries(compose.services)) {
      expect({
        name,
        pinned: (service.image ?? "").includes("@sha256:"),
      }).toEqual({
        name,
        pinned: true,
      });
      expect({ name, healthcheck: service.healthcheck !== undefined }).toEqual({
        name,
        healthcheck: true,
      });
      expect({
        name,
        rotated: service.logging?.options?.["max-size"] !== undefined,
      }).toEqual({
        name,
        rotated: true,
      });
      expect({
        name,
        memory: service.deploy?.resources?.limits?.memory !== undefined,
      }).toEqual({
        name,
        memory: true,
      });
      expect({
        name,
        nnp: (service.security_opt ?? []).includes("no-new-privileges:true"),
      }).toEqual({ name, nnp: true });
    }
  });

  test("the login service runs only in the auth profile, and nginx never needs it to start", () => {
    expect(compose.services["oauth2-proxy"]?.profiles).toEqual(["auth"]);
    expect(compose.services["preview-proxy"]?.profiles).toBeUndefined();
  });

  test("every variable the compose file reads is one the factory writes", () => {
    const names = [...raw.matchAll(/\$\{([A-Z_][A-Z0-9_]*)/gu)].map(
      (match) => match[1] ?? ""
    );
    const withAuth = proxyVarsOf(
      "/d",
      previewSettingsOf({
        ...NO_PREVIEW,
        authProvider: "google",
        authClientId: "c",
        authClientSecret: "s",
        authCookieSecret: "c".repeat(16),
        authEmailDomain: "example.com",
      })
    );
    const withoutAuth = proxyVarsOf("/d", previewSettingsOf(NO_PREVIEW));
    const written = new Set(
      [
        ...`${withAuth}\n${withoutAuth}`.matchAll(/^([A-Z_][A-Z0-9_]*)=/gmu),
      ].map((match) => match[1] ?? "")
    );

    for (const name of names) {
      expect({ name, written: written.has(name) }).toEqual({
        name,
        written: true,
      });
    }
  });
});

describe("preview settings are registered", () => {
  const manifestText: string = readFileSync(MANIFEST, "utf8");
  const manifest: unknown = JSON.parse(manifestText);
  const fields = isManifest(manifest) ? manifest.fields : [];
  const environmentSource = readFileSync(ENVIRONMENT, "utf8");
  const read = [
    ...environmentSource.matchAll(/process\.env\.(PREVIEW_[A-Z_]+)/gu),
  ].map((match) => match[1] ?? "");

  test("the factory reads at least the documented preview variables", () => {
    expect(read.length).toBeGreaterThanOrEqual(10);
  });

  test("every PREVIEW_* the factory reads has a scaffold-manifest field", () => {
    const keys = new Set(fields.map((field) => field.key));

    for (const name of read) {
      expect({ name, registered: keys.has(name) }).toEqual({
        name,
        registered: true,
      });
    }
  });

  test("login credentials are declared as secrets", () => {
    const kinds = new Map(fields.map((field) => [field.key, field.kind]));

    for (const name of [
      "PREVIEW_AUTH_CLIENT_ID",
      "PREVIEW_AUTH_CLIENT_SECRET",
      "PREVIEW_AUTH_COOKIE_SECRET",
    ]) {
      expect({ name, kind: kinds.get(name) }).toEqual({ name, kind: "secret" });
    }
  });
});
