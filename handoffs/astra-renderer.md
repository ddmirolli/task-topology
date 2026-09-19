# Astra renderer kickoff

Fable built the website and the renderer host. You build the interactive 3D
topography inside it. Read `site/README.md`, `core/topography.ts`, and the chart
section of `SPEC.md` first.

## Where your code goes

1. Implement `TopographyRenderer` from `core/topography.ts` in a new module under
   `site/src/topography/`.
2. Register it in `site/src/topography/renderer.ts`. Use a dynamic import so the 3D
   bundle never delays the table:

   ```ts
   export const rendererFactory: RendererFactory | null =
     () => import('./three-renderer.ts').then(module => module.createRenderer());
   ```

3. Add your dependencies to `site/package.json`. Do not edit `adapter.ts`,
   `TopographyHost.tsx`, or the page state unless the contract below cannot work.

## What the adapter guarantees

`site/src/topography/adapter.ts` is the only caller. Its tests are in `adapter.test.ts`.

- `mount(host, state, events)` runs once, after your module loads, with the newest state.
- `update(state)` runs on every later state change. It never runs before `mount`.
- `dispose()` runs once. It also runs if the page goes away while your module loads.
  Release the WebGL context, observers, listeners, and animation frames.
- The `events` object is stable for your lifetime. Keep the reference.
- An exception from `mount` or `update` is caught. The adapter disposes you and the
  page shows a failure message. The table stays usable.
- React StrictMode mounts, disposes, and mounts again in development. Expect it.

## Host

The host is `<div id="topography-host">`. It mounts once and never remounts. It is
absolutely positioned inside a sized frame, with `isolation: isolate`. The page adds
no children. Everything inside the host is yours.

| Viewport | Host height | Host width |
| --- | --- | --- |
| 1024px and wider | `clamp(380px, 62vh, 640px)` | The map panel less the 320px reading column. At most 856px |
| Narrower | Width times 0.7. At least 240px | The page width less 40px |

The host sits on the panel's face color, not the page background. `theme.background`
is that face color. Clear the canvas to it, or keep the canvas transparent.

Observe the host with `ResizeObserver`. Do not set its size.

The page covers the host with a status message while data loads, after a load failure,
and when `visiblePoints(state)` is empty. The cover is a sibling, not a child. With
today's real data every axis is unavailable, so the cover always shows in production.
Develop against the synthetic fixture: `npm run dev`, then `/?fixture=synthetic`.
It has four models, several reasoning settings, a score that falls at the highest
effort, and one configuration with a missing axis.

## State you receive

| Field | Meaning |
| --- | --- |
| `tier`, `comparisonKey` | The visitor's choices. Filter with `visiblePoints(state)` |
| `points` | Every loaded point, all tiers. Never plot an `unavailable` axis at zero |
| `selectedConfigurationIds` | One configuration per shown model: the reasoning setting in use. These build the surface. Sorted |
| `focusedPointId` | The hovered or keyboard-focused point. If none, the pinned point. Else `null` |
| `showSurface`, `showReasoningPaths` | The layer checkboxes |
| `reducedMotion` | `prefers-reduced-motion`. Stop camera easing and transitions when true |
| `modelColors` | Hex strings keyed by `configuration.modelId`. They change with the theme |
| `theme` | Monochrome hex values. They change with the theme |

Theme values, from `site/src/theme.ts`:

| Key | Light | Dark | Use |
| --- | --- | --- | --- |
| `background` | `#e7e7e7` | `#1b1b1b` | Canvas clear color. The map panel's face |
| `foreground` | `#111111` | `#f1f1f1` | Axes, labels, point outlines |
| `grid` | `#bdbdbd` | `#3d3d3d` | Grid lines and the connecting surface |
| `accent` | `#000000` | `#ffffff` | Focus and selection outlines |

The theme follows the visitor's system setting and can change while you are mounted.
The page has no theme control. Model colors are pastel: OKLCH lightness 0.74 and chroma 0.11 in light mode, 0.82 and
0.09 in dark mode. A pastel cannot reach 3:1 contrast on white alone. Give every point
a `theme.foreground` outline and keep the surface monochrome. Hue belongs to model
points, reasoning paths, and legend marks only. Do not define colors in the renderer.

## Events you send

- `onFocus(pointId | null)`: pointer hover or keyboard focus on a point. Send `null`
  when it ends. The page shows that point's details and highlights its table row.
- `onSelect(pointId)`: click, tap, or Enter on a point. The page pins that point in
  the reading beside the map. Escape unpins it.

Neither event changes `selectedConfigurationIds`. The model keys under the panel own
that. A key shows or hides its model. Its arrows step through the model's measured
reasoning settings, and the chosen setting becomes the model's selected configuration.

`visiblePoints(state)` returns the selected configurations only. For reasoning paths,
read a shown model's other measured settings from `state.points`, with the same tier
and comparison key. Draw them as smaller marks. `site/mockups/Surface.tsx` illustrates
the intended look with notional data. It is a static SVG, not a starting point for the engine.

## Rules from the specification

- Coordinates and axis ranges stay fixed when the selection changes. Only the surface redraws.
- The surface is visual interpolation. Do not imply performance between points.
- Connect reasoning settings of one model in `reasoning.order`. A `null` order means
  the order is unknown, so do not connect that point. Never interpolate an untested setting.
- Handle duplicate projections, gaps, and one or two selected points without a broken surface.
- Do not trap page scroll on touch devices. The table must stay reachable on mobile
  without a 3D gesture.
- Points need keyboard access: a focus order, Enter to select, and a visible focus mark.
- The CSP is `script-src 'self'` with no `unsafe-eval` and no `worker-src`. Inline
  workers from blob URLs are blocked. Change `site/vercel.json` if you need one.

## Open interface issues

Fable did not change `core/topography.ts`. These need a decision before real scores publish:

1. `vendor`, `profileHash`, and `taskSetVersion` are required strings. The public
   dataset records none of them. The site stores `''` and displays "Not recorded".
2. `successCount` has no place for unadjudicated app checks. The site sets it to
   `null` and keeps app checks in its own `ConfigurationRecord`.
3. `visiblePoints` drops a model's unselected reasoning settings, but reasoning paths
   need them. The renderer reads them from `points`. A core helper would make this explicit.
4. `TopographyViewState` has one `focusedPointId`. The page merges hover and pin into
   it. A renderer that styles them differently needs a second field.
5. The public dataset has no tier or comparison field. The site assigns tier 1 and
   derives the comparison key `mtb-public-diagnostic/1:2026-09-18` from version and date.
6. `reasoning.providerValue` and `reasoning.order` are `null` for the current data.
   Reasoning paths need a recorded order.

## Commands

Run from `site/`: `npm ci --ignore-scripts`, `npm run dev`, `npm run typecheck`,
`npm test`, `npm run build`, `npm run audit:dist`. Run the browser check from the
repository root: `node scripts/verify-site.mjs`. Extend that script with renderer
checks. Deployment steps are in `site/README.md`. A production deploy needs Dan's approval.

## Not built

The 3D renderer, surface construction, camera controls, picking, and reasoning paths.
URL-shareable view state. A published X, Y, or Z. Epoch identity mapping.
Tier 2 and tier 3 measurements.
