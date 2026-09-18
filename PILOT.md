# Small validation pilot

Draft v0.1, 2026-09-18. The three scoring rulings in SPEC.md are approved.
The model choices, spending limit, and replacement TTI formula are not.

## Question

Can TTI grade different valid solutions fairly and record correct work,
speed, and cost without rewarding delay or favoring a model?

## Proposed trial

Use Tier 1 tickets 01, 04, and 07. They exercise UI behavior, data
preservation, and date handling. Give two models the same starting app,
verbatim instructions, tools, and limits. Run each ticket three times per
model in fresh sessions: 18 attempts. This is a pipeline check, not enough
evidence for a public reliability claim. Keep the larger four-model pilot
and Tier 3 runs deferred.

## Before any model calls

1. Audit the three tickets for requirements a reasonable reader can infer.
   Identify allowed fixes, preserved behavior, and explicit constraints.
2. Replace checks that require a particular implementation. Test rendered
   button behavior, preserved invoices, and date behavior. Accept different
   selectors, internal names, and migration approaches that satisfy the task.
3. For each ticket, prove the checks accept two independently written valid
   solutions and reject fixes that leave a required behavior broken. The
   current suite proves only the reference fixes; this work is pending.
4. Build the minimum runner: isolated app copies, the same tool interface,
   transcripts, timing, provider usage, and grading outside the model's
   workspace. Keep answers,
   reference fixes, hidden checks, and repository history inaccessible to
   the tested model. A copied directory alone does not provide isolation.
5. Freeze the task, grader, runner, model settings, and price records. Set
   per-attempt time and token limits plus a total spending cap. Obtain Dan's
   spending approval before model calls. Alternate model run order to reduce
   systematic timing differences.

Use synthetic app data only. Keep pilot records local; there is no automatic
upload or public transcript publication. Keep provider keys and authorization
headers out of task inputs and logs. Check records for secrets before any
sharing. Community submission and public transcript handling are later work.

## Record and compare

Each ticket is one fixed work unit in this matched pilot. A correct result
earns one unit. A failed attempt earns zero. This does not mean every ticket
is equally difficult or that these units define the eventual X scale.

Record the outcome, failed requirement, elapsed seconds, billable usage,
USD cost, exact model settings, and transcript for every attempt. Start the
clock when the model receives the task. Include tool calls and verification
inside the run. Stop at final submission or the declared timeout. Keep
setup and post-submission grading time separate.

Compare per-ticket outcomes first. Pool speed and cost only across the same
task mix with equal repetitions. Include failed attempts and their retries
in elapsed time and cost. Report provider and environment failures separately.
Exclude them from a model comparison only with evidence of an external fault;
record the exclusion and retain its spend in the pilot budget. A task failure
or timeout cannot be relabeled as infrastructure failure to improve a score.
Use the frozen retry policy, never retry until a preferred model wins.

These synthetic examples check the arithmetic; they are not model results.
A and B complete the same four tasks and fail the same fifth task:

| Case | Correct attempts | Total attempt time | Total cost | Correct work per hour | Correct work per dollar |
|------|------------------|--------------------|------------|-----------------------|-------------------------|
| A | 4 of 5 | 30 minutes | $2 | 8 | 2 |
| B | 4 of 5 | 60 minutes | $2 | 4 | 2 |

With all other scoring inputs equal, the eventual TTI formula must rank
A above B. Duplicating B's wait time cannot improve X, Z, or TTI. This test
constrains the formula; it does not select weights for speed versus cost.

## Exit condition

Proceed only when valid alternatives pass, demonstrated failures fail, and
each outcome, duration, and charge can be reproduced from its records.
Ties and unexpected rankings are acceptable. If a test is defective, record
why, version the fix, and apply it to every affected comparison.

Deliver one results table and the evidence behind it. Report uncertainties
and grader disagreements. Leave X and TTI unavailable. No claim about hours
of reliable unattended work comes from this pilot. Use what it reveals to
finish the grader and scoring design before expanding the benchmark.
