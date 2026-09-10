import { readFileSync } from "node:fs";
import { join } from "node:path";
import { edit, replaceOnce, type IEdit } from "./patch";

/** Checked example only; it is not installed into the starter's production UI. */
export function planReferenceUi(root: string): IEdit[] {
  const base = join(root, "tools/agent-evals/reference-ui");
  const edits = [...new Bun.Glob("**/*.template").scanSync({ cwd: base })].map(
    (path) =>
      edit(
        root,
        `apps/ui/src/features/projects/${path.replace(/\.template$/, "")}`,
        (source) => {
          if (source !== "") {
            throw new Error("UI target exists");
          }

          return readFileSync(join(base, path), "utf8");
        }
      )
  );

  edits.push(
    edit(root, "apps/ui/eslint.config.mjs", (source) =>
      replaceOnce(
        source,
        '["dashboard", "auth"],',
        '["dashboard", "auth"],\n            ["projects", "auth"],'
      )
    )
  );
  edits.push(
    edit(root, "apps/ui/src/app/router/routes.tsx", (source) =>
      replaceOnce(
        source,
        "const DashboardPage = lazy",
        'const ProjectsPage = lazy(() => import("@/features/projects/components/ProjectsPage").then(m => ({default:m.ProjectsPage})));\n\nconst DashboardPage = lazy'
      ).replace(
        '    path: "/dashboard",',
        '    path: "/projects",\n    element: <ProtectedRoute><AppShell><Suspense><ProjectsPage /></Suspense></AppShell></ProtectedRoute>\n  },\n  {\n    path: "/dashboard",'
      )
    )
  );

  for (const [locale, translations] of Object.entries({
    en: {
      title: "Projects",
      name: "Project name",
      save: "Save project",
      selection: "Project",
      new: "Create a new project",
      empty: "No projects yet.",
      error: "Projects could not be loaded or saved.",
    },
    de: {
      title: "Projekte",
      name: "Projektname",
      save: "Projekt speichern",
      selection: "Projekt",
      new: "Neues Projekt erstellen",
      empty: "Noch keine Projekte.",
      error: "Projekte konnten nicht geladen oder gespeichert werden.",
    },
  })) {
    edits.push(
      edit(
        root,
        `apps/ui/src/lib/i18n/locales/${locale}/common.json`,
        (source) =>
          JSON.stringify(
            { ...JSON.parse(source), projects: translations },
            null,
            2
          ) + "\n"
      )
    );
  }

  return edits;
}
