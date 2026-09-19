# Private submission workflow

The local intake accepts model evidence without a model catalog or payment-method
allowlist. It retains unknown timing and cost. Submitted grades and trust labels
are discarded. This is an operator CLI, not an internet-facing upload service.

First run `npm ci` and `npm run build:core` at the repository root. The existing
profile import now forwards to compiled strict TypeScript.

Register a task exported by `pilot/external.mjs`:

```sh
node benchmark/cli.mjs register PRIVATE_STORE TASK_PACKET
node benchmark/cli.mjs submit PRIVATE_STORE SUBMISSION_JSON
```

The submission format is `mtb-submission/1`. Supply a stable `attemptId`, registered
`taskHash`, `model.id`, `model.vendor`, raw `transcript`, and a `files` object mapping
relative app paths to UTF-8 text. Record `status` as submitted, timeout, provider_error,
cancelled, or invalid_execution. `elapsedSeconds`, `usage`, and `cost` are optional.
The current text-only adapter has an 8 MB envelope limit and a 4 MB app limit.

Supply an execution profile with version `mtb-execution-profile/1`. It records task
set, grader, tool contract, and environment hashes; client and version; access
method; memory, compaction, retry, and timing policies; tools; provider settings;
and attempt, command, and output limits. These are declared claims until verified.
Profile hashes keep different configurations separate. Matching hashes alone do
not prove that two models ran under those conditions.

The operator grades queued app code inside the existing macOS sandbox:

```sh
node benchmark/cli.mjs grade PRIVATE_STORE INTAKE_ID TASK_PACKET NEW_GRADING_DIRECTORY
```

Ticket 01 also needs the authorized Browserbase connection. Grading output records
the intake hash. Original submissions remain unchanged. Regrading uses a new
output directory. App checks do not satisfy transcript review or human audit.

The store retains private raw evidence. Hashes establish local integrity, not
submitter authenticity. Public operation still needs authentication, rate and
storage limits, durable job processing, credential review, and isolated workers.
This CLI does not upload records or expose submitted code to the host shell.

## External intelligence snapshots

`python3 benchmark/intelligence.py NEW_DIRECTORY` imports the official
[Epoch ECI CSV](https://epoch.ai/data/eci_scores.csv). It preserves the raw file,
its SHA-256, fetch time, available source headers, score intervals, source names,
and source version information. Empty datasets, changed columns, duplicate model
names, and nonfinite scores stop the import.

The snapshot does not infer a mapping from a model's marketing name to a tested
client identifier. Model identity mapping remains pending. The current site offers
the snapshot as a separate download with Epoch attribution and its
[CC BY 4.0 license](https://creativecommons.org/licenses/by/4.0/).

Artificial Analysis remains a separate prospective source. Its intelligence index
must not substitute for ECI on the same numerical axis. No recurring import or
automatic source update is enabled.
