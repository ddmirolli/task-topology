# Task Topology Index brand assets

The SVG geometry is the Task Topology Index logo. All raster assets, sizes, and theme variants are deterministic renderings of that geometry.

[`task-topology-glyph.svg`](task-topology-glyph.svg) contains the only canonical geometry.
The original design reference is [`tti-glyph-c-reference.png`](../../tti-glyph-c-reference.png) at the repository root.
That PNG is immutable and is not a production asset. It appears only in QA comparisons.

## Regenerate and verify

Run these commands from the repository root with Node.js 22 or later:

```sh
npm ci --ignore-scripts
npm run generate:brand
npm run verify:brand
```

Generation reads the canonical SVG and writes all derived files. Verification rebuilds
them in memory and compares every byte with the files on disk. Missing or stale files
fail verification. Neither command modifies the source SVG or reference PNG.

The pipeline uses [Sharp](https://sharp.pixelplumbing.com/) 0.35.4 and its bundled libvips and SVG renderer. The lockfile
pins the dependency tree. `manifest.json` records renderer versions, source hashes,
output hashes, and measured alpha bounds. Reproduce exact bytes with the same locked
renderer and platform. QA labels also use the platform's sans-serif font.

## Geometry and palettes

| Property | Canonical value |
| --- | --- |
| ViewBox | `0 0 512 512` |
| Stroke width | `9` SVG units |
| Caps and joins | Round |
| Surface fill | None |
| Geometry | One closed perimeter and seven internal cubic Bézier paths |
| Horizontal extent, including stroke | About 84% of the canvas |
| Vertical extent, including stroke | About 66% of the canvas |
| Light | `#111827` on `#FFFFFF` |
| Dark | `#F8FAFC` on `#0B0F14` |
| Transparent PNG | `#111827` with alpha |

The repository has no existing application theme tokens. These are the task's default
palettes. On 2026-09-18, Dan approved option B with a 9-unit stroke at every size
and 50% more height. The canonical path coordinates contain that revision:
`y = 256 + 1.5 × (original y - 256)`. X coordinates are unchanged.
The transform is already applied to the paths. Generation does not apply it again.
The immutable reference records the original, shallower design.

Paths, control points, and stroke width are identical across themes and formats.
Standard assets also share the same viewBox, positioning, and padding. The T3 icon
uses the documented framing exception below. No asset has alternate path geometry.
The fixed theme variants add only explicit colors and an opaque background rectangle.
The adaptive variant adds only CSS to select the foreground color. Its background is transparent.

TTI compares model capability, unattended task duration, and successful work per dollar.
The glyph's warped sheet implies that three-dimensional space. It retains the
reference's dominant rear-left peak, central saddle, smaller rear-right rise, broad
perimeter, and open mesh. It does not plot benchmark data.

## Asset use

- Use the canonical SVG inline for UI color inheritance through `currentColor`.
  A parent CSS `color` does not propagate into an SVG loaded through an HTML `img`.
  Import the source as inline SVG or use it as a CSS mask without copying its paths.
- Use the explicit light or dark SVG for an `img`, document, or fixed palette.
- Use `task-topology-glyph-adaptive.svg` for an image that follows its parent's color scheme.
- Use `png/transparent/` for dark glyphs on a supplied light background.
- Use `png/light/` and `png/dark/` when the image needs its own background.
- Use the 180px PNG for an Apple touch icon and the 192px PNG for an Android icon.
- Use JPG only where required. All four JPGs contain opaque RGB, quality 96,
  with 4:4:4 chroma sampling.
- Use `favicon/favicon.ico` for an ICO favicon. An application must add its own
  icon link. This benchmark repository does not yet contain the public website.

PNG sizes are 16, 24, 32, 48, 64, 128, 180, 192, 256, 512, and 1024px for each
of the three palettes. JPG sizes are 512 and 1024px for light and dark.

Every raster starts with the canonical SVG at its target viewport size. The renderer
extracts its alpha coverage, then applies the palette with one rounding step per channel.
This avoids accumulated color rounding at intersections and keeps theme coverage identical.
No production raster is a resized copy of another raster. The ICO packages the generated light PNGs
at 16, 24, 32, 48, 64, 128, and 256px as PNG-compressed, 32-bit entries. Its white
background keeps the dark stroke visible against browser chrome in either theme.

## T3 project icon

The root `t3.json` points to `public/brand/task-topology-glyph-t3.svg`.
Leave the T3 project icon on **Automatic** to use this repository configuration.
An explicit image, emoji, or icon override takes precedence.

The generated adaptive SVG selects `#111827` for light mode and `#F8FAFC` for dark
mode through `prefers-color-scheme`. T3 0.0.42 sets the embedding page's `color-scheme`
when its theme changes. The image follows that scheme without changing its geometry.
This applies wherever T3 displays the project's icon. No per-thread setup is needed.

The T3 variant uses `viewBox="36 36 440 440"`, trimming 36 units of empty canvas
from each edge. Dan approved this T3-specific padding exception on 2026-09-18.
It makes the complete glyph 16.4% larger inside T3's 14px square, about 13.6 × 10.7px
instead of 11.7 × 9.2px. The remaining horizontal clearance is about 6.2 SVG units
on each side, including the stroke. The glyph stays centered and unclipped.

Only the T3 variant uses this framing, at every size T3 displays it. Its paths and
9-unit stroke match the canonical SVG exactly. The canonical source, standard
adaptive SVG, fixed palettes, PNGs, JPGs, and ICO retain their original framing.

The configuration and asset must exist in the project checkout T3 reads. Merge and
update the canonical checkout to make them available beyond the implementation worktree.
Older checkouts need the same files or a project-wide image override.

## Visual QA and automated checks

Open [`qa/contact-sheet.html`](qa/contact-sheet.html) locally at 100% zoom, or inspect
[`qa/contact-sheet.png`](qa/contact-sheet.png). Both use the production PNGs and show
the original reference beside the approved taller vector render. The reference panel
keeps the original proportions. Comparison alignment changes only its QA display.
The original file stays byte-for-byte unchanged.

[`qa/adaptive-theme.html`](qa/adaptive-theme.html) loads the same T3 SVG in light
and dark containers. Native-size rows compare standard and tight framing at 14, 16,
24, 32, and 48px. Its button swaps both container themes to check that existing
images respond without reloading.

[`qa/favicon-native.png`](qa/favicon-native.png) isolates the 16, 24, 32, and 48px
outputs at native resolution. At 16px, antialiasing softens the thin strokes and
individual intersections merge. The peak, saddle, and broad sheet remain visible.
The 24px and 32px versions retain more mesh detail. At 48px the curves separate clearly.
The approved 9-unit stroke stays identical at every size, including the T3 icon.

The generator checks dimensions, full raster decoding, alpha, background opacity,
shared theme coverage, geometry identity, viewBox, stroke width, canvas bounds,
intentional padding, all ICO entries, and unchanged source hashes. It rejects embedded
images, transforms, styles in the canonical source, unsupported SVG elements, and invalid path commands.
The adaptive variant must reduce byte-for-byte to the canonical source after removing
its generated palette CSS. Verification also checks the T3 icon path.
The T3 variant must match that adaptive SVG after restoring the standard viewBox.
An alpha-edge check at 1024px verifies that the tighter canvas does not clip strokes.
`verify:brand` also detects changes to any generated file.

Reference SHA-256:
`b7e55e713d63d5701e7015c7e277bec87e7fe77b86968d77f2a4b357f4b5a2b5`.
