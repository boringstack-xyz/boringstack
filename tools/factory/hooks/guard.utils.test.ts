import { describe, expect, test } from "bun:test";

import { FACTORY_CONFIG } from "../factory.config";
import { checkBash, checkRead, checkSearch } from "./guard.utils";

const policy = FACTORY_CONFIG;

const denied = (
  command: string,
  branch = "factory/issue-1",
  shared = false
): boolean =>
  !checkBash(command, {
    cwd: "/w",
    home: "/h",
    checkout: () => ({ branch, shared }),
    policy,
  }).allow;

describe("pushing", () => {
  test("never allows a force push", () => {
    expect(denied("git push --force")).toBe(true);
    expect(denied('git -C "/w/my repo" push --force origin feat')).toBe(true);
    expect(denied("git push -f origin factory/issue-1")).toBe(true);
    expect(denied("git push --force-with-lease")).toBe(true);
    expect(denied("git push origin +factory/issue-1")).toBe(true);
  });

  test("blocks protected branches, named or checked out", () => {
    expect(denied("git push origin main")).toBe(true);
    expect(denied("git push origin HEAD:refs/heads/master")).toBe(true);
    expect(denied("git push", "main")).toBe(true);
    expect(denied("git push origin HEAD", "main")).toBe(true);
    expect(denied("git push origin 'HEAD:main'")).toBe(true);
    expect(denied("(git push origin main)")).toBe(true);
    expect(denied("git push --all origin")).toBe(true);
  });

  test("allows feature branches", () => {
    expect(denied("git push -u origin factory/issue-1")).toBe(false);
    expect(denied("git push origin HEAD:factory/issue-1", "main")).toBe(false);
    expect(denied("git push origin main:factory/issue-1", "main")).toBe(false);
    expect(denied("git push origin HEAD")).toBe(false);
  });

  test("ignores push in messages and searches", () => {
    expect(denied('git commit -m "git push origin main later"')).toBe(false);
    expect(denied("git log --grep push")).toBe(false);
  });

  test("refuses git in a folder a variable names", () => {
    expect(denied('cd "$DIR" && git push origin feat')).toBe(true);
  });
});

describe("shared checkouts", () => {
  test("refuses a branch switch only where the checkout is shared", () => {
    expect(denied("git switch other", "main", true)).toBe(true);
    expect(denied("git checkout -b other", "main", true)).toBe(true);
    expect(denied("git checkout -- file.ts", "main", true)).toBe(false);
    expect(denied("git switch other", "main", false)).toBe(false);
  });
});

describe("infrastructure", () => {
  test("refuses programs that reach real infrastructure", () => {
    expect(denied("kubectl get pods")).toBe(true);
    expect(denied("sudo helm upgrade x")).toBe(true);
    expect(denied('bash -c "kubectl apply -f x"')).toBe(true);
    expect(denied("echo $(vault kv get secret)")).toBe(true);
  });

  test("allows planning but not applying", () => {
    expect(denied("tofu plan")).toBe(false);
    expect(denied("tofu apply -auto-approve")).toBe(true);
    expect(denied("terraform destroy")).toBe(true);
  });

  test("a word in an argument is not a program", () => {
    expect(denied("grep kubectl infra/k3s/README.md")).toBe(false);
    expect(denied('git commit -m "kubectl docs"')).toBe(false);
  });
});

describe("secrets", () => {
  test("refuses printing env files and keys", () => {
    expect(denied("cat apps/api/.env")).toBe(true);
    expect(denied("cat .env.local | grep KEY")).toBe(true);
    expect(denied("cat infra/k3s/overlays/prod/secrets/plain/secret.env")).toBe(
      true
    );
    expect(denied("cat .agent-state/sandboxes/abc.json")).toBe(true);
    expect(denied("head .env*")).toBe(true);
    expect(denied("xargs cat < list")).toBe(false);
    expect(denied("cat $(ls .env)")).toBe(true);
  });

  test("allows listing and key names", () => {
    expect(denied("ls -la apps/api/.env")).toBe(false);
    expect(denied("cut -d= -f1 apps/api/.env")).toBe(false);
    expect(denied("test -f .env && echo yes")).toBe(false);
  });

  test("templates and look-alikes are not secrets", () => {
    expect(denied("cat apps/api/.env.example")).toBe(false);
    expect(denied("cat api.prod.env.example")).toBe(false);
    expect(denied("env FOO=1 bun run test")).toBe(false);
    expect(denied("grep -r environment apps")).toBe(false);
    expect(denied("grep '.*error' log.txt")).toBe(false);
    expect(denied("grep -rn process.env apps/api/src")).toBe(false);
    expect(denied("grep -rn 'import.meta.env' apps/ui/src")).toBe(false);
  });

  test("a heredoc or message that names a secret file reads nothing", () => {
    expect(denied("cat > note.md <<'EOF'\nnever cat .env\nEOF")).toBe(false);
  });

  test("the Read, Grep and Glob tools", () => {
    expect(checkRead("/w/apps/api/.env", policy).allow).toBe(false);
    expect(checkRead("/w/apps/api/.env.example", policy).allow).toBe(true);
    expect(checkSearch("Glob", { pattern: ".env*" }, policy).allow).toBe(false);
    expect(
      checkSearch("Grep", { pattern: "SECRET", path: "/w/.env" }, policy).allow
    ).toBe(false);
    expect(
      checkSearch("Grep", { pattern: ".env", path: "/w/apps" }, policy).allow
    ).toBe(true);
  });
});

describe("dev containers", () => {
  test("refuses checks inside a running dev container", () => {
    expect(denied("docker compose exec api-dev bun run test")).toBe(true);
    expect(
      denied('docker exec boringstack-api-dev-1 sh -c "cd /app && bunx tsc"')
    ).toBe(true);
    expect(denied("docker compose exec -w /app ui-dev npx vitest")).toBe(true);
  });

  test("allows looking around a container, and other containers", () => {
    expect(denied("docker compose exec api-dev ls /app")).toBe(false);
    expect(denied("docker compose exec postgres psql -c 'select 1'")).toBe(
      false
    );
  });
});

describe("hostile input", () => {
  test("is decided quickly, however many options precede push", () => {
    const options = " -C -C".repeat(5_000);
    const started = performance.now();

    expect(denied(`git${options} push --force`)).toBe(true);
    expect(denied(`git${options} status`)).toBe(false);
    expect(denied(`${"A=b ".repeat(5_000)}bash -c 'ls'`)).toBe(false);
    expect(performance.now() - started).toBeLessThan(1_000);
  });

  test("still reads -C and -c options before push", () => {
    expect(denied("git -C /w -c user.name=x push --force")).toBe(true);
    expect(denied("git -Cfoo push origin main")).toBe(true);
  });
});
