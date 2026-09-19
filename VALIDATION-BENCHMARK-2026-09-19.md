# Benchmark build verification, 2026-09-19

This build adds the executable version 2 fixture suite and keeps benchmark scores
unpublished. It does not change website files or run executive model trials.
The original two validation reports remain unchanged.

## Grading corrections

The original attempt 01 reproduced an unsupported pass despite a native patch
rejection in its packet. The new grader keeps that execution hold unresolved
unless review establishes an invalid environment. A citation to a real line alone
cannot clear it.

Dan ruled that an unmet task requirement also counts as instruction loss, even
when the model edited the right code. The rules grader now records that failure
from independent acceptance evidence. It does not multiply work deductions.

The calibration runner freezes labels and implementation hashes before calls.
It checks five synthetic cases and original diagnostic attempts 01, 02, and 10.
Earlier rejected canaries remain in the private archive. Their failures exposed
unsupported positive decisions, confusion between visible and hidden tests,
path-alias misclassification, and a citation to an opening JSON brace. The rules
grader now attaches independent failed-check evidence directly and retains the
judge's original response separately.

The final Terra transcript canaries passed all eight cases with prompt version 7
and independently attached rule evidence. The report canaries passed all three
cases: accurate prose, a wrong total, and a missing owner and deadline.

Model reviews remain provisional. Human audit and workload calibration remain
required before published comparisons. The audit task cannot be completed by an
agent. Final canary receipts are retained with the build's private evidence.

## Executable suite

| Tier | Verified behavior | Limits |
|---|---|---|
| Entry | Existing JavaScript fixtures, Python money rounding, Go calendar dates | Original maintainer checks remain distinct from the matched pilot grader |
| Management | TypeScript source exports, Python reconciliation, isolated PostgreSQL access, stale-password rejection, denied writes, source hashes, numeric grading | Report and transcript review remain separate from numeric success |
| Executive | TypeScript browser interface, Go API, Python import worker, PostgreSQL, local HTTPS, accounts, tickets, search, permissions, restart durability, import replay and interruption, 200-ticket load | Local reference fixtures only; executive model trials remain deferred |

Two valid implementations pass each new entry task. The original defect and a
partial fix fail. Management checks reject wrong totals and source edits.
Executive negative fixtures fail on lost data and duplicate imports.
The isolated model tool bridge can write its workspace and cannot read an
operator-only file outside it. Database operator passwords are random per attempt.

Browserbase session `8999287a-bb69-47bd-b707-49c35a657dfa` verified signup, login,
creation, editing, assignment, status, comments, search, and logout through the
executive reference interface. Requests used the local sandbox gateway.
The JavaScript browser fixture run also verified all 16 pilot fixture verdicts.
No public website deployment follows from these checks.

## Scoring consistency

All three tiers use the same adjudication function. Audit-pending or unqualified
judge records cannot enter candidate efficiency as successful completed work.
Provider and environment failures remain distinct from task failures. Task order
and model labels do not change the arithmetic. Added time or cost lowers candidate
Z for identical work. Missing cost remains unavailable.

These checks establish implementation behavior, not the validity of the workload
scale, confidence estimates, or the proposed speed-cost weighting. Published X,
Y, and Z remain unavailable in the prepared cohort.

## Prepared comparison

The version 2 plan has 24 slots: two configurations, six tasks, and two repetitions.
Each configuration receives the same five entry tasks and one management task.
Configuration order alternates. No retries are planned. Compare tiers separately.

The plan grants zero new API spending and has no paid fallback. Subscription
allowance requires a fresh preflight. Executive trials remain deferred. Judge
qualification and human audit hold the comparison. No new comparison cohort was
executed during this build.

## Reproduce verification

```sh
MTB_TEST_CODEX=1 npm run test:pilot
npm run test:launch
npm run test:suite
npm run test:tier1
npm run verify:pilot:browser
npm run verify:suite -- NEW_EVIDENCE_DIRECTORY
npm run verify:executive -- NEW_NEGATIVE_EVIDENCE_DIRECTORY
python3 -m unittest discover -s tasks/tier-2-management/tools -p 'test_*.py'
python3 -m unittest discover -s benchmark -p 'test_*.py'
```

Local tests passed 25 pilot tests with the installed CLI probe, 26 launch tests,
two suite control tests, seven management tests, and two intelligence tests.
The ten original tickets passed their expected fixture checks. The new suite
produced 14 passing validation receipts, and both executive negative cases failed
the required acceptance checks.

The new workflow runs offline fixture checks. It makes no model or Browserbase
calls. Local verification receipts do not claim that the workflow ran remotely.
The private preservation manifest verified byte hashes for 4,134 files copied
from the original cohorts and calibration archives. Those sources were unchanged.
