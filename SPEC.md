# Task Topology Index (TTI) spec

Version 0.10, 2026-09-18. Owner: Dan.

Scoring design under validation. No published TTI scores yet.

## Purpose

An open source benchmark that answers one question for developers and
builders: which model should I use here, and how wide a task can I hand it?

Every model is one dot in 3D space per task tier. Three axes. Every axis
starts at zero and has no upper limit, so a model two years from now plots
beyond today's models without re-scaling the chart.

| Axis | Question it answers | Unit |
|------|---------------------|------|
| Y | How smart is the model? | Epoch Capabilities Index, open ended |
| X | How much work can it be trusted to complete unattended? | Workload at 90 percent success; scale pending calibration |
| Z | How much correct work per dollar? | Successful standardized work units per dollar |

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
pick a tier and see every model's dot for that tier. The target durations
above describe the intended scope of the work. They are uncalibrated design
estimates, not required model runtimes or points awarded for time spent.

### Tier 1, entry level

- A short coding ticket written the way a user would say it, with 2 to 4
  gotchas that the ticket implies but does not state. Example: the ticket
  says fix the dark mode login button, and the same bug exists on the
  signup button one file over.
- Graded by rules. Each gotcha is a planted check. Score is gotchas caught
  plus the failure list below.
- Score observable results. A failed ticket does not by itself establish
  that a model is unintelligent or cannot understand intent.
- Implied requirements must be supported by the task and supplied context.
  Do not require a model to guess the test author's unstated preference.

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

## Scoring rulings, 2026-09-18

- Accept every solution that meets the task's observable requirements and
  explicit constraints. A reference fix proves that a task is solvable;
  it is not the required implementation.
- Speed must improve TTI. For equal work and all other scoring inputs
  equal, including correctness, reliability, intelligence, and cost, a
  faster model must receive a higher score. Waiting, extra tool
  calls, and longer output must never increase its credited work.
- Rank models from the evidence. A tie or an unexpected winner is a valid
  result. Never change tasks or grading to obtain an expected ranking.

The pilot plan is in [PILOT.md](PILOT.md). It separates these approved
rules from the formulas and grader changes that still need validation.

## Access ruling, 2026-09-18

Any model can enter through any execution client or payment method.
Subscription access, API access, and local execution are examples, not an
allowlist. Entry never depends on a model appearing in a provider catalog,
a billing mode, an API key, a public price, or token telemetry.

Record the model identity, execution client and version, settings, tools,
and access method. Mark unavailable evidence explicitly. Apply the same task
and grading requirements to every entry. Missing cost prevents a cost score;
it does not reject the work or its supported correctness and timing evidence.
Keep different execution configurations separate in comparisons.

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
- If a model has no verified ECI identity match, leave Y unavailable.
  Artificial Analysis may appear as a separately labeled intelligence measure.
  Keep the source and version visible. Its raw score does not substitute for
  ECI on the same numerical axis. Any conversion needs validation.
- Y is the same for a model at every tier. Treat it as separate evidence;
  a Tier 1 result does not have to match a published intelligence ranking.

## X, trusted width

X measures the amount of coherent work a model can complete in one session
without human help at the 90 percent success bar. Actual runtime is a
separate measurement. Finishing the same work faster does not reduce X.

- Define workload levels before model runs, independently of model speed.
  Compare the same task versions, constraints, and starting conditions.
- Report success by tested workload level and tier, with uncertainty.
  Completing a short task does not establish reliability on a long task.
- Keep failure timestamps for diagnosis. Do not turn elapsed failure-free
  minutes into completed work or infer an unattended time guarantee.
- The version 0.8 formula based on failures per ten minutes is retired.
  The pilot has not established that failure risk is constant over time.
- Calibration of the workload scale and estimation of the 90 percent
  boundary remain open. Publish X as unavailable until they are validated.
  A run count alone does not establish the required reliability.

## Speed

Speed is correct work completed per elapsed hour on a matched task set.
It is recorded separately from cost and must affect the eventual TTI rank.

```
completed_work = sum of fixed work units for successful attempts
speed          = completed_work / sum of elapsed attempt hours
```

- Fix work units before runs. For the small Tier 1 pilot, each ticket has
  one unit and every model gets the same tickets with equal repetitions.
  These units compare that matched task set only; they do not calibrate X
  or equate a Tier 1 repair with a Tier 3 project.
- Include elapsed time spent on failed attempts. Each failed attempt earns
  zero completed work. Record every retry as another attempt.
- Start the clock when the task is handed to the model. Stop when the
  model submits its final result or reaches the declared time limit.
  Include model thinking, tool use, and in-session verification. Exclude
  environment setup and the independent grader's work after submission.
- Record timeout, provider failure, and environment failure separately.
  Apply the pilot's exclusion rules without looking at model rank.
- Compare runs with the same harness, task mix, resource limits, and
  declared provider settings. Speed measures that tested configuration.

## Z, cost efficiency

Z measures correct work per dollar on the same matched task set.

```
Z = completed_work / sum of attempt costs in USD
```

- Use the same fixed work units as the speed calculation. Never use the
  model's elapsed runtime as the numerator.
- Include costs from failed attempts and retries. Include all billable
  token categories and use the public API prices in effect on the run date.
  Record cache and reasoning usage when the provider bills them separately.
- Access and cost accounting are separate. Use complete usage and dated API
  prices to report an API-equivalent estimate when those data exist, regardless
  of how the run was paid for. Label estimates separately from actual charges.
- Keep actual charges and any documented allocation of subscription or local
  compute costs in separate fields. Never pool different cost bases.
- Missing usage or prices leave Z unavailable. An included subscription run
  does not imply zero normalized cost or infinite cost efficiency.
- If no attempt succeeds, completed work, speed, and Z are zero, provided
  their denominators are known and positive. Missing or nonpositive
  denominators make the corresponding metric unavailable.

## The chart

- One dot per model per tier. Axes X, Y, Z in the units above, no
  normalization.
- A tier selector: entry level, middle management, senior executive.
  Switching tiers moves the dots. A model that is smart and cheap but
  fails wide work sits far out on Y and Z at tier 1 and collapses toward
  the origin at tier 3.
- Show speed next to the three axes. The final TTI ranking must satisfy
  the speed ruling above while preserving correctness and reliability.
- The version 0.8 cube-root formula is retired because it omits speed.
  The replacement formula and tradeoffs between speed, price, and trust
  require validation before publication. Do not publish provisional TTI
  numbers or choose weights after seeing model results.

## How to read it

- Pick the tier that matches the job you are about to hand off.
- Compare the measured work, reliability, speed, and cost for that tier.
  Geometric distance across axes with different units is not a selection
  rule. A model must meet the job's correctness and reliability needs.
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

This is the future community workflow. The validation pilot keeps records
local and does not upload or publish transcripts. Provider credentials and
authorization headers must never enter published records.

- The harness ends every run with `tti submit`. It packs the transcript,
  available usage and cost evidence, model name, execution client and a fingerprint of the
  exact task text, and sends it to the site.
- The site checks task integrity and independently grades each run:
  1. The task text fingerprint matches a published task set version. One
     changed word is a rejection. Verbatim is the standard.
  2. The site regrades the transcript itself. Submitter scores are never
     used.
- Verify supplied prices and usage before computing a cost score. Missing
  cost evidence leaves that score unavailable without rejecting the run.
- Keep accepted runs grouped by task version, execution configuration, limits,
  evidence status, and cost basis. Do not silently pool clients by model name.
  Every published result links to its supporting evidence.

### Trust levels

- Unverified. One submitter. Shown lighter on the chart.
- Verified. Two or more independent submitters within the normal spread
  for that model and tier.
- Official. Reproduced by us in the reference harness.
- Unusual results can trigger an evidence check. An unexpected rank or
  score is not grounds for rejection. Record the reason and outcome of
  every hold, and apply the same integrity checks to every model.

## Controls

- One reference harness with the same tools, prompts and memory
  compaction for every model. It gives the model file read, file edit,
  shell, git, database and test tools.
- Fresh tasks. Rotate the planted gotchas, the seeded databases and the
  acceptance tests every quarter so answers cannot leak into training.
- Twenty runs per model per tier is the planned minimum for official
  results, not proof of a 90 percent success boundary. The analysis must
  report uncertainty and the workloads actually tested.
- Every run stores the full transcript and available identity, usage, price,
  timing, and failure evidence. Mark missing fields as unavailable. Publish
  only metrics supported by the evidence.

## Pilot

- Original larger pilot, deferred until the small validation pilot passes.
- Four models (Dan, 2026-09-18): Astra, Fable 5.1, GPT 5.6 Soul, Opus 5.
- Tier 1 and tier 2 at 10 runs each per model. 80 runs total.
- Tier 3 is not run in the pilot (Dan ruling 2026-09-18, token budget goes
  to business work first). Tier 3 results come from community submissions
  once the submit pipeline is live, or from us later.
- Pass condition: the runner is reproducible, the grader accepts valid
  alternatives and rejects demonstrated failures, and timing and costs
  can be traced to their records. Ties and unexpected rankings are valid.
- Freeze task and grader versions before comparisons. If a proven test
  defect requires a correction, publish the reason and a new version.
  Regrade all affected results equally, or rerun all affected comparisons
  if the task, environment, or required evidence changed.
- Deliverables: the harness repo, every transcript, the chart with the
  tier selector, one table.
