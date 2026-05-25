/**
 * Shared post-write punch list for the four ACL scaffolders. Centralised
 * so the wording stays consistent and so a future change (e.g. a new
 * "regen typegen" step) lands in one place.
 */
export function printPunchList(kind: string, name: string): void {
  console.log("");
  console.log(`✓ Added ${kind}: ${name}`);
  console.log("");
  console.log("Next:");
  console.log(
    "  1. Run bun run generate:acl-types (from apps/api) to mirror the change to"
  );
  console.log("     ../ui/src/lib/acl/acl.types.generated.ts.");
  console.log(
    "  2. If you added a role or a subject, update buildAbility(...)"
  );
  console.log(
    "     in src/lib/acl/ability.ts to map permissions onto it. Tests"
  );
  console.log("     in tests/lib/acl/ability.test.ts cover the matrix.");
  console.log(
    "  3. If you added a feature, set its default + plan_features rows"
  );
  console.log(
    "     in src/clients/postgres/seed-plans.ts and document the gate"
  );
  console.log("     site in src/lib/acl/ability.ts.");
  console.log("");
}
