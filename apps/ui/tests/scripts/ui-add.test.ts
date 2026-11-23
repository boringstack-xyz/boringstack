import { describe, expect, test } from "vitest";

import {
  adaptShadcnSource,
  addedCnPackage
} from "../../scripts/codegen/ui-add.utils";

/* Built at runtime so the no-dark-mode lint rule does not read it as a class. */
const DARK = ["dark", ""].join(":");

describe("adaptShadcnSource", () => {
  test("points the cn import at the template's helper", () => {
    expect(adaptShadcnSource('import { cn } from "cn"\n')).toBe(
      'import { cn } from "@/lib/classnames"\n'
    );
  });

  test("leaves other imports alone", () => {
    const source = 'import { Slot } from "radix-ui"\nimport x from "cnx"\n';

    expect(adaptShadcnSource(source)).toBe(source);
  });

  test("drops dark-variant classes and keeps the rest", () => {
    expect(
      adaptShadcnSource(
        `cn("border bg-input/30 ${DARK}bg-input/50 ${DARK}hover:bg-accent px-2", className)`
      )
    ).toBe('cn("border bg-input/30 px-2", className)');
  });

  test("leaves strings without dark-variant classes byte for byte", () => {
    const source = "const a = \"  spaced  \" + ' x '\n";

    expect(adaptShadcnSource(source)).toBe(source);
  });
});

describe("addedCnPackage", () => {
  test("is true only when cn appears after the run", () => {
    expect(
      addedCnPackage({ dependencies: {} }, { dependencies: { cn: "1.0.0" } })
    ).toBe(true);
    expect(
      addedCnPackage(
        { dependencies: { cn: "1.0.0" } },
        { dependencies: { cn: "1.0.0" } }
      )
    ).toBe(false);
    expect(addedCnPackage({}, { devDependencies: {} })).toBe(false);
  });
});
