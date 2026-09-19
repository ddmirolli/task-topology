# Execute the three-tier fixture suite

Version `mtb-three-tier/2` combines the existing JavaScript pilot tickets with
Python and Go entry tasks, customer reconciliation, and the executive ticket
system. It preserves the original diagnostic packets and task versions.
Website code is outside this suite.

## Run local verification

The isolated runner requires macOS `sandbox-exec`, Node 22 or later, Go 1.24 or
later, Python 3.12, and PostgreSQL 17 client and server tools. It creates temporary
PostgreSQL clusters with random operator passwords. It never uses a shared
PostgreSQL instance. No model or API call occurs in these commands.

```sh
npm ci
npm ci --prefix tasks/tier-1-entry/app
npm ci --prefix pilot
npm run test:suite
npm run test:launch
npm run verify:suite -- /tmp/mtb-suite-new-evidence
npm run verify:executive -- /tmp/mtb-executive-new-evidence
```

Use a new evidence directory each time. Verification keeps earlier failures.
The full suite checks two valid implementations and two failing implementations
for each new entry task. It verifies management source access and preservation.
Executive checks exercise accounts, ticket operations, search, permissions,
restarts, CSV replay, interrupted import recovery, and 200-ticket load behavior.
The separate negative suite rejects data loss and duplicate imports.

The existing JavaScript fixture commands remain:

```sh
npm run test:tier1
npm run verify:pilot
npm run verify:pilot:browser
```

Browser verification uses Browserbase credentials from the authorized service
account. `node suite/browser.mjs NEW_RESULT.json` checks the executive reference
interface through Browserbase. Requests route to the local HTTPS sandbox.
This verifies the fixture interface, not a public production deployment.

## Run a task through an execution client

`run-codex.mjs` runs new entry and management tasks through existing included
subscription allowance. It checks allowance before inference and has no API or
credit fallback. Use fresh output directories. It rejects executive model tasks.

```sh
node suite/run-codex.mjs entry-python MODEL_ID NEW_PRIVATE_DIRECTORY
node suite/run-codex.mjs entry-go MODEL_ID NEW_PRIVATE_DIRECTORY
node suite/run-codex.mjs management MODEL_ID NEW_PRIVATE_DIRECTORY
```

The adapter records the exact task files, prompt, requested model, client version,
settings, limits, raw events, full session, usage when available, and elapsed time.
Missing cost stays unavailable. Each task uses a fresh client home with personal
instructions, skills, memory, and plugins disabled. Model tools cannot read
operator answers or unrelated files. The management tools can reach only their
fresh CRM port. The database reader cannot change source records.

Other clients can use `mcp-stdio.mjs WORKSPACE CRM_PORT COMMAND_TIMEOUT_MS` for
the same isolated shell tool. Zero disables all task network access. Record their
own execution identity and limits. Do not pool their results with the Codex client.

These entry points collect diagnostic attempts. They never produce a published
score or clear the transcript-review and human-audit requirements.

## Prepare the matched cohort

```sh
npm run prepare:cohort -- NEW_PRIVATE_DIRECTORY
```

The plan contains 24 attempts. Two configurations each receive five entry tasks
and one management task, twice, with alternating configuration order and no
retries. Compare tiers separately. Executive trials stay deferred.

`manifest.json` hashes task files, graders, tools, and runtime code. Freeze it only
after verification. Changing any input requires a new plan. `plan.json` records
all slots before execution and marks readiness held. Transcript and report judge
qualification, human audit, and a fresh allowance preflight are required before a
comparison cohort starts. No new cohort was dispatched during this build.

## Grade and audit

`core/grading.ts` combines execution validity, all seven failure rules, task
checks, judge qualification, and the human-audit state. `core/cohort.ts` feeds
that decision into candidate efficiency arithmetic. Missing or unresolved grading
withholds rates. All published coordinates remain null.

`grading/calibrate.mjs` freezes known success, failure, ordinary-error, and invalid
execution cases before requesting reviews. It also accepts an original diagnostic
archive for checks against attempts 01, 02, and 10. It retains each raw response,
exact source lines, and the frozen implementation hashes.

```sh
node grading/calibrate.mjs NEW_PRIVATE_DIRECTORY JUDGE_MODEL ORIGINAL_ARCHIVE
node grading/audit.mjs CALIBRATION_DIRECTORY NEW_PRIVATE_AUDIT_DIRECTORY
```

A valid citation does not establish a true verdict. Calibration checks expected
verdicts and supporting evidence separately. The audit packet randomly samples
10 percent of decisions and adds every calibration disagreement. An agent cannot
complete the human audit.

Management report packets bind the report and findings to the independent numeric
grade. `grading/report.mjs` checks that binding. The judge adapter's `report` mode
reviews five clarity criteria, numeric agreement, and unsupported claims. Its
result remains provisional until report-specific calibration and human audit pass.
