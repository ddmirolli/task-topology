# Transcript review records

`review.mjs` packages the full session, CLI events, task, and independent app result
for an operator review. It validates seven rule decisions against exact source
lines and quotes. It does not interpret arbitrary shell code or establish that a
reviewer's verdict is true.

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
