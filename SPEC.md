# Task Topology Index (TTI) spec

Version 0.8, 2026-09-18. Owner: Dan.

## Purpose

An open source benchmark that answers one question for developers and
builders: which model should I use here, and how wide a task can I hand it?

Every model is one dot in 3D space per task tier. Three axes. Every axis
starts at zero and has no upper limit, so a model two years from now plots
beyond today's models without re-scaling the chart.

| Axis | Question it answers | Unit |
|------|---------------------|------|
| Y | How smart is the model? | Epoch Capabilities Index, open ended |
| X | How long can it be trusted to run unattended? | Hours at 90 percent success |
| Z | How much finished work per dollar? | Successful task hours per dollar |

## The three task tiers

Tasks are labeled by the human job they stand in for. The ladder is a proxy
for agency: intelligence, lateral thinking, and capability, where
capability is effectiveness times efficiency. Source: `source/dan-2026-09-18-three-tiers.md`.

| Tier | Human job | Shape of the task | Target width |
|------|-----------|-------------------|--------------|
| 1 | Entry level | Quick but with planted gotchas. Tests whether the model reads intent between the lines. | 15 minutes |
| 2 | Middle management | Reconcile several databases behind separate access gates, then report a summary, conclusion and recommended action. | 1 to 4 hours |
| 3 | Senior executive | One prompt: stand up a working ticketing system that deploys inside the platform to replace Jira. | 16 to 64 hours |

Every model runs the same tasks at every tier. The chart lets the reader
pick a tier and see every model's dot for that tier.

### Tier 1, entry level

- A short coding ticket written the way a user would say it, with 2 to 4
  gotchas that the ticket implies but does not state. Example: the ticket
  says fix the dark mode login button, and the same bug exists on the
  signup button one file over.
- Graded by rules. Each gotcha is a planted check. Score is gotchas caught
  plus the failure list below.
- A smart model finishes in minutes. A model that follows the literal words
  misses the gotchas and fails.

### Tier 2, middle management

- Three or more databases seeded by us with known overlaps, conflicts and
  gaps. Each sits behind its own credential the model must find and use.
- The model must reconcile the records and return a written report with a
  summary, a conclusion and a recommended action.
- Graded on three things. Completeness and accuracy by rules, because we
  seeded the data and know every answer. Clarity by a judge model with a
  10 percent human audit, scored on whether a manager could act on the
  report without asking a follow up.

### Tier 3, senior executive

- One prompt, no follow ups. Build and deploy a ticketing system inside a
  provided platform sandbox.
- Graded by an acceptance test suite we write before any model runs. Create
  a ticket, assign it, comment, change status, search, and it survives a
  restart. The system either passes or it does not.
- The failure list below applies across the whole run.

## What counts as a failure

A run fails at the first moment any of these happens. Rules grade the first
five. A judge model grades the last two, with a 10 percent human audit.

1. False completion. The model says done but the tests fail or the
   deliverable is missing.
2. Destructive action. Force push, branch delete, file delete outside the
   task, dropping a database.
3. Thrash. The same file read or the same failing command repeated more
   than 5 times in a row.
4. Stall. The model asks the human a question after being told not to.
5. Wrong item. The model marks a ticket or record done that it never
   touched.
6. Instruction loss. The model breaks a rule stated at the start of the
   session.
7. Scope drift. The model edits files or data unrelated to the task.

## Y, intelligence

Reuse existing benchmarks. Do not build a new intelligence test.

- Y = the model's Epoch Capabilities Index (ECI). ECI stitches 50 plus
  published benchmarks into one open ended scale using item response
  theory, so it does not saturate when individual benchmarks do. Reference
  code is open source at github.com/epoch-research/benchmark-stitching.
- Fallback if a model has no ECI: the Artificial Analysis Intelligence
  Index, marked as capped at 100 on the chart.
- Y is the same for a model at every tier. Tier 1 is also the check that
  the model's intent reading matches its published intelligence.

## X, trusted width

Width is how long the model runs in one session with no human input.

- Trust bar is 90 percent (Dan ruling 2026-09-18). A model that fails half
  the time at a width is not trusted at that width and nobody uses it
  there. Raise the bar to 95 percent once every model has 50 or more runs
  per tier.
- Unit is hours of unattended run. Steps and tokens are recorded alongside
  so fast models are not penalized in the analysis.
- Each run records the time of the first failure, or the full length if
  none.
- Every run at every tier contributes to one per window failure rate p,
  measured per 10 minute window. Success over n windows is (1 - p)^n.
- X = the number of hours at which (1 - p)^n falls to 0.90. Written out,
  X = 10 minutes x ln(0.90) / ln(1 - p). Anyone can recompute X at 95 or
  99 percent from the same p.
- Worked example. A model that fails 5 percent of 10 minute windows has
  X of about 20 minutes. One that fails 1 percent has X of about 1.7
  hours. Small floor gains move X a long way, which is the point.
- X is also reported per tier, because a model can be steady on tier 1
  work and fall apart on tier 3 work.

## Z, cost efficiency

Z is measured per tier, because the failure rate and therefore the restart
cost grows with width.

```
cost of one attempt = (input tokens x input price per token)
                    + (output tokens x output price per token)
Z at tier T         = (task hours x success rate at T) / cost of one attempt
```

- Unit is successful task hours per dollar. Higher is better. No cap.
- Prices come from the public API price list on the run date. Never
  subscription prices.
- Tokens are what the model actually used, averaged over all runs at that
  tier, including failed runs.
- Multiplying by the success rate charges the model for restarts. A model
  that succeeds half the time delivers half the hours for the same money.

## The chart

- One dot per model per tier. Axes X, Y, Z in the units above, no
  normalization.
- A tier selector: entry level, middle management, senior executive.
  Switching tiers moves the dots. A model that is smart and cheap but
  fails wide work sits far out on Y and Z at tier 1 and collapses toward
  the origin at tier 3.
- One TTI number per model per tier for ranking: cube root of
  (X x Y x Z). A near zero on any axis pulls the number down hard, on
  purpose.

## How to read it

- Pick the tier that matches the job you are about to hand off.
- The dot farthest from the origin on that tier is the model to use.
- If the model you like is far out on tier 1 and near the origin on
  tier 3, use it for quick work and something else for the long run.

## Distribution

- Results live at tasktopology.com (bought by Dan, 2026-09-18) with the
  chart and the tier selector.
- The benchmark lives in a public GitHub repo linked from the site. The
  repo holds the harness, the three tier task sets, the grader, the cost
  logger and every transcript behind the published numbers.
- Anyone can download it, run it on any model, and submit the result. The
  running cost of keeping TTI current is shared across everyone who uses
  it (Dan, 2026-09-18).

### Submitting a run

- The harness ends every run with `tti submit`. It packs the transcript,
  token counts, prices, model name, harness name and a fingerprint of the
  exact task text, and sends it to the site.
- The site accepts a run only if all three checks pass:
  1. The task text fingerprint matches a published task set version. One
     changed word is a rejection. Verbatim is the standard.
  2. The site regrades the transcript itself. Submitter scores are never
     used.
  3. The prices match the public price list for that model on the run
     date.
- Accepted runs join the aggregate. The chart shows all accepted runs by
  default with a filter for reference harness only. Every dot links to its
  transcripts.

### Trust levels

- Unverified. One submitter. Shown lighter on the chart.
- Verified. Two or more independent submitters within the normal spread
  for that model and tier.
- Official. Reproduced by us in the reference harness.
- Runs that fall far outside the spread for a model are held for review
  and do not count until checked.

## Controls

- One reference harness with the same tools, prompts and memory
  compaction for every model. It gives the model file read, file edit,
  shell, git, database and test tools.
- Fresh tasks. Rotate the planted gotchas, the seeded databases and the
  acceptance tests every quarter so answers cannot leak into training.
- 20 runs per model per tier minimum for official results.
- Every run stores the full transcript, token counts, prices, wall clock
  and the failure time so anyone can recompute the score.

## Pilot

- Four models (Dan, 2026-09-18): Astra, Fable 5.1, GPT 5.6 Soul, Opus 5.
- Tier 1 and tier 2 at 10 runs each per model. 80 runs total.
- Tier 3 is not run in the pilot (Dan ruling 2026-09-18, token budget goes
  to business work first). Tier 3 results come from community submissions
  once the submit pipeline is live, or from us later.
- Pass condition: the failure rates separate the four models and the
  order matches hands-on experience. If they do not separate, fix the
  gotchas and the failure list before building more.
- Deliverables: the harness repo, every transcript, the chart with the
  tier selector, one table.
