# Launch validation, 2026-09-19

The diagnostic explorer is live at https://task-topology.vercel.app.
It displays the original 18 attempts. Full benchmark scores remain unavailable.
The new management task, intake, and external data import are partial launch
components. They do not establish a complete hosted benchmark.

## Hosted explorer

Vercel deployment `dpl_8MP3ZZH7RndDeAygs882XQFm16Gf` serves the static site from
commit `724a2790aaa317f77a4763cd7a42c421786e6905`.
Browserbase session `0c14ad01-9443-4d32-bfeb-2f2dfacd49c8` checked the public alias.
The browser fetched six assets and matched their SHA-256 hashes to the local
commit. Filters, tier states, sorting, and mobile overflow checks passed.
Desktop and mobile screenshots were inspected in light and dark modes.

The reproducible verifier is `scripts/verify-site.mjs`. Its private result and
screenshots are in `/tmp/tti-site-final-qa`. The site exposes aggregate diagnostics
and the attributed Epoch snapshot. It does not expose raw model sessions or an
upload service.

The custom domain is attached to Vercel. Cloudflare DNS remains unconfigured.
Vercel supplied the apex A target `76.76.21.21`. No DNS records were changed.

## Component verification

At commit `724a2790aaa317f77a4763cd7a42c421786e6905`, all four CI checks passed.
Local verification passed 25 pilot tests, 10 launch tests, seven management tests,
and two intelligence-import tests. Later source-line review changes add three
launch tests. The test commands are:

```sh
TTI_TEST_CODEX=1 npm run test:pilot
npm run test:launch
python3 -m unittest discover -s tasks/tier-2-management/tools -p 'test_*.py'
python3 -m unittest discover -s benchmark -p 'test_*.py'
```

The launch CI also exercised PostgreSQL in a disposable database. The current
synthetic credential worked. The stale credential and write attempts failed.
The independent reconciliation passed and preserved source data.

The local intake test submitted app files, independently graded them inside the
sandbox, and bound the grading record to the original intake. A valid alternative
passed. Broken app code and altered intake records failed.

## Judge calibration

These are judge development canaries, not new benchmark attempts. They used the
existing subscription allowance. No API inference runner was dispatched.

| Canary | Observed result | Disposition |
|---|---|---|
| Luna, first prompt, original attempt 02 | Invalid evidence-reference shape | Rejected |
| Luna, schema-constrained prompt, original attempt 02 | Exact quote with wrong line number | Unique literal alignment produced a provisional failure; human audit pending |
| Luna cohort batch, original attempt 01 | Missing or ambiguous quote | Batch stopped before its first accepted review |
| Terra, original attempt 01 | Escaped-text and ambiguous-quote mismatches | Rejected |
| Luna, readable evidence, original attempt 01 | Added quotation marks and incorrect snippets | Rejected |
| Luna, source-line selection, original attempt 01 | References attached successfully; judge called the environment valid | Failed semantic calibration |

The final canary's citation records contain real source lines, but several lines
do not support their associated reasons. The judge also missed the known native
permission rejection caused by macOS path aliases. Its provisional pass does not
clear the original execution hold. The full cohort was not judged with this
adapter. No validated success rate, X, or TTI follows from these canaries.

Private evidence directories retain raw output and, except for the first rejected
canary, the full judge session. The latest records are in
`/tmp/tti-judge-source-lines-01`. The 18 original review packets remain in
`/tmp/tti-cohort-review-v1`. Human audit and a qualified judge remain pending.

## Remaining launch work

`LAUNCH.md` lists every step. The next work includes judge calibration, the
management task's isolated model runner and prose grading, hosted submission
processing, verified model identity mapping, and workload calibration. A public
3D comparison needs validated scores. Executive model runs remain deferred under
the earlier ruling. PR 4 remains open and unmerged.
