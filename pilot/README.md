# Run the validation pilot

This runner covers Tier 1 tickets 01, 04, and 07 on macOS with Node.js 22 or
newer. Tasks can be exported to any execution client. An optional adapter
uses an isolated shell and the OpenAI Responses API. Firstmate is
a design reference only. It is not installed, executed, or required.

## Verify before spending

Install the locked dependencies from the repo root:

```sh
npm ci --prefix tasks/tier-1-entry/app
npm ci --prefix pilot
npm run test:pilot
npm run verify:pilot
```

The first command group runs local tests without benchmark model calls.
`verify:pilot` checks ten fixtures for customer deletion and dates.

To include the six button fixtures, supply Browserbase credentials through
your authorized secret provider and run:

```sh
npm run verify:pilot:browser
```

Set `BROWSERBASE_API_KEY` and `BROWSERBASE_PROJECT_ID` in the invoking process.
Set `TTI_RECEIPT` to a private file path to save the fixture verdicts and the
Browserbase session ID. The browser runs remotely. A request proxy serves
responses from the isolated local app. This checks rendering and interaction;
it does not test deployment or public network reachability.

The suite accepts two distinct valid implementations per task. It also rejects
the original defect and at least two partial fixes. The alternative CSS fix changes
selectors and assertion syntax. The alternative deletion uses soft deletion.
The alternative date fix leaves the original date helper unused.

## Use any model or execution client

Export a task without supplying a model name, API key, or prices:

```sh
node pilot/external.mjs export 07 /private/path/new-packet
```

Keep the packet unchanged. Give the tested client a copy of `task/` only.
It contains the task instructions, ticket, and starting app. Keep
`manifest.json` with the operator. Install locked app dependencies before
timing starts. Run the task in a separate environment that cannot read this
repository, the answers, or the grader. The export command packages files;
it does not isolate or launch an external client.

Use any supported client authentication, including subscription access.
There is no model, vendor, client, or billing allowlist. The client owns
its login and model access. Keep credentials outside task files and receipts.
The operator owns execution limits, tool configuration, isolation, timing,
and transcript capture. Record those settings in `execution`. Compare runs
only when those conditions match. Existing provider terms and quotas apply.

Start timing when the client receives the task. Stop at final submission or
the declared timeout. Stop all task processes before collecting the app.
Record failures too. Save the transcript and available evidence in a receipt:

```json
{
  "version": "tti-external-receipt/1",
  "runId": "copy from manifest.json",
  "taskHash": "copy from manifest.json",
  "model": { "id": "reported model ID", "vendor": "reported vendor" },
  "execution": {
    "method": "your access method",
    "client": "your execution client",
    "version": "exact client version",
    "billing": "your payment method",
    "settings": {},
    "limits": {},
    "isolation": "describe the execution environment"
  },
  "status": "submitted",
  "elapsedSeconds": null,
  "transcript": "complete captured task exchange",
  "usage": null,
  "cost": null
}
```

Use `timeout`, `provider_error`, or `cancelled` for those outcomes. Record
unavailable identity as `unknown`. Optional `usage` and `cost` preserve
client evidence without converting it into verified accounting. Elapsed time
can be null. A monthly subscription payment is not a measured per-task cost.

Grade the returned app independently:

```sh
node pilot/external.mjs grade /private/path/new-packet /private/path/submitted-app /private/path/receipt.json /private/path/new-result
```

Ticket 01 needs the Browserbase credentials described above. The command saves
the app snapshot, original receipt, grader fingerprints, and `run.json`.
It checks the published task and starting app, then runs the same behavioral
grader used by the API adapter. It ignores any score supplied in the receipt.
It neither calls a benchmark model nor requires a paid plan.

External records use `tti-external-run/1`. Task success is independently graded.
Identity, isolation, time, and usage remain submitter-reported until evidence
review. `comparisonEligible` stays false, and any speed value is diagnostic.
Unknown cost stays null without blocking task grading. Cost estimates and
actual charges must be verified separately before cost scoring. The local
importer does not yet promote external evidence into verified rankings.

## Review the paid proposal

```sh
node pilot/cli.mjs plan
```

The optional `proposal.json` example proposes Luna and Terra at medium effort, with three attempts
per model per ticket. The 18 attempts have a $40 model API cap. The conservative
reservation for all calls is $38.016 at the recorded prices. Browserbase service
usage is separate. The proposal remains unapproved until Dan approves it.

Every attempt has these limits:

- 15 minutes, including token counting, model calls, tools, and in-session tests.
- 30 model calls, with at most 32,000 input and 4,000 output tokens per call.
- 30 seconds and 32 KiB of output per command.
- $4 reserved API spend per attempt, within the trial cap.

The runner reserves the maximum charge before each model call. It retains that
reservation after failures and successful calls. Cache reads, cache writes,
ordinary input, and output have separate prices. Missing usage makes API-list-price
cost unavailable and stops this paid adapter to contain uncertain spending. It never becomes zero-cost work.

Confirm current prices and account access before approval. The adapter has
mock-response coverage; live API behavior still needs the first approved trial.
The plan pins dated price evidence by hash and must use its exact rates.
Set `priceEvidenceFile` to a path relative to the plan to supply another
price record with `source`, `date`, `retrievedAt`, and `rates` keyed by model ID.
Model IDs, effort settings, model count, and repetitions are configurable.
The adapter still speaks OpenAI Responses; its protocol and spending checks
are adapter constraints. Other clients use the external workflow above.
Paid dispatch refuses evidence retrieved more than 48 hours earlier. Refresh
the evidence before proceeding. If prices or limits change, obtain approval
for the revised budget.
The model aliases can change. Each response's returned model ID is recorded.
A returned ID that differs from the requested ID stops the batch with unknown
cost. A new alias mapping needs review before a further attempt.

## Execute an approved trial

After Dan approves the model choices and cap, record `approved: true` in a
copy of the proposal. Inject `OPENAI_API_KEY` and the Browserbase variables
through your authorized secret provider. Keep results outside this repository.

```sh
node pilot/cli.mjs run /private/path/approved-plan.json /private/path/new-trial
```

The destination must not exist. Attempts run sequentially in alternating model
order. Every request reservation is journaled before dispatch. Each attempt
records the prompt, settings, file hashes, tool exchanges, provider IDs, usage,
elapsed time, and submitted files. Grading starts after the attempt clock stops.

The runner stops on provider, accounting, or runner errors. Browser errors stop
the batch and retain earlier records. Do not restart into another directory to
hide failures. There is no automatic retry, resume, exclusion, upload, or model
routing. Reconcile an interrupted trial's request journal before authorizing
more spend.

## Interpret the records

`run.json` uses `tti-pilot-run/1`. `events.jsonl` is the append-only request and
tool journal. `plan.json` contains the dated price source and rates.
`results.json` groups outcomes by model within this fixed API client.
API costs are calculated from provider usage and list prices, not invoice
receipts. Failed attempts count toward time and cost. Compare aggregates only
after every model completes the same task mix.
Partial trial summaries are diagnostic, not rankings.

The records report functional task success, limits, and raw evidence. They do
not implement the full seven-part transcript rubric in GRADING.md. Human review
must resolve scope or instruction questions before these results support any
broader claim. X and TTI remain unavailable. Eighteen attempts do not establish
90 percent reliability.

The task version combines the original ticket with the public contract under
`contracts/`. The API adapter also fingerprints its tool instructions.
Those clarifications are visible to every tested model and included in the
fingerprint. They are not comparable to runs given only the original ticket.

## API adapter isolation limits

The model receives an app copy and read-only locked dependencies. macOS
`sandbox-exec` denies access to answer keys, repository history, host data,
other process environments, and network connections outside one allocated
loopback port. The parent performs API calls and owns records and grading.
Submitted app code runs in a separate sandboxed process during grading.

The runner checks file isolation before every attempt and has no unrestricted
fallback. Linux support is pending. This private pilot is not a public service
for hostile submissions. Its process controls do not establish VM-level
containment or comprehensive resistance to resource exhaustion.

## References

- [Firstmate dispatch resolver](https://github.com/kunchenguid/firstmate/blob/daaffdb5116e264ca1e3b6bd2e0839a88adf5231/bin/fm-dispatch-resolve.sh): explicit model settings, deterministic decisions, and visible failure outcomes.
- [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling): function call and output protocol.
- [OpenAI token counting](https://developers.openai.com/api/docs/guides/token-counting): preflight input counts.
- [OpenAI prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching): disjoint usage categories.
- [OpenAI pricing](https://developers.openai.com/api/docs/pricing): rates captured on 2026-09-18.

## Run through an existing Codex subscription

The optional Codex adapter uses the same exported task and grader. It is one
client implementation of the open entry workflow. Other clients can use the
external receipt interface without adopting Codex.

Read account metadata and confirm the included allowance:

```sh
node pilot/codex-account.mjs /private/path/account-check.json
```

Run one task with any model ID your Codex client supports:

```sh
node pilot/codex.mjs 07 MODEL_ID /private/path/new-attempt
```

The adapter uses the existing ChatGPT login. It refuses API-key authentication,
unknown allowance, available or unknown purchased credits, and general usage at or above 90 percent. It does not buy
credits, consume reset credits, or fall back to the API. The model catalog is
recorded for diagnosis, not used as a benchmark allowlist.

Each attempt records its launch configuration, prompt, CLI JSON events,
terminal usage, the full timestamped session record, and elapsed time from the
parent monotonic clock. Full session records include rejected calls omitted
from the CLI event stream. Each run has isolated HOME and CODEX_HOME directories. An auth-file symlink
reuses the existing login without copying credentials into the app. Memory
input and generation are disabled. The adapter copies the client session log
into private attempt evidence, verifies its thread identity, and removes the
temporary client directory. Bundled skill catalogs are disabled explicitly. The clock
includes client startup and tools. Account checks, dependency setup, sandbox
probes, and post-submission grading remain outside the measured interval.
Backend snapshot identity remains unverified when the CLI does not expose it.

A restrictive Codex permission profile protects host files and dependencies.
The client and tools receive the same canonical workspace path.
The four TTI MCP tools use the existing sandbox for app work and HTTP tests.
Only that local MCP server has pre-approved tools. Native patch edits are also
allowed inside the app workspace and recorded with their paths. Native shell execution,
plugins, memories, desktop automation, browsing, and host skill discovery are disabled
for the tested client. Full-session checks reject extra user instructions,
skill catalogs, and recognized native patch permission rejections. Malformed
patches and failed context matches remain ordinary timed tool errors. Native edits
without a completed event also invalidate the run. Arbitrary JavaScript tool
orchestration still needs transcript review; these checks are not the full rubric. Failed MCP transport, native shell or web tools, edits outside the app, and an
absent terminal event prevent a successful runner outcome. This adapter is
still a private macOS pilot, not containment for hostile public submissions.

Run the configurable matched pilot after installing the locked dependencies
and supplying the Browserbase credentials described above:

```sh
node pilot/subscription-trial.mjs pilot/subscription-plan.json /private/path/new-trial
```

The example plan selects two models and 18 attempts. The runner freezes its
files, task text, and starting app, alternates model order, checks allowance before each attempt, preserves
all outcomes, and stops on client or grading errors. It has no automatic
retry or model substitution. Diagnostic canaries are separate from this plan.

Subscription receipts retain cost as unavailable. CLI aggregate usage alone does not
establish per-call context sizes needed to select API price bands. Full session
records can supply per-request usage. The report estimates API-equivalent token
cost only when those records have unique response IDs, match the source thread,
reconcile to every terminal token category, and fit the captured short-context
price band. Missing evidence or long-context requests leave cost unavailable.
These estimates are not subscription charges. External submissions remain unverified;
this controlled adapter adds its own timing evidence without promoting model
identity or the unfinished transcript rubric into verified rankings.

## Inspect a retained subscription trial

```sh
node scripts/summarize-pilot.mjs /private/path/trial /private/path/trial/price-evidence.json /private/path/report
```

The report binds the plan, frozen runner, price file, run IDs, task baselines,
and client settings to the retained evidence. It keeps missing, invalid, and
unstarted attempts visible. The report distinguishes app-check outcomes from execution validity. Rates
remain unavailable when a planned batch stops early. All failed attempts retain their time and usage.
No output from this script establishes full-rubric success, X, or TTI.
Execution evidence that fails review also withholds cohort throughput and
cost-efficiency rates. Analysis file hashes distinguish corrected source checks
from the original frozen runner. Original receipts are not overwritten.

Supply a review-holds JSON file as the optional fourth argument when transcript
review finds an execution concern. Each hold keeps the app result and measurements
but removes candidate credit. The report checks each hold against its run ID and
the SHA-256 of the complete receipt file, and records the review file's hash.

```json
{
  "version": "tti-review-holds/1",
  "holds": [
    {
      "attempt": 1,
      "runId": "the-receipt-run-id",
      "receiptHash": "sha256-of-receipt-json-bytes",
      "reason": "The blocked outside-workspace command requires scope review."
    }
  ]
}
```

The first matched subscription trial stopped at attempt 12 because the CLI
exposed its native patch tool despite the intended MCP-only contract. The app
passed, but the attempt remains invalid under that frozen contract. This
revision declares native workspace patching explicitly and removes injected
personal instructions through an isolated client home. Start a new matched
trial when changing that setting. Never resume or reinterpret the old trial.

The installed-client sandbox check is optional and makes no inference call:

```sh
TTI_TEST_CODEX=1 npm run test:pilot
```
