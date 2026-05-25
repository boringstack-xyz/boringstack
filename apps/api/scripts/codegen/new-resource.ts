#!/usr/bin/env bun
/**
 * Scaffolds a new API resource:
 *   - src/api/<lowercase>/<lowercase>.{routes,schemas,service,types}.ts
 *   - Drizzle table appended to src/clients/postgres/schema/app.schema.ts
 *   - Drizzle relation appended to src/clients/postgres/schema/relations.ts
 *
 * Usage: bun run new:resource -- Posts
 */

import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const APP_SCHEMA_PATH = fileURLToPath(
  new URL("../../src/clients/postgres/schema/app.schema.ts", import.meta.url)
);

const RELATIONS_PATH = fileURLToPath(
  new URL("../../src/clients/postgres/schema/relations.ts", import.meta.url)
);

const AUDIT_CONSTANTS_PATH = fileURLToPath(
  new URL("../../src/lib/audit-log/audit-log.constants.ts", import.meta.url)
);

const parseArgs = (argv: string[]): string => {
  const arg = argv.slice(2).find((value) => value !== "--");
  const name = arg?.trim();

  if (name === undefined || name === "") {
    console.error(
      "Usage: bun run new:resource -- <PascalName>\nExample: bun run new:resource -- Posts"
    );
    process.exit(1);
  }

  if (!/^[A-Z][\dA-Za-z]*$/.test(name)) {
    console.error(
      `Invalid PascalCase name "${name}". Use letters/digits only, starting with uppercase (e.g. Posts).`
    );
    process.exit(1);
  }

  return name;
};

const toFilePrefix = (pascal: string): string =>
  pascal.charAt(0).toLowerCase() + pascal.slice(1);

const toSingularEntity = (pascal: string): string =>
  pascal.length > 1 && pascal.endsWith("s") ? pascal.slice(0, -1) : pascal;

const APP_SCHEMA_HEADER = `import {
  foreignKey,
  index,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./auth.schema";
import { app } from "./pg-schemas";
`;

const patchAppSchema = (content: string, filePrefix: string): string => {
  if (content.includes(`export const ${filePrefix} = app.table`)) {
    throw new Error(
      `Table export "${filePrefix}" already exists in app.schema.ts`
    );
  }

  const block = `
export const ${filePrefix} = app.table(
  "${filePrefix}",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: uuid("user_id").notNull(),
    name: varchar({ length: 100 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_${filePrefix}_user_id").on(table.userId),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "${filePrefix}_user_id_fkey",
    }).onDelete("cascade"),
  ]
);
`;

  /*
   * When app.schema.ts is the post-widgets-removal placeholder (no Drizzle
   * imports, only `export {};` to satisfy TS), replace the whole shell with
   * a real header + the new table. Once at least one table exists, future
   * calls just append (the original behavior).
   */
  if (!content.includes('from "drizzle-orm/pg-core"')) {
    return APP_SCHEMA_HEADER + block;
  }

  return content.trimEnd() + "\n" + block;
};

const patchAuditConstants = (
  content: string,
  auditKey: string,
  auditValue: string
): string => {
  if (content.includes(`${auditKey}:`)) {
    return content;
  }

  // Insert `  KEY: "value",\n` immediately before the closing `} as const;`.
  const insertion = `  ${auditKey}: "${auditValue}",\n`;
  const patched = content.replace(/(} as const;)/, `${insertion}$1`);

  if (patched === content) {
    throw new Error(
      "Could not auto-patch audit-log.constants.ts; AUDIT_ACTIONS block not found"
    );
  }

  return patched;
};

const patchRelations = (content: string, filePrefix: string): string => {
  if (content.includes(`export const ${filePrefix}Relations`)) {
    throw new Error(
      `Relation "${filePrefix}Relations" already exists in relations.ts`
    );
  }

  let next = content;

  // 1. Add the import for the new table from app.schema.
  const appImportRegex = /import\s+{([^}]*)}\s+from\s+"\.\/app\.schema";/;
  const match = appImportRegex.exec(next);

  if (match) {
    const inner = (match[1] ?? "").trim().replace(/,$/, "");
    const items = inner
      .split(",")
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);

    if (!items.includes(filePrefix)) {
      items.push(filePrefix);
      items.sort();
      next = next.replace(
        appImportRegex,
        `import { ${items.join(", ")} } from "./app.schema";`
      );
    }
  } else {
    next = next.replace(
      /(import\s+{[^}]*}\s+from\s+"\.\/auth\.schema";)/,
      `import { ${filePrefix} } from "./app.schema";\n$1`
    );
  }

  // 2. Append the new relation declaration.
  const relation = `
export const ${filePrefix}Relations = relations(${filePrefix}, ({ one }) => ({
  user: one(users, {
    fields: [${filePrefix}.userId],
    references: [users.id],
  }),
}));
`;

  next = next.trimEnd() + "\n" + relation;

  // 3. Add `<filePrefix>: many(<filePrefix>),` inside usersRelations.
  const manyLine = `  ${filePrefix}: many(${filePrefix}),`;

  if (!next.includes(manyLine)) {
    const usersBlock =
      /(export const usersRelations = relations\(users, \({ many }\) => \({\n(?:[^}]*\n)*?)(}\)\);)/;
    const patched = next.replace(usersBlock, `$1${manyLine}\n$2`);

    if (patched === next) {
      console.warn(
        `Could not auto-patch usersRelations. Add this line manually inside that block:\n${manyLine}`
      );
    } else {
      next = patched;
    }
  }

  return next;
};

const writeResourceFiles = async (params: {
  pascal: string;
  filePrefix: string;
  singular: string;
}): Promise<void> => {
  const { pascal, filePrefix, singular } = params;
  const dirPath = fileURLToPath(
    new URL(`../../src/api/${filePrefix}/`, import.meta.url)
  );

  if (existsSync(dirPath)) {
    console.error(
      `Directory src/api/${filePrefix}/ already exists. Remove it or pick another name.`
    );
    process.exit(1);
  }

  await mkdir(dirPath, { recursive: true });

  const createSchemaName = `Create${singular}Schema`;
  const responseName = `${singular}Response`;

  await Bun.write(
    `${dirPath}/${filePrefix}.schemas.ts`,
    `import { t } from "elysia";

export const ${createSchemaName} = t.Object({
  name: t.String({ minLength: 1, maxLength: 100 }),
});

export const ${responseName} = t.Object({
  id: t.String(),
  userId: t.String(),
  name: t.String(),
  createdAt: t.String({ format: "date-time" }),
  updatedAt: t.String({ format: "date-time" }),
});
`
  );

  await Bun.write(
    `${dirPath}/${filePrefix}.types.ts`,
    `import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { ${filePrefix} } from "../../clients/postgres/schema";

export type I${singular} = InferSelectModel<typeof ${filePrefix}>;
export type ICreate${singular}Data = InferInsertModel<typeof ${filePrefix}>;
export type IUpdate${singular}Data = Partial<InferInsertModel<typeof ${filePrefix}>>;
`
  );

  const auditKey = `${singular.toUpperCase()}_CREATED`;
  const singularLower = singular.toLowerCase();

  await Bun.write(
    `${dirPath}/${filePrefix}.service.ts`,
    `import { eq } from "drizzle-orm";
import { db } from "../../clients/postgres";
import { ${filePrefix} } from "../../clients/postgres/schema";
import { AUDIT_ACTIONS, auditLogService } from "../../lib/audit-log";
import { ApiErrors } from "../../lib/errors";
import type { ICreate${singular}Data, I${singular} } from "./${filePrefix}.types";

export class ${pascal}Service {
  async listForUser(userId: string): Promise<I${singular}[]> {
    return db.query.${filePrefix}.findMany({
      where: eq(${filePrefix}.userId, userId),
    });
  }

  async create(data: ICreate${singular}Data): Promise<I${singular}> {
    const [created] = await db.insert(${filePrefix}).values(data).returning();
    if (!created) {
      throw ApiErrors.internal("Failed to create ${singularLower}");
    }

    void auditLogService.record({
      userId: created.userId,
      action: AUDIT_ACTIONS.${auditKey},
      metadata: { ${singularLower}Id: created.id },
    });

    return created;
  }
}

export const ${filePrefix}Service = new ${pascal}Service();
`
  );

  await Bun.write(
    `${dirPath}/${filePrefix}.routes.ts`,
    `import { t } from "elysia";
import { createAuthMiddleware } from "../auth/auth.plugin";
import { errorHandler } from "../../middleware/error-handler";
import { ${createSchemaName}, ${responseName} } from "./${filePrefix}.schemas";
import { ${filePrefix}Service } from "./${filePrefix}.service";

const ${filePrefix}Routes = createAuthMiddleware()
  .onError(({ code, error, set }) =>
    errorHandler({ code: String(code), error, set })
  )
  .get("/", async ({ user }) => ${filePrefix}Service.listForUser(user.id), {
    response: t.Array(${responseName}),
    detail: {
      tags: ["${pascal}"],
      summary: "List items for the current user",
      security: [{ cookieAuth: [] }],
    },
  })
  .post(
    "/",
    async ({ body, user }) => ${filePrefix}Service.create({ ...body, userId: user.id }),
    {
      body: ${createSchemaName},
      response: ${responseName},
      detail: {
        tags: ["${pascal}"],
        summary: "Create an item",
        security: [{ cookieAuth: [] }],
      },
    }
  );

export default ${filePrefix}Routes;
`
  );
};

const pascal = parseArgs(process.argv);
const filePrefix = toFilePrefix(pascal);
const singular = toSingularEntity(pascal);

const appSchemaText = await Bun.file(APP_SCHEMA_PATH).text();
const relationsText = await Bun.file(RELATIONS_PATH).text();
const auditConstantsText = await Bun.file(AUDIT_CONSTANTS_PATH).text();

const auditKey = `${singular.toUpperCase()}_CREATED`;
const auditValue = `${singular.toLowerCase()}.created`;

try {
  await Bun.write(APP_SCHEMA_PATH, patchAppSchema(appSchemaText, filePrefix));
  await Bun.write(RELATIONS_PATH, patchRelations(relationsText, filePrefix));
  await Bun.write(
    AUDIT_CONSTANTS_PATH,
    patchAuditConstants(auditConstantsText, auditKey, auditValue)
  );
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  console.error(message);
  process.exit(1);
}

await writeResourceFiles({ pascal, filePrefix, singular });

console.log(`
Created src/api/${filePrefix}/ (${filePrefix}.*.ts) + appended to schema/app.schema.ts and schema/relations.ts.

Next steps:
1. Wire routes in src/config/routes.ts (import default as ${filePrefix}Routes, add to routes object).
2. Mount in src/config/app.ts: .group("/api/v1/${filePrefix}", (group) => group.use(routes.${filePrefix}))
3. Add an OpenAPI tag in src/config/swagger.ts for "${pascal}".
4. Run: bun run db:generate && bun run db:migrate
5. Run: bun run validate
`);
