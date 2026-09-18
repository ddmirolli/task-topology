# Task Topology Index (TTI)

Which model should I use here, and how wide a task can I hand it?

TTI plots every AI model as one dot in 3D space, per task tier. Results
live at [tasktopology.com](https://tasktopology.com). This repo is the
benchmark itself. Download it, run it on any model, submit the result.

## The three axes

| Axis | Question | Unit |
|------|----------|------|
| Y | How smart is the model? | Epoch Capabilities Index |
| X | How long can it be trusted to run unattended? | Hours at 90 percent success |
| Z | How much finished work per dollar? | Successful task hours per dollar |

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

## How X is scored

Every run records when the model first fails. All runs feed one failure
rate per 10 minute window, p. X is the point where (1 - p)^n drops to
0.90. A model that fails 5 percent of windows has X of about 20 minutes.
One that fails 1 percent has X of about 1.7 hours. Small floor gains move
X a long way. That is the point.

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
- [tasks/](tasks/), the three tier task sets with answer keys the model
  never sees.
- [schema/](schema/), the run and aggregate data model behind the chart.
- [source/](source/), origin material.

## Status

Task sets, grading and data model are written. Sample app, harness,
grader and site are next.

## Credit

The width versus depth framing and the model floor argument come from
Theo (t3.gg): https://youtu.be/iBrAWpjXNxs. The trust axis, the cost
axis and the job ladder are Dan Mirolli's additions.
