# Fable 5.1 website kickoff

You own the Model Topography website redesign. Build the page and interaction shell.
After your handoff, Astra will build the interactive 3D topography inside it.
Dan rejected the current site's styling, palette, font choice, and visual noise.

## Start

1. Work in a new T3-managed Model Topography worktree that contains this handoff and
   `core/topography.ts`. Verify the branch and path before editing. If the files are
   absent, recover the implementation branch through T3 before starting.
2. Read `ARCHITECTURE.md` and the axes and chart sections in `SPEC.md`.
3. Inspect Dan's references, https://artificialanalysis.ai/ and
   https://deepswe.datacurve.ai/. Follow the visual direction below. His explicit
   bans override any conflicting detail on either reference site.
4. Inspect `site/results.json` and `site/intelligence.json`. Treat the existing
   site as a source of real diagnostic data, not a design reference.
5. Build the website with strict TypeScript and Tailwind CSS. Prefer React with
   Vite for this interactive static site. Keep any site dependencies and build config under
   `site/`, and retain the repository's strict core build.

## Product

One standardized benchmark measures any model across three tiers: entry level,
middle management, and senior executive. Each measured model configuration has
three coordinates. X is trusted workload, Y is external intelligence, and Z is
execution efficiency incorporating correctness, cost, and elapsed time.

The eventual centerpiece is a manipulatable 3D map. Visitors rotate and zoom it,
inspect model points, and choose which configurations contribute to the connecting
surface. Switching tiers changes the relevant measurements. Reasoning controls
select measured configurations. Scores can rise and fall as reasoning effort grows.

Build a compact tool for choosing models. The map should dominate the first
viewport. Keep model selection, tier selection, and reasoning settings nearby.
Put detailed methodology and caveats in expandable help or a separate view.

## Visual requirements

- Use direct headings and functional labels. No eyebrows, decorative subtitles,
  repeated explanatory taglines, or marketing copy above every section.
- Support light and dark modes, with a visible toggle and a persisted preference.
  Respect the system theme until a visitor chooses one.
- Keep the benchmark interface monochrome: backgrounds, panels, typography, axes,
  grid, controls, focus indicators, and the connecting surface.
- Reserve pastel colors for models, their dots, reasoning paths, and legend marks.
  Assign colors by stable model identity, not row order. Preserve the assignment
  across filters and tiers, with accessible light and dark variants. Use labels
  and selection outlines so color is not the only identifier.
- Use simple styling and restrained sans-serif typography. Replace the current
  palette and font choice. Do not introduce tinted brand backgrounds or gradients.
  Preserve access to the canonical logo under `public/brand/`; it does not require
  reuse of the current page's colors or fonts.
- Keep the first screen focused on the map and its controls. Avoid a large
  marketing hero that pushes the tool below the fold.
- Use clear focus states, readable contrast, keyboard controls, and touch targets.
  Make the results usable on mobile without requiring a 3D gesture.
- Keep necessary evidence labels concise. Show missing measurements honestly.

## Ownership and renderer boundary

You own layout, typography, palette, responsive behavior, selection controls,
details panel, loading and empty states, and an accessible results table.
Astra owns the later 3D renderer, surface construction, camera controls, picking,
and reasoning paths. Do not implement a substitute chart or 3D engine now.

Use the interfaces in `core/topography.ts`. Build a host element with stable identity
`topography-host` and a documented size. Keep the host mounted when filters change.
Keep selected tier, comparison key, configuration IDs, and focused point in page
state. The future renderer receives `TopographyViewState` and `TopographyEvents`.
Manage its mount, update, and disposal through one adapter module. Until a renderer
exists, show a concise empty state in the reserved area and keep the table usable.

Pass monochrome interface colors through `state.theme` and stable model colors
through `state.modelColors`. Fable determines those colors; Astra consumes
them. Do not hard-code the renderer's appearance into the page implementation.
Preserve space for point details on desktop and a compact details view on mobile.

## Data rules

- Use the current real diagnostic dataset for the table. It contains app-check
  outcomes, elapsed time, and API-equivalent cost estimates, not validated rankings.
- No published X, Z, or composite MTB currently exists. The Z implementation is a
  candidate; its output must not be relabeled as validated.
- Epoch data is imported, but exact model mapping remains pending. Do not fuzzy
  match names or assign an intelligence score to an unverified configuration.
- Missing coordinates do not become zero. Keep incomplete records out of the
  scored map while preserving their supported measurements in the table.
- Use separately labeled synthetic data only in local development fixtures. It
  must not appear as real model results in the deployed experience.
- Keep requested model IDs, clients, settings, cost basis, and evidence links
  inspectable. Reasoning selectors expose only configurations present in data.
- Selection never recalculates coordinates or normalizes them to the visible set.
  User preference controls, if added later, cannot change published scores.
- Distinguish API-equivalent estimates from actual subscription charges. Any model
  and payment method can enter the benchmark; missing cost remains unavailable.

## Scope and deployment

Change `site/` and its necessary site-local configuration. Import the shared core
types without changing their semantics. Report any needed contract change in the
handoff instead of changing scoring or benchmark tasks to suit the design.

Model Topography's Vercel team is `model-topography`; project `model-topography`.
It is wholly separate from ReviewWheel. Never deploy through `review-wheel`.
The existing credential is a private ignored file in the authoring worktree.
Do not copy it or print it. Use the task's authorized credential access method.

Produce a preview and preserve the current production site during design work.
The deliverable is a reviewable website for Dan and a stable host for Astra's
renderer. This prompt does not authorize a production replacement or PR merge.

## Completion

- Type checking and production build pass.
- Browserbase verifies tier selection, model selection, details, keyboard access,
  loading and empty states, and mobile behavior.
- Show desktop and mobile screenshots and the preview URL.
- Confirm that fake scores, private transcripts, and credentials are absent from
  the built output.
- Hand Astra the host component path, state adapter path, theme values, sizing
  behavior, event callbacks, build commands, and any unresolved interface issue.
- Name what remains unbuilt. The 3D renderer remains Astra's next task.

## Dan's visual direction

Use Artificial Analysis and DeepSWE as references for a direct benchmark tool.
Model Topography's interactive 3D element takes the central position on the first
screen. Keep styling simple. Use TypeScript and Tailwind, light and dark modes,
pastel colors for models, and monochrome styling for the benchmark itself.
No eyebrows or decorative subtitles. No further visual clarification is required
before beginning within this scope.
