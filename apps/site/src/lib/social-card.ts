import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import satori from "satori";
import sharp from "sharp";
import { siteName } from "./site";

// Open Graph and Twitter card: 1200x630 PNG rendered at build time. Satori
// lays out plain element objects, so no React runtime is needed. Only the
// bundled Manrope fonts are used, which keeps the output independent of the
// container's installed fonts.

export interface SocialCardInput {
  title: string;
  description: string;
  eyebrow?: string;
}

type Element = {
  type: string;
  props: {
    style?: Record<string, string | number>;
    children?: Child | Child[];
  };
};
type Child = Element | string;

function h(
  type: string,
  style: Record<string, string | number>,
  ...children: Child[]
): Element {
  return {
    type,
    props: { style, children: children.length === 1 ? children[0] : children },
  };
}

const COLORS = {
  background: "#f7f5f0",
  ink: "#15171a",
  muted: "#4b5160",
  accent: "#2f6fed",
};

let fontsPromise: Promise<{ regular: Buffer; bold: Buffer }> | undefined;

function loadFonts() {
  // Resolve from the project root: this module is bundled before it runs, so
  // a path relative to import.meta.url would point at the bundle, not src/.
  fontsPromise ??= (async () => {
    const packageRoot = join(
      createRequire(join(process.cwd(), "package.json")).resolve(
        "@fontsource/manrope/package.json",
      ),
      "..",
    );
    const [regular, bold] = await Promise.all([
      readFile(join(packageRoot, "files/manrope-latin-400-normal.woff")),
      readFile(join(packageRoot, "files/manrope-latin-700-normal.woff")),
    ]);
    return { regular, bold };
  })();
  return fontsPromise;
}

export async function renderSocialCard(
  input: SocialCardInput,
): Promise<Buffer> {
  const fonts = await loadFonts();
  const title =
    input.title.length > 110 ? `${input.title.slice(0, 107)}...` : input.title;
  const description =
    input.description.length > 160
      ? `${input.description.slice(0, 157)}...`
      : input.description;

  const tree = h(
    "div",
    {
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      width: 1200,
      height: 630,
      padding: "64px 72px",
      background: COLORS.background,
      color: COLORS.ink,
      fontFamily: "Manrope",
    },
    h(
      "div",
      { display: "flex", flexDirection: "column" },
      h(
        "div",
        {
          display: "flex",
          fontSize: 26,
          fontWeight: 700,
          color: COLORS.accent,
          letterSpacing: 2,
        },
        (input.eyebrow ?? siteName).toUpperCase(),
      ),
      h(
        "div",
        {
          display: "flex",
          marginTop: 28,
          fontSize: title.length > 60 ? 60 : 72,
          fontWeight: 700,
          lineHeight: 1.1,
        },
        title,
      ),
      h(
        "div",
        {
          display: "flex",
          marginTop: 28,
          fontSize: 30,
          lineHeight: 1.35,
          color: COLORS.muted,
        },
        description,
      ),
    ),
    h("div", { display: "flex", fontSize: 26, fontWeight: 700 }, siteName),
  );

  const svg = await satori(tree as unknown as Parameters<typeof satori>[0], {
    width: 1200,
    height: 630,
    fonts: [
      { name: "Manrope", data: fonts.regular, weight: 400, style: "normal" },
      { name: "Manrope", data: fonts.bold, weight: 700, style: "normal" },
    ],
  });
  return sharp(Buffer.from(svg)).png().toBuffer();
}
