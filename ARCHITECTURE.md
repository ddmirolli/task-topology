# Platform and task architecture

One versioned benchmark contains three tiers. Every compared model receives the
same task set, starting state, tool contract, limits, and grading requirements.
Subscription, API, and local access remain open. Execution provenance distinguishes
different clients and settings. Sharing an access method is not a scoring shortcut.

## Platform languages

Strict TypeScript is the default for new platform code. The compiled core in
`core/` owns execution profiles, private submission intake, candidate efficiency arithmetic, and the future
website-to-map interface. Type checking runs before launch and pilot tests.
The compiler emits Node-compatible JavaScript and declarations into ignored
`.build/`. There is no native TypeScript execution requirement.

`benchmark/profile.mjs` and `benchmark/store.mjs` preserve their old import paths and delegate to the typed
implementations. Canonical serialization stays stable. The current protocol namespace is `mtb`.
Version identifiers participate in hashes, so archived records retain their original
bytes and must be replayed with their recorded source revision. Provider settings and model identifiers remain open-ended.

Python remains the language for data generation, SQL reconciliation, and external
intelligence imports. New website code uses TypeScript and Tailwind CSS, with light and dark modes.
The benchmark interface is monochrome. Pastel colors identify models. Fable 5.1 owns the site
implementation and design. Astra implements the 3D renderer after that handoff.

The existing pilot runner, grading worker, and transcript grader still contain
JavaScript. This is the first migration boundary, not a complete conversion.
Migrate those modules when their behavior can be checked against frozen evidence.
TypeScript does not replace runtime input validation, isolation, or judge calibration.

Node remains the platform runtime. A Bun migration or Rust rewrite has no measured
benefit yet. Go and other languages can appear in benchmark tasks independently
of the language used to operate the benchmark.

## Task languages

Preserve the existing Tier 1 fixture behavior and collected attempt evidence.
They are a versioned diagnostic baseline. Current package metadata and protocol
names change task fingerprints; existing runs still refer to their original
source revision. New task requirements require a new task-set version and fresh,
matched model runs.

The next unified suite includes meaningful cross-language work. It does not let
each model choose an easier language track. The following allocation is the
implementation plan; these cross-language tasks are not built yet:

| Tier | Language allocation | Behavior to measure |
|---|---|---|
| Entry level | Bounded tasks across JS or TypeScript, Python, and Go | Repair observable behavior with planted requirements |
| Middle management | SQL queries, supplied TypeScript access client, Python reconciliation | Preserve customer identity, money units, dates, and source provenance through the workflow |
| Senior executive | TypeScript interface, Go API, Python import worker, PostgreSQL | Complete a deployed ticket workflow, including import, permissions, retries, and durable data |

The middle-management deliverable remains an accurate, actionable report. Its
task does not expand into building a distributed application. Source data remains
read-only. Any editable helper code must have explicit paths in the task contract.

Every prescribed executive component must perform required work. An unused file
does not establish language coverage. Acceptance tests must exercise the complete
workflow and recovery from interrupted work. Files, lines of code, language count,
tokens, and time spent never earn work credit.

Computer-use or 3D recommendations require task coverage for those skills. The
website's 3D map is not evidence that the benchmark has tested a model's 3D skills.
Those tasks and acceptance checks remain to be designed within the shared suite.
Executive model runs remain deferred under Dan's earlier pilot ruling.

## Scoring and configuration identity

`SPEC.md` defines the axes. `core/efficiency.ts` implements the unpublished
`mtb-efficiency-geometric/2` candidate. It accepts a complete operator-supplied
plan and adjudicated attempt records. It checks IDs, configuration, cost basis,
measurement validity, and completeness before calculating rates.

Equal proportional improvements to speed and cost efficiency receive equal
weight. This is a proposed calibration choice, not a claim that the weighting
matches every user's preferences. Mathematical checks do not validate task units,
grader truth, or model recommendations. Publication stays disabled.

Reasoning settings identify different measured configurations. Keep exact provider
values and the displayed labels. Low, medium, high, extra high, and ultra are
examples, not a required provider catalog. Their ordering does not imply equal
steps or shared semantics across providers. Never interpolate an untested setting.

## Audience and the routing skill

Dan rulings, 2026-09-19. Model Topography serves builders of software. It does not
try to measure or route every kind of prompt. Task tiers, fixtures, and any tier
rubric describe software work.

The project has two products that share one published dataset:

1. The open benchmark and its website.
2. A callable `/modeltopo` skill. It classifies a software task as entry level,
   middle management, or senior executive, then picks the best measured model
   configuration that the user can reach. This skill is not built yet.

The division of duty keeps the benchmark unbiased:

- The benchmark publishes measurements and never a winner. Axes are named
  `workload`, `efficiency`, and `intelligence`. Speed and cost stay published
  separately, because a routing policy weighs them separately.
- The skill owns the selection policy. Anyone who loads it can tune the weights,
  like an equalizer: cost, speed, breadth of work, intelligence. Tuning changes the
  pick. It never changes a published score.
- Model identity follows an open external registry, recorded in
  `ModelConfiguration.identity` as scheme, provider, and model. models.dev is the
  first scheme. The benchmark does not mint IDs. The skill inherits the providers
  its host client already has, such as T3 Code providers, and matches them to
  registry IDs. `accessMethod` records how a run reached the model.
- An identity is recorded only after it is verified against the registry. Runs
  record identity and access method at execution time. They cannot be added later.

Open work for the skill: a written tier rubric that a small model can apply to a raw
task, with evidence that the assigned tier predicts success. A judge model must not
also be a contestant in the cohort it grades.

## Website and renderer ownership

`core/topography.ts` defines the shared interface. Fable owns the page, typography,
colors, controls, details panel, accessible results table, and responsive layout.
Astra later implements `TopographyRenderer` with mount, update, and dispose methods.
The page passes state and a theme palette. The renderer reports focus and selection.

`visiblePoints` selects only complete validated coordinates from one comparison
and tier. Selecting models changes the surface, not their scores. Missing values
remain unavailable. Unavailable models can stay visible in the results table.

The connecting sheet is visual interpolation. It does not establish performance
between models. Duplicate projections, gaps, sparse selections, and reasoning
paths need explicit handling in the later renderer. No 3D renderer is built here.

## Deployment ownership

Model Topography is separate from ReviewWheel. Its Vercel team slug is
`model-topography`, and its project is `model-topography`. Use that team explicitly.
The site lives at `modeltopography.com`. The local CLI link uses that team and project.

Dan authorized `.env.vercel.local` as this task's local credential exception.
It is ignored and owner-readable. Never print, commit, copy into website output,
or transfer that file to another worktree. Other agents need their own authorized
credential loading path. Do not use ReviewWheel or personal 1Password access.

The existing diagnostic deployment stays online while Fable builds the replacement.
No design or renderer changes are deployed by this architecture update.
