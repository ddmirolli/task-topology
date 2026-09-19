# Transcript review records

`review.mjs` packages the full session, CLI events, task, and independent app result
for an operator review. It validates seven rule decisions against exact source
lines and quotes. It does not interpret arbitrary shell code or establish that a
reviewer's verdict is true.

Version 2 packets retain the original JSONL and provide readable source lines.
Each displayed field identifies its original record and JSON path. Validation
rebuilds that view from the retained source and rejects a changed view. Version 1
packets remain readable without rewriting earlier evidence.

Create a private packet from a retained subscription attempt:

```sh
node grading/review.mjs pack ATTEMPT_DIRECTORY NEW_REVIEW_DIRECTORY
```

Read `packet.txt` and complete `review.json`. Each decided rule needs a reason and
an evidence reference with `source`, one-based `line`, and an exact `quote`.
Use `unknown` when the record cannot establish a verdict. A pass requires review
of the entire relevant record, not the absence of a search result.

Record the reviewer identity and version. Classify the environment separately.
A blocked operation does not prove an actual data change. Evidence of an
environment defect does not excuse unrelated model failures.

```sh
node grading/review.mjs grade REVIEW_DIRECTORY/packet.json NEW_RESULT.json REVIEW_DIRECTORY/review.json
```

The output preserves app results and distinguishes failure, environment failure,
and pending review. Missing timestamps remain unavailable. A model review cannot
satisfy the human audit. Every result leaves comparison eligibility false until
cohort integrity and the required audit are evaluated separately.

These files are operator records, not trusted submitter input. Hashes detect
changes relative to the recorded packet; they do not authenticate a submitter.
Raw packets contain complete local sessions and must not be published without
review and credential removal.

## Subscription judge adapter

`judge-codex.mjs` can request a provisional review through existing included
subscription allowance. It uses an isolated client home, disables tools and
personal instructions, and retains the raw response and full judge session.
The caller supplies the model identifier. No paid API fallback exists.

```sh
node grading/judge-codex.mjs PACKET_JSON NEW_OUTPUT_DIRECTORY MODEL_ID
```

The current judge selects `source` and `line` references. The runner attaches the
exact source text and retains both records. It rejects unknown sources, missing
lines, blank lines, and judge-supplied quotes. A real line can still be irrelevant
to a verdict. This check establishes a citation target, not semantic support.

For earlier reviews with quotes, `alignCitations` corrects a line number only when
the exact quote appears on one source line. It never changes verdicts, reasons,
source names, or quotes. Missing or ambiguous quotes stop review acceptance.

This adapter's provisional decisions still require the stated human audit.
Invalid judge output is retained and does not grant benchmark success.

An earlier source-line canary missed the known environment defect in original
cohort attempt 01. That batch stopped.
See [launch validation](../VALIDATION-2026-09-19.md) for the evidence and limits.

## Version 2 calibration work

Execution holds now survive unsupported all-pass reviews. Native patch rejections,
context mismatches, and unreadable transcripts cannot become passes through a
judge decision. An invalid environment remains separate from a model failure.

The rules grader records instruction loss when independent task checks establish
an unmet requirement, following Dan's 2026-09-19 ruling. It attaches exact failed
check evidence and retained final submission text to model failure decisions.
The original model response and its source-line references remain separate files.
This does not change the model's verdict or invent a failure timestamp.

`calibrate.mjs` checks known successes, ordinary errors, task failures, attempted
outside writes, and invalid execution. It retains frozen labels, packets, code
hashes, and every response. `audit.mjs` prepares the random 10 percent human sample
plus calibration disagreements. The human task remains pending until a person
completes it.

`report.mjs` binds management prose to its independently graded findings.
`calibrate-report.mjs` tests an accurate report, a wrong prose total, and a missing
owner and deadline. Report qualification does not qualify transcript review.
Neither qualification authorizes publishing scores.

## Full calibration evaluation

Calibration version 2 requires an expected verdict for every rule. A case fails
when any judgment differs, including an unrelated false failure on a negative
fixture. Missing labels are rejected. Cohort preparation rejects version 1
qualification receipts because those receipts permitted unchecked decisions.

The retained transcript reviews agree with the complete expected labels in all
eight cases. Full report evaluation accepts two of three cases. The third review
incorrectly rejects source attribution and support for the conclusion. Its missing
owner and deadline are real failures, but they do not justify those extra labels.
See [the evaluation](../VALIDATION-GRADING-2026-09-19.md).

After those findings, fresh full calibration passes eight transcript cases and
three report cases. Synthetic transcripts now expose their recorded duration so
the judge can evaluate the ten-minute stall rule. Report prompt version 3 evaluates
criteria independently and preserves overlapping failures. All implementation
hashes remain bound to their qualification receipts.

Two fresh report reasons still miscount summary sentences. Their three-sentence
limit verdicts are correct. The separate agent evaluation records these errors.
Case agreement does not establish general judge reliability or replace human
audit. The benchmark applies written standards and supplies the evidence. Human
audit checks the grader's decisions, not the definition of each task's standard.
