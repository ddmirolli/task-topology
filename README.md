# Task Topology Index (TTI)

Which model should I use here, and how wide a task can I hand it?

TTI is being built to plot AI models in 3D, per task tier, with results
at [tasktopology.com](https://tasktopology.com). This repo holds the
benchmark design and test fixtures. The runner and results site are pending.

## The three axes

| Axis | Question | Unit |
|------|----------|------|
| Y | How smart is the model? | Epoch Capabilities Index |
| X | How much work can it complete unattended? | Workload at 90 percent success; calibration pending |
| Z | How much correct work per dollar? | Successful standardized work units per dollar |

Every axis starts at zero and has no ceiling. A model two years from now
plots beyond today's models without re-scaling the chart.

Most benchmarks score one thing: how smart a model is. Nobody picks a model
on that alone. People pick on trust, which is how long a model runs before
it does something dumb, and on cost. TTI puts all three on one chart.

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
90 percent success. Finishing the same work faster must improve TTI when
correctness, reliability, and cost are equal. Time spent is never credited
as work completed.

The earlier time-window and composite formulas are retired. Workload
calibration and a formula that includes speed need validation. The first
pilot reports task outcomes, elapsed time, and cost. It does not publish
X, TTI ranks, or claims about hours of reliable unattended operation.
See [PILOT.md](PILOT.md) for the next step.

## What counts as a failure

False completion. Destructive action. Thrash. Stalling to ask when told
not to. Marking untouched work done. Breaking a rule set at the start.
Editing things outside the task. Full definitions in [SPEC.md](SPEC.md).

## Running it

Coming with the harness. The plan: install, pick a model, run a tier,
then `tti submit` sends the transcript and token counts to
tasktopology.com. The site regrades every transcript itself and checks
the task text was used word for word.

## Repo map

- [SPEC.md](SPEC.md), the full design.
- [GRADING.md](GRADING.md), the failure list and tier rubrics.
- [PILOT.md](PILOT.md), the small validation pilot and its prerequisites.
- [tasks/](tasks/), the three tier task sets with answer keys the model
  never sees.
- [schema/](schema/), the run and aggregate data model behind the chart.
- [source/](source/), origin material.
- [public/brand/](public/brand/README.md), canonical logo and generated production assets.

## Status

Task sets, grading rules, and the data model are written. The Tier 1 sample
app includes baseline tests, hidden checks, and verified reference fixes.
Its checks still need a fairness audit before grading arbitrary model fixes.
Run `npm ci --prefix tasks/tier-1-entry/app`, then `npm run test:tier1`.
The Tier 2 seed script, benchmark grader, harness, and site are next.

## Credit

The width versus depth framing and the model floor argument come from
Theo (t3.gg): https://youtu.be/iBrAWpjXNxs. The trust axis, the cost
axis and the job ladder are Dan Mirolli's additions.
