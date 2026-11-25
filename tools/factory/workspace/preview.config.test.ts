import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { IPreviewEnvironment } from "../environment";
import { previewSettingsOf } from "./preview.config";
import { routesConf } from "./preview.utils";
import { gateStaysOn, proxyVarsOf } from "./preview-routes";

const none: IPreviewEnvironment = {
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

const googleEnv: IPreviewEnvironment = {
  ...none,
  authProvider: "google",
  authClientId: "client-id",
  authClientSecret: "client-secret",
  authCookieSecret: "c".repeat(16),
  authEmailDomain: "example.com",
};

describe("preview settings", () => {
  test("default is localhost, http, port 8600, and no login gate", () => {
    const settings = previewSettingsOf(none);

    expect(settings.domain).toBe("preview.localhost");
    expect(settings.publicScheme).toBe("http");
    expect(settings.publicPort).toBe(8600);
    expect(settings.auth).toBeUndefined();
    expect(settings.problems).toEqual([]);
  });

  test("provider off is the same as unset", () => {
    expect(
      previewSettingsOf({ ...none, authProvider: "off" }).auth
    ).toBeUndefined();
  });

  test("google needs an email domain; github needs an organisation", () => {
    const noDomain = previewSettingsOf({
      ...googleEnv,
      authEmailDomain: undefined,
    });
    const noOrg = previewSettingsOf({
      ...googleEnv,
      authProvider: "github",
      authEmailDomain: undefined,
    });

    expect(noDomain.problems.join(" ")).toContain("PREVIEW_AUTH_EMAIL_DOMAIN");
    expect(noOrg.problems.join(" ")).toContain("PREVIEW_AUTH_GITHUB_ORG");
  });

  test("github with an organisation is accepted, team optional", () => {
    const settings = previewSettingsOf({
      ...googleEnv,
      authProvider: "github",
      authEmailDomain: undefined,
      authGithubOrg: "acme",
    });

    expect(settings.problems).toEqual([]);
    expect(settings.auth?.provider).toBe("github");
    expect(settings.auth?.githubOrg).toBe("acme");
  });

  test("a team without an organisation is refused", () => {
    const settings = previewSettingsOf({
      ...googleEnv,
      authProvider: "github",
      authEmailDomain: undefined,
      authGithubTeam: "platform",
    });

    expect(settings.problems.join(" ")).toContain("PREVIEW_AUTH_GITHUB_TEAM");
  });

  test("the cookie secret must be 16, 24 or 32 bytes", () => {
    for (const secret of ["short", "x".repeat(17), "x".repeat(33)]) {
      const settings = previewSettingsOf({
        ...googleEnv,
        authCookieSecret: secret,
      });

      expect(settings.problems.join(" ")).toContain(
        "PREVIEW_AUTH_COOKIE_SECRET"
      );
    }

    expect(
      previewSettingsOf({ ...googleEnv, authCookieSecret: "x".repeat(32) })
        .problems
    ).toEqual([]);
  });

  test("a login provider without its client credentials is refused, never open", () => {
    const settings = previewSettingsOf({
      ...googleEnv,
      authClientId: undefined,
      authClientSecret: undefined,
    });

    expect(settings.auth).toBeUndefined();
    expect(settings.problems.join(" ")).toContain("PREVIEW_AUTH_CLIENT_ID");
    expect(settings.problems.join(" ")).toContain("PREVIEW_AUTH_CLIENT_SECRET");
  });

  test("an unknown provider is refused", () => {
    expect(
      previewSettingsOf({ ...none, authProvider: "okta" }).problems.join(" ")
    ).toContain("PREVIEW_AUTH_PROVIDER must be");
  });

  test("a TLS tunnel uses https on 443 with no port in the URL", () => {
    const settings = previewSettingsOf({
      ...googleEnv,
      domain: "Preview.Example.com",
      publicScheme: "https",
      publicPort: "443",
    });

    expect(settings.domain).toBe("preview.example.com");
    expect(settings.problems).toEqual([]);
  });

  test("a domain that is not a domain name is refused", () => {
    expect(
      previewSettingsOf({ ...none, domain: "bad domain/x" }).problems.join(" ")
    ).toContain("PREVIEW_DOMAIN");
  });
});

describe("proxy variables", () => {
  test("auth off writes no secrets and no compose profile", () => {
    const text = proxyVarsOf("/shared/preview", previewSettingsOf(none));

    expect(text).toContain("COMPOSE_PROFILES=\n");
    expect(text).not.toContain("OAUTH2_PROXY");
  });

  test("auth on switches the auth profile and scopes the cookie to the parent domain", () => {
    const text = proxyVarsOf("/shared/preview", previewSettingsOf(googleEnv));

    expect(text).toContain("COMPOSE_PROFILES=auth");
    expect(text).toContain("OAUTH2_PROXY_COOKIE_DOMAINS=.preview.localhost");
    expect(text).toContain(
      "OAUTH2_PROXY_REDIRECT_URL=http://auth.preview.localhost:8600/oauth2/callback"
    );
    expect(text).toContain("OAUTH2_PROXY_EMAIL_DOMAINS=example.com");
    expect(text).toContain("OAUTH2_PROXY_COOKIE_SECURE=false");
  });
});

describe("the login gate stays on unless turned off on purpose", () => {
  test("a process without PREVIEW_AUTH_PROVIDER keeps a gate that is on", () => {
    const shared = mkdtempSync(join(tmpdir(), "preview-gate-"));
    const dir = join(shared, "preview");

    try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, "proxy.vars"), "COMPOSE_PROFILES=auth\n");
      const settings = previewSettingsOf(none);

      expect(gateStaysOn(shared, settings, undefined)).toBe(true);
      expect(gateStaysOn(shared, settings, "off")).toBe(false);
      expect(gateStaysOn(shared, settings, "google")).toBe(true);
    } finally {
      rmSync(shared, { recursive: true, force: true });
    }
  });
});

describe("preview routes", () => {
  const route = { slot: 2, host: "s2.preview.localhost", uiPort: 7402 };

  test("without auth, each slot routes to its UI and redirects stay on the preview origin", () => {
    const conf = routesConf([route], previewSettingsOf(none));

    expect(conf).toContain("server_name s2.preview.localhost;");
    expect(conf).toContain("proxy_pass http://host.docker.internal:7402;");
    expect(conf).toContain("location = /healthz");
    expect(conf).toContain(
      "proxy_redirect http://127.0.0.1:7402 http://s2.preview.localhost:8600;"
    );
    expect(conf).not.toContain("auth_request");
    expect(conf).not.toContain("oauth2");
  });

  test("with auth, every slot asks the login before the app, and unauthenticated requests go to sign-in", () => {
    const conf = routesConf([route], previewSettingsOf(googleEnv));

    expect(conf).toContain("location = /oauth2/auth");
    expect(conf).toContain("auth_request /oauth2/auth;");
    expect(conf).toContain("error_page 401 = @oauth2_signin;");
    expect(conf).toContain(
      'return 302 "http://auth.preview.localhost:8600/oauth2/start?rd=$forwarded_proto://$http_host$request_uri";'
    );
    expect(conf).toContain("server_name auth.preview.localhost;");
    expect(conf).toContain("location = /healthz");
  });
});
