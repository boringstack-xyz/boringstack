# Article illustrations for BoringStack docs: style guide

Prompt patterns and examples for **boringstack.xyz** (Astro Starlight, MDX under `.github/src/content/docs/`). Pair with [SKILL.md](SKILL.md).

## Optional hero / mood images

Most pages are reference docs; skip a painterly “cover” unless the user explicitly wants a hero for the splash page or a one-off marketing visual.

### Style definition (when you do use a cover-style image)

Dark, moody, painterly digital art. Cinematic concept art: muted tones, atmospheric lighting, visible brush texture. Warm-to-cool transitions often read well for “systems under load” metaphors.

### Prompt structure

```
Dark, moody, painterly digital art. [SCENE]. [SUBJECTS AND THEIR ARRANGEMENT].
[COLOR/LIGHTING DIRECTION]. Cinematic composition, wide aspect ratio.
No text, no UI elements, no logos.
```

### What to exclude (always)

- No text, typography, or readable labels
- No UI frames, browser chrome, or fake dashboards
- No vendor logos or watermarks

### Reference images

Reuse style from any existing file under `public/images/docs/` when you add new art. First generation in the repo: no local reference; keep prompts tight.

---

## Section illustrations (sketches)

### Style definition

Simplistic white-line sketch on pure black (`#000000`). Minimal detail, hand-drawn feel, one subject. Like a quick white marker sketch on a blackboard: loose, expressive, minimal.

### Prompt structure

```
Simplistic white-line sketch on a pure black (#000000) background. [SUBJECT].
Minimal detail, single continuous line style, hand-drawn feel.
No shading, no gradients, no background elements, no fill. White lines only
on solid black.
```

### What to include

- One clear subject tied to the section’s idea
- Physical objects (server rack silhouette, padlock, ship’s wheel, envelope, pipeline) for infra and API topics
- “Continuous line” or “single line” language to discourage clutter

### What to exclude

- No gradients, shading, or filled shapes (lines only)
- No extra scenery
- **No text or letters** in the image (no wall slogans, no fake “ERROR” strings)

### Reference images

After the first page, pass an existing sketch from `public/images/docs/` as `reference_image_paths` for consistency.

---

## Worked examples (technical docs)

Each example matches a plausible `##` on boringstack.xyz. **Do not** put words inside the image.

### Example: “Prerequisites” on a quickstart

**Subject:** Three small boxes connected by arrows (clone layout), no labels.

**Why:** Reinforces “three sibling repos” without inventing a brand.

```
Simplistic white-line sketch on a pure black (#000000) background.
Three equal-sized boxes arranged in a row with arrows showing they connect
to a fourth box below. No letters or numbers inside the boxes.
Minimal detail, single continuous line style, hand-drawn feel.
No shading, no gradients, no background elements. White lines only on solid black.
```

### Example: “Firewall and TLS” runbook

**Subject:** A closed padlock in front of a simple brick wall silhouette.

**Why:** Maps to “hardened host + TLS” without literal browser UI.

```
Simplistic white-line sketch on a pure black (#000000) background.
A closed padlock in the foreground, a simple brick wall shape behind it.
Minimal detail, single continuous line style, hand-drawn feel.
No text, no shading, no gradients. White lines only on solid black.
```

### Example: “The three repos” architecture page

**Subject:** Three equal nodes in a triangle with arrows cycling between them (data/control flow), no text.

**Why:** Abstract enough to stay accurate as copy changes.

```
Simplistic white-line sketch on a pure black (#000000) background.
Three circles arranged in a triangle with curved arrows connecting each
circle to the next. No labels inside the circles.
Minimal detail, single continuous line style, hand-drawn feel.
White lines only on solid black.
```

---

## Mapping headings to subjects

1. Read the section body, not only the heading.
2. Prefer a metaphor already implied in the text (queues, backups, ACME, OpenAPI).
3. If nothing visual appears, pick one physical object that still reads “engineering,” not stock “innovation” clipart.
4. Prefer objects and small human gestures over giant abstract clouds.

| Doc theme          | Strong subject                                               | Why                                             |
| ------------------ | ------------------------------------------------------------ | ----------------------------------------------- |
| Backups / off-site | Tape reel or archive box with arrow leaving a server outline | Concrete “data leaves the box” story            |
| Observability      | Single gauge or wavy line (monitoring), not a full dashboard | Evokes metrics without fake UI text             |
| OpenAPI client     | Two puzzle pieces interlocking (shapes only)                 | “Contract fits together” without code on screen |
| Queues / BullMQ    | Simple queue of three rectangles with one arrow              | Reads as pipeline, not a logo                   |

| Doc theme      | Weak subject            | Why                           |
| -------------- | ----------------------- | ----------------------------- |
| “Modern stack” | Glowing hexagon network | Generic, clip-art             |
| “Security”     | Hooded hacker           | Cliché, off-tone for ops docs |
| “Scale”        | Rocket or trophy        | Empty symbolism               |

---

## Iteration tips

- Generate **one** image at a time; adjust prompts before batching the rest of the page.
- If lines are gray instead of white, repeat “pure white lines on solid #000000 black only.”
- If the model adds typography, add “absolutely no letters, numbers, or symbols in the image.”
- After adding files, run `npm run build` inside `.github/` and fix paths.
