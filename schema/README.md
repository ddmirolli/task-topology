# Data model status

The version 0.11 scoring and access rulings supersede the original aggregate formulas.
The public submission service and validated aggregate publisher are not built.
The candidate efficiency calculator is implemented but remains unpublished.
No result has been published using these schemas.

## Run records

`run.schema.json` version 2 is a draft record of the model, harness, exact task,
usage, timing, and transcript. Server grading must ignore submitter scores.
The `task.target_hours` field is a legacy design estimate. It must not be
used as measured runtime, credited work, or evidence of a trust boundary.

Version 2 adds free-form execution provenance. Prices and tokens are optional
and nullable. Timing can be unavailable. Access method and model identifiers
have no allowlist. Missing telemetry limits metrics, not benchmark entry.
Actual charges and normalized estimates are different cost bases.

External local runs use `mtb-external-run/1`. The grader recomputes task success
from the returned app. Receipt identity, timing, usage, and cost remain
unverified. Reported speed is diagnostic until its evidence is checked.

The API pilot uses a separate `mtb-pilot-run/1` record, documented in
[pilot/README.md](../pilot/README.md). It records fixed task fingerprints,
provider IDs, usage, elapsed time, failure outcomes, and API-list-price or unavailable
cost. Its enclosing plan supplies dated prices. It is not a public submission
schema and does not support automatic exclusions. Do not infer missing costs.

## Retired aggregate schema

`aggregate.schema.json` describes the historical version 0.8 proposal and
is marked deprecated. Its `p_window`, `hours_at_90`, `hours_at_95`,
`task_hours`, `successful_hours_per_usd`, and `mtb` fields must not be used
to produce current scores. The old cube-root formula omits speed, and the
elapsed-time formula does not establish a trusted workload boundary.

A replacement aggregate schema follows validation of workload calibration
and a Z formula that satisfies the approved speed rule. Until then,
publish no X or MTB values. The pilot reports observations in a table:

- Model and provider settings, harness version, exact task set and grader.
- Attempt counts and per-ticket outcomes, including timeouts and exclusions.
- Correct work units fixed before runs, never derived from elapsed time.
- Total elapsed attempt hours and total attempt cost, including failures.
- Speed: correct work units divided by elapsed attempt hours.
- Cost efficiency: correct work units divided by attempt cost in USD.
- Transcript and grading evidence behind each row.

Compare only matched task mixes with equal repetitions. Missing or
nonpositive time or cost denominators make the corresponding metric
unavailable. Report excluded infrastructure spend separately and retain it
in the budget. See [PILOT.md](../PILOT.md) for the trial and [SPEC.md](../SPEC.md)
for the approved rules.

## Typed platform contract

`core/topography.ts` defines model configurations, three-axis points, and the
website-to-renderer interface. `core/efficiency.ts` computes an unpublished Z
candidate from a complete operator-supplied plan and adjudicated attempts.
This does not replace the historical run schemas or authenticate submitted data.
Public JSON still requires runtime validation before these types are trusted.

## Record versions

Current record identifiers use the `mtb` namespace. Archived diagnostic receipts
retain their original bytes, versions, and hashes. Replay archived inputs with
the source revision recorded in their evidence; do not rename their identifiers
in place or relabel them as new benchmark runs. Fresh task exports receive fresh
fingerprints, including the current fixture metadata.
