# Model Topography website

A static React site built with Vite, strict TypeScript, and Tailwind CSS. It shows
the diagnostic cohort in an accessible table and reserves a stable host for the
3D topography renderer. No renderer exists yet. Astra builds it next. See
[`handoffs/astra-renderer.md`](../handoffs/astra-renderer.md).

## Commands

Run these from `site/` with Node.js 22 or later.

```sh
npm ci --ignore-scripts
npm run dev          # local server
npm run typecheck    # strict TypeScript, includes ../core/topography.ts
npm test             # adapter, data, and color tests
npm run build        # typecheck, then production build into dist/
npm run audit:dist   # fails if dist/ holds synthetic data, secrets, or scores
```

Browser verification runs from the repository root through Browserbase. With no
URL it serves `site/dist` to the remote browser through request interception.

```sh
npm ci --prefix pilot --ignore-scripts
node scripts/verify-site.mjs [target-url] [output-directory]
```

Set `BROWSERBASE_API_KEY` and `BROWSERBASE_PROJECT_ID` in the invoking process.

## Data

`results.json`, `intelligence.json`, and `epoch-source.csv` stay in this directory.
`benchmark/site-data.test.mjs` checks them here. The Vite plugin in `vite.config.ts`
serves them in development and copies the exact bytes into the build. The page
fetches `/results.json` at run time and validates every field in `src/data/schema.ts`.

`results.json` contains public aggregate fields only. Full sessions and receipts are
not shipped. `intelligence.json` is a dated, attributed Epoch snapshot with
`identityMapping: "unmapped"`. The page lists it as source data. It never joins an
Epoch name to a tested configuration.

`src/data/records.ts` groups the task rows into one `TopographyPoint` for each
measured configuration. The rules:

- All three axes are `unavailable`, each with its reason. No X, Y, or Z is published.
- `successCount` is `null`. App checks are not graded successes.
- Elapsed time and cost are sums across the matched tasks. A missing part makes the
  total unavailable. A missing value never becomes zero.
- `vendor`, `profileHash`, and `taskSetVersion` are empty strings, because the public
  dataset does not record them. The page displays "Not recorded".

## Synthetic fixture

`npm run dev`, then open `/?fixture=synthetic`. The page loads invented points with
validated coordinates so the renderer can be developed. A banner labels the page.
The fixture loads only when `import.meta.env.DEV` is true. Production builds drop the
module, and `npm run audit:dist` fails if its marker appears in `dist/`.

## Renderer host

| Property | Value |
| --- | --- |
| Element | `<div id="topography-host">` in `src/components/TopographyHost.tsx` |
| Lifetime | Mounts once. Filters, tiers, and themes never remount it |
| Children | None from the page. The renderer owns every child |
| Position | `position: absolute; inset: 0` inside `.topography-frame`, with `isolation: isolate` |
| Place | The left part of the tabbed map panel. The reading column takes 320px on the right |
| Width, 1024px and wider | The panel width less 320px. At most 856px |
| Height, 1024px and wider | `clamp(380px, 62vh, 640px)` |
| Narrower | The full panel width at a 10:7 aspect ratio. At least 240px tall |
| Status | `data-renderer-status` is `absent`, `loading`, `mounted`, or `failed` |

The size changes with the viewport. A renderer must observe the host with
`ResizeObserver`. The frame's size rules are in `src/styles.css`.

`src/topography/adapter.ts` is the only module that calls a renderer. Register a
renderer in `src/topography/renderer.ts`. The page state, colors, and theme are in
`src/App.tsx`, `src/data/colors.ts`, and `src/theme.ts`.

## Page structure

Dan ruled on this structure on 2026-09-19, after reviewing the mockups in `mockups/`:

1. Top navigation: the logo and name on the left, Method and Data on the right.
2. A short introduction. Dan writes it in `src/content/intro.ts`. While that string
   is empty, the page renders no introduction.
3. The map panel. Tier tabs sit on its top edge. The panel holds the renderer host
   and the reading for one configuration. The model keys sit under the panel.
4. The results table.

## Design rules

- Light and dark follow the visitor's system setting through `prefers-color-scheme`.
  The page has no theme control and stores no preference.
- The interface is monochrome. The tokens are the `--mtb-*` variables in `src/styles.css`.
- Pastel hues belong to models only. A hue comes from a hash of the model ID, so it
  never depends on row order, filters, or tier. `PINNED_HUES` holds fixed hues.
- Every model mark has an outline and a text label. Color is never the only identifier.
- The typeface is Hanken Grotesk, self-hosted through `@fontsource-variable`.

## Mockups

`mockups/` holds the five design directions Dan reviewed, with notional data and a
static map illustration. Run `npm run dev` and open `/mockups/`. They never ship: the
production build has one input, `index.html`, and `src/styles.css` excludes their classes.

## Deployment

The Vercel team is `model-topography` and the project is `model-topography`. Always
pass `--scope model-topography`. The default scope on a shared machine can be a
different team. The build imports `../core/topography.ts` and the canonical glyph from
`../public/brand/`, so build locally and deploy the prebuilt output:

```sh
vercel pull --yes --environment=preview --scope model-topography
vercel build --scope model-topography
vercel deploy --prebuilt --scope model-topography
```

This creates a preview. Previews sit behind Vercel deployment protection.
`vercel deploy --prod` replaces `modeltopography.com` and needs Dan's approval.
