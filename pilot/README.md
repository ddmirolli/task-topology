# Run the validation pilot

This runner covers Tier 1 tickets 01, 04, and 07 on macOS with Node.js 22 or
newer. It uses an isolated shell and the OpenAI Responses API. Firstmate is
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

## Review the paid proposal

```sh
node pilot/cli.mjs plan
```

`proposal.json` proposes Luna and Terra at medium effort, with three attempts
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
ordinary input, and output have separate prices. Missing usage makes actual
cost unavailable and stops the trial. It never becomes zero-cost work.

Confirm current prices and account access before approval. The adapter has
mock-response coverage; live API behavior still needs the first approved trial.
The plan pins `price-evidence.json` by hash and must use its exact rates.
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
`results.json` groups outcomes by model. Failed attempts count toward time and
cost. Compare aggregates only after both models complete the same task mix.
Partial trial summaries are diagnostic, not rankings.

The records report functional task success, limits, and raw evidence. They do
not implement the full seven-part transcript rubric in GRADING.md. Human review
must resolve scope or instruction questions before these results support any
broader claim. X and TTI remain unavailable. Eighteen attempts do not establish
90 percent reliability.

The task version combines the original ticket with the public contract under
`contracts/`. Those clarifications are visible to both models and included in
the fingerprint. They are not comparable to runs given only the original ticket.

## Isolation limits

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
