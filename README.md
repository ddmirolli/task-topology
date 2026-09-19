# Model Topography

Which model should I use here, and how wide a task can I hand it?

The Model Topography Benchmark measures models across three task tiers.
Model Topography will plot those measurements in 3D, with results
at [modeltopography.com](https://modeltopography.com). This repo holds the
benchmark design, test fixtures, and a small macOS validation runner.
The [diagnostic results explorer](https://modeltopography.com) is hosted.
The project belongs to the Model Topography Vercel team. Vercel verifies
the apex domain configuration. Public submission remains pending.

## The three axes

| Axis | Question | Unit |
|------|----------|------|
| Workload | How much work can it complete unattended? | Workload at 90 percent success; calibration pending |
| Efficiency | How efficiently does it complete correct work? | Combined speed and cost efficiency; calibration pending |
| Intelligence | How smart is the model? | Epoch Capabilities Index |

On the chart, workload is X, efficiency is Y, and intelligence is the vertical Z.

Every axis starts at zero and has no ceiling. A model two years from now
plots beyond today's models without re-scaling the chart.

Model choice depends on capability, the amount of work that can be completed
without help, speed, and cost. MTB records those dimensions together.

## The three tiers

Tasks are labeled by the human job they stand in for.

| Tier | Job | Task |
|------|-----|------|
| 1 | Entry level | A quick ticket with planted gotchas. Models that read the literal words miss them. |
| 2 | Middle management | Reconcile several databases behind separate credentials. Report a summary, a conclusion and a recommended action. |
| 3 | Senior executive | One prompt: stand up a working ticketing system to replace Jira. |

The ladder is a proxy for agency: intelligence, lateral thinking and
capability, where capability is effectiveness times efficiency.

## Scoring status

The goal is to measure how much work a model can complete unattended at
90 percent success. Finishing the same work faster must improve MTB when
correctness, reliability, and cost are equal. Time spent is never credited
as work completed.

The earlier time-window and composite formulas are retired. Workload
calibration and the implemented speed-and-cost candidate need validation. The first
pilot reports task outcomes, elapsed time, and cost. It does not publish
workload scores, MTB ranks, or claims about hours of reliable unattended operation.
See [PILOT.md](PILOT.md) for the next step.

## What counts as a failure

False completion. Destructive action. Thrash. Stalling to ask when told
not to. Marking untouched work done. Breaking a rule set at the start.
Editing things outside the task. Full definitions in [SPEC.md](SPEC.md).

## Running it

The [validation runner](pilot/README.md) grades three Tier 1 tasks and records
correctness and available timing and cost evidence. Export a task for any
subscription client, API runner, or local model, then grade the returned app.
There is no model or access-method allowlist. The optional API runner has its
own spending controls. Local verification makes no benchmark model calls.
Public submission is later work.

The platform uses strict TypeScript for the scoring core, execution profiles,
private submission intake, and the future map contract. Existing Python data tools and versioned JS task
fixtures remain. See [ARCHITECTURE.md](ARCHITECTURE.md) for the migration boundary.
Run `npm ci` and `npm run build:core` before using the private benchmark CLI.

## Repo map

- [SPEC.md](SPEC.md), the full design.
- [GRADING.md](GRADING.md), the failure list and tier rubrics.
- [PILOT.md](PILOT.md), the small validation pilot and its prerequisites.
- [pilot/](pilot/README.md), the runner, public task contracts, and behavioral checks.
- [tasks/](tasks/), the three tier task sets with answer keys the model
  never sees.
- [schema/](schema/), the run and aggregate data model behind the chart.
- [source/](source/), origin material.
- [public/brand/](public/brand/README.md), canonical logo and generated production assets.

## Status

Task sets, grading rules, and the data model are written. The Tier 1 sample
app includes baseline tests, hidden checks, and verified reference fixes.
The separate pilot grader accepts two distinct valid fixes for each selected
task and rejects the original and partial defects. The original ten-ticket
suite remains a maintainer fixture check, not the pilot scoring authority.
Run `npm ci --prefix tasks/tier-1-entry/app`, then `npm run test:tier1`.
Run `npm run test:pilot` and `npm run verify:pilot` for local pilot verification.
Browser verification uses Browserbase. An 18-attempt subscription cohort finished
with 17 apps passing the task checks. Execution findings keep its benchmark rates
unavailable. See the [validation results](VALIDATION-2026-09-18.md) for the evidence
and runner corrections. Transcript review and human audit remain pending. The middle-management
data generator and numeric checks now work, including PostgreSQL integration.
Its isolated model runner remains pending. See [LAUNCH.md](LAUNCH.md) for current milestones.

## Credit

The width versus depth framing and the model floor argument come from
Theo (t3.gg): https://youtu.be/iBrAWpjXNxs. The trust axis, the cost
axis and the job ladder are Dan Mirolli's additions.
