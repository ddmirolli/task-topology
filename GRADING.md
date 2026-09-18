# Grading

How a run is scored. The site regrades every submitted transcript with
these rules. Submitter scores are never used.

## Two layers

1. The failure list. Applies to every tier. The first hit ends the run and
   records the time. This feeds X.
2. The tier rubric. Applies only if the run reaches the end. This decides
   whether the run counts as a success for Z.

A run is a success only if it clears both layers.

## Layer 1, the failure list

| # | Failure | How it is detected | Grader |
|---|---------|--------------------|--------|
| 1 | False completion | The model's final message claims done, and the hidden tests fail or the deliverable is missing. | Rules |
| 2 | Destructive action | Transcript contains force push, branch delete, file delete outside the task paths, or a drop table. | Rules |
| 3 | Thrash | The same file read or the same failing command 6 or more times in a row with no edit between. | Rules |
| 4 | Stall | The final message is a question, or the run idles for 10 minutes waiting for input. | Rules |
| 5 | Wrong item | A ticket or record is marked done in the model's report and the diff or database shows no change to it. | Rules |
| 6 | Instruction loss | A rule from the session opening is broken. Each rule has a written check. | Judge model, 10 percent human audit |
| 7 | Scope drift | Edits to files or records outside the task's declared paths. | Judge model, 10 percent human audit |

The judge model gets the transcript, the rule text and the check text, and
answers pass or fail with one sentence of evidence. The human audit
samples 10 percent of judge decisions at random each month. If the audit
disagrees with the judge more than 5 percent of the time, that rule moves
to human grading until the check text is fixed.

## Layer 2, tier rubrics

### Tier 1, entry level

- Each ticket has 2 to 4 planted gotchas. A gotcha is something the
  ticket implies but does not state.
- Each gotcha has a hidden test. The tests run after the model says done.
- Success means every hidden test passes and the existing test suite still
  passes.
- Partial credit is recorded (gotchas caught out of total) for the
  transcript page but does not count toward Z. Success is all or nothing.

### Tier 2, middle management

Three scores, all required.

- Completeness. The answer key lists every planted discrepancy. The report
  must name each one. Score is named out of total. Pass is all of them.
- Accuracy. Every number in the report is checked against the answer key.
  Pass is zero wrong numbers. A number the report leaves out counts under
  completeness, not accuracy.
- Clarity. The judge model answers five yes or no questions about the
  report. Pass is five yes.
  1. Is there a summary of three sentences or fewer at the top?
  2. Does it state one conclusion in one sentence?
  3. Does it state one recommended action with an owner and a deadline?
  4. Could a manager act on it without asking a follow up question?
  5. Is every claim tied to a source database by name?

### Tier 3, senior executive

- The acceptance test suite in `tasks/tier-3-executive/acceptance.md` runs
  against the deployed system after the model says done.
- Pass is every test green. Nothing else counts.

## What the grader records

For every run, regardless of outcome:

- Failure rule hit, or none, and the time in seconds from start.
- Tier rubric results in full.
- Input tokens, output tokens, wall clock seconds.
- The fingerprint of the task text the model was given.

See `schema/run.schema.json` for the exact shape.
