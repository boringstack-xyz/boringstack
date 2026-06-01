#!/usr/bin/env node
/*
 * Build-time OG image generator.
 *
 * Renders a 1200x630 BoringStack-branded PNG to `public/og-image.png`.
 * The image is what LinkedIn / Twitter / Slack / iMessage scrape when
 * the URL is shared — without it the preview is the bare title and
 * description, which reads as "nothing made this".
 *
 * Lead with VALUE, not stack components. People scrolling a feed need
 * to know "what is this for me" in one glance — the framework list
 * goes on the site, not on the share card.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, "../public");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "og-image.png");

const PALETTE = {
  bgOuter: "#04140a",
  bgCard: "#0b1f13",
  bgCardEdge: "#102a18",
  border: "#1f4a2e",
  borderStrong: "#2f7048",
  accent: "#4ade80",
  accentStrong: "#86efac",
  text: "#f5fbf6",
  muted: "#8ea493"
};

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function buildSvg() {
  return `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="1200" height="630"
  viewBox="0 0 1200 630"
>
  <defs>
    <radialGradient id="bgGlowA" cx="84%" cy="22%" r="60%">
      <stop offset="0%" stop-color="${PALETTE.accent}" stop-opacity="0.20" />
      <stop offset="100%" stop-color="${PALETTE.accent}" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="bgGlowB" cx="8%" cy="90%" r="50%">
      <stop offset="0%" stop-color="${PALETTE.accentStrong}" stop-opacity="0.12" />
      <stop offset="100%" stop-color="${PALETTE.accentStrong}" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="cardFill" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${PALETTE.bgCard}" />
      <stop offset="100%" stop-color="${PALETTE.bgCardEdge}" />
    </linearGradient>
    <linearGradient id="cardStroke" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${PALETTE.borderStrong}" stop-opacity="0.9" />
      <stop offset="100%" stop-color="${PALETTE.border}" stop-opacity="0.6" />
    </linearGradient>
  </defs>

  <rect width="1200" height="630" fill="${PALETTE.bgOuter}" />
  <rect width="1200" height="630" fill="url(#bgGlowA)" />
  <rect width="1200" height="630" fill="url(#bgGlowB)" />

  <rect
    x="40" y="40"
    width="1120" height="550"
    rx="22" ry="22"
    fill="url(#cardFill)"
    stroke="url(#cardStroke)"
    stroke-width="1.5"
  />

  <!-- Brand row -->
  <g transform="translate(80,128)">
    <text
      font-family="ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, monospace"
      font-size="44"
      font-weight="700"
      fill="${PALETTE.accent}"
    >&gt;_</text>
    <text
      x="82" y="0"
      font-family="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif"
      font-size="44"
      font-weight="800"
      fill="${PALETTE.text}"
      letter-spacing="-0.8"
    >BoringStack</text>
  </g>

  <!-- Headline (anti-rebuilding hook, plays on the product name) -->
  <text
    x="80" y="280"
    font-family="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif"
    font-size="84"
    font-weight="800"
    fill="${PALETTE.text}"
    letter-spacing="-2.5"
  >Skip the boring stuff.</text>
  <text
    x="80" y="376"
    font-family="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif"
    font-size="84"
    font-weight="800"
    fill="${PALETTE.accent}"
    letter-spacing="-2.5"
  >Ship the rest.</text>

  <!-- Sub: value-prop, not stack list -->
  <text
    x="80" y="450"
    font-family="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif"
    font-size="26"
    font-weight="500"
    fill="${PALETTE.muted}"
  >Production-grade auth, billing, queues, email, observability.</text>
  <text
    x="80" y="486"
    font-family="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif"
    font-size="26"
    font-weight="500"
    fill="${PALETTE.muted}"
  >Already wired. Open source. MIT.</text>

  <!-- Footer line -->
  <line
    x1="80" y1="538" x2="1120" y2="538"
    stroke="${PALETTE.border}" stroke-width="1"
  />

  <text
    x="80" y="572"
    font-family="ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, monospace"
    font-size="20"
    font-weight="600"
    fill="${PALETTE.accent}"
  >boringstack.xyz</text>
</svg>
  `.trim();
}

async function main() {
  const svg = buildSvg();

  await mkdir(OUTPUT_DIR, { recursive: true });

  const png = await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9 })
    .toBuffer();

  await writeFile(OUTPUT_PATH, png);

  console.log(
    `[og-image] wrote ${path.relative(process.cwd(), OUTPUT_PATH)} (${png.length} bytes)`
  );
}

main().catch((err) => {
  console.error("[og-image] generation failed");
  console.error(err);
  process.exit(1);
});
