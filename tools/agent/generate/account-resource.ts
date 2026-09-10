import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { apply, edit, replaceOnce, type IEdit } from "./patch";
import { renderResourceTemplate } from "./templates";

/** v1 policy is explicit: owner/admin write, member/viewer read. Other policies must be designed, not guessed. */
export function planAccountResource(
  root: string,
  name: string,
  policy: string
): IEdit[] {
  if (!/^[A-Z][a-zA-Z0-9]{1,40}s$/.test(name)) {
    throw new Error("Use a plural PascalCase resource name such as Projects");
  }

  if (policy !== "team-read-admin-write") {
    throw new Error("Explicit --policy=team-read-admin-write required");
  }

  const singular = name.slice(0, -1),
    prefix = name.toLowerCase(),
    upper = singular.toUpperCase();

  if (existsSync(join(root, `apps/api/src/api/${prefix}`))) {
    throw new Error("Resource already exists");
  }

  // A reused CASL subject inherits existing grants, even when interface merging compiles.
  const acl = readFileSync(
    join(root, "apps/api/src/lib/acl/acl.constants.ts"),
    "utf8"
  );
  const types = readFileSync(
    join(root, "apps/api/src/lib/acl/acl.types.ts"),
    "utf8"
  );

  if (
    new RegExp(`["']${singular}["']`).test(acl) ||
    new RegExp(`\\bI${singular}Subject\\b`).test(types)
  ) {
    throw new Error(
      "ACL subject already exists; choose a distinct resource name"
    );
  }

  const changes: IEdit[] = [];

  const newFile = (path: string, source: string): void => {
    if (existsSync(join(root, path))) {
      throw new Error(`Generated target exists: ${path}`);
    }

    changes.push(edit(root, path, () => source));
  };

  const patch = (path: string, fn: (source: string) => string): void => {
    changes.push(edit(root, path, fn));
  };

  newFile(
    `apps/api/src/clients/postgres/schema/${prefix}.schema.ts`,
    renderResourceTemplate(root, "resource.schema.ts.template", {
      name,
      prefix,
      singular,
      upper,
    })
  );
  patch(
    "apps/api/src/clients/postgres/schema/index.ts",
    (source) => source + `\nexport * from "./${prefix}.schema";\n`
  );
  patch(
    "apps/api/src/clients/postgres/schema/relations.ts",
    (source) =>
      `import { ${prefix} } from "./${prefix}.schema";\n` +
      source +
      `\nexport const ${prefix}Relations = relations(${prefix}, ({one}) => ({account:one(accounts,{fields:[${prefix}.accountId],references:[accounts.id]})}));\n`
  );
  patch("apps/api/src/lib/acl/acl.constants.ts", (source) => {
    const anchors = source.match(/"all",?\s*] as const/g);

    if (anchors?.length !== 1) {
      throw new Error("Expected ACL subject tail");
    }

    return replaceOnce(source, anchors[0], `"${singular}", "all"] as const`);
  });
  patch("apps/api/src/lib/acl/acl.types.ts", (source) =>
    replaceOnce(
      source,
      "export type SubjectInstance =",
      `export interface I${singular}Subject extends ForcedSubject<"${singular}"> { readonly accountId: string; }\n\nexport type SubjectInstance = I${singular}Subject |`
    )
  );
  patch("apps/api/src/lib/acl/ability.ts", (source) =>
    replaceOnce(
      source,
      "  const { accountId } = membership;",
      `  const { accountId } = membership;\n\n  can("read", "${singular}", {accountId});\n\n  if (membership.role === ROLE.owner || membership.role === ROLE.admin) { can("manage", "${singular}", {accountId}); }`
    )
  );
  patch("apps/api/src/lib/audit-log/audit-log.constants.ts", (source) =>
    replaceOnce(
      source,
      "} as const;",
      `  ${upper}_CREATED: "${singular.toLowerCase()}.created",\n  ${upper}_UPDATED: "${singular.toLowerCase()}.updated",\n} as const;`
    )
  );
  newFile(
    `apps/api/src/api/${prefix}/${prefix}.constants.ts`,
    renderResourceTemplate(root, "resource.constants.ts.template", {
      name,
      prefix,
      singular,
      upper,
    })
  );
  newFile(
    `apps/api/src/api/${prefix}/${prefix}.types.ts`,
    renderResourceTemplate(root, "resource.types.ts.template", {
      name,
      prefix,
      singular,
      upper,
    })
  );
  newFile(
    `apps/api/src/api/${prefix}/${prefix}.schemas.ts`,
    renderResourceTemplate(root, "resource.schemas.ts.template", {
      name,
      prefix,
      singular,
      upper,
    })
  );
  newFile(
    `apps/api/src/api/${prefix}/${prefix}.service.ts`,
    renderResourceTemplate(root, "resource.service.ts.template", {
      name,
      prefix,
      singular,
      upper,
    })
  );
  newFile(
    `apps/api/src/api/${prefix}/${prefix}.routes.ts`,
    renderResourceTemplate(root, "resource.routes.ts.template", {
      name,
      prefix,
      singular,
      upper,
    })
  );
  patch(
    "apps/api/src/config/routes/routes.ts",
    (source) =>
      `import ${prefix}Routes from "../../api/${prefix}/${prefix}.routes";\n` +
      replaceOnce(
        source,
        "export const routes = {",
        `export const routes = {\n  ${prefix}: ${prefix}Routes,`
      )
  );
  patch("apps/api/src/config/app/app.ts", (source) =>
    replaceOnce(
      source,
      ".use(routes.health)",
      `.group("/api/v1/${prefix}", group => group.use(routes.${prefix}))\n      .use(routes.health)`
    )
  );
  patch("apps/api/src/config/swagger/swagger.ts", (source) =>
    replaceOnce(
      source,
      "    tags: [",
      `    tags: [\n      {name:"${name}",description:"Account-scoped ${prefix}"},`
    )
  );
  patch("apps/api/tests/helpers/db.ts", (source) =>
    replaceOnce(
      source,
      "const CLEANUP_TARGETS = [",
      `const CLEANUP_TARGETS = [\n  "app.${prefix}",`
    )
  );
  const acceptance = readFileSync(
    join(
      root,
      "tools/agent-evals/acceptance/account-resource.test.ts.template"
    ),
    "utf8"
  )
    .replaceAll("projects", prefix)
    .replaceAll("project-", `${prefix}-`);

  newFile(`apps/api/tests/api/${prefix}/${prefix}.routes.test.ts`, acceptance);
  newFile(
    `apps/api/tests/api/${prefix}/${prefix}.service.test.ts`,
    readFileSync(
      join(
        root,
        "tools/agent-evals/acceptance/account-service.test.ts.template"
      ),
      "utf8"
    ).replaceAll("projects", prefix)
  );
  apply(root, changes, true);

  return changes;
}
