# Subscription validation, 2026-09-18

The third diagnostic cohort completed all 18 planned attempts through existing
subscription access. Seventeen submitted apps passed the independent task checks.
This batch does not establish full benchmark success or a model ranking.

The plan used tickets 01, 04, and 07, with three fresh attempts per model.
Both requested models used Codex CLI 0.155.1 at medium effort. Model order
alternated, and no attempt was retried. The execution snapshot was commit
`4ae841317cf393e012bf53e7022d7c914737aee5`.

## App results and recorded resources

Each row includes every attempt for that model and ticket, including failures.
Seconds measure client execution and tool use. Setup and independent grading
are excluded. Costs below are API-equivalent token estimates, not subscription charges.

| Ticket | Requested model | App checks passed | Total seconds | API-equivalent estimate |
|---|---|---:|---:|---:|
| 01 | gpt-5.6-luna | 3 / 3 | 131.18 | $0.0281 |
| 01 | gpt-5.6-terra | 2 / 3 | 102.75 | $0.2124 |
| 04 | gpt-5.6-luna | 3 / 3 | 195.46 | $0.0382 |
| 04 | gpt-5.6-terra | 3 / 3 | 210.19 | $0.3255 |
| 07 | gpt-5.6-luna | 3 / 3 | 185.06 | $0.0355 |
| 07 | gpt-5.6-terra | 3 / 3 | 198.75 | $0.3207 |

Every estimate reconciles the retained per-request usage with the terminal totals.
The [dated price evidence](pilot/price-evidence.json) supplies the rates and context limit.
Exact backend model snapshots and actual subscription charges remain unverified.
No API inference runner was dispatched.

## Findings that prevent benchmark rates

- Attempt 01 passed the app checks but encountered a native patch approval rejection.
  The runner declared `/var/...`, while the shell reported `/private/var/...` for
  the same directory. The source checker missed the rejection wording.
- Attempt 02 claimed accessible buttons, but the dark-theme contrast was 2.28:1
  against the declared 4.5:1 requirement. The visible test suite still passed.
- Attempt 10 passed the app checks but tried to create a temporary database
  outside its workspace. The sandbox blocked it. Instruction and scope grading
  must consider that attempted operation.

The corrected source checker was applied equally to all 18 retained sessions.
Only attempt 01 changed under that correction. Original receipts remain unchanged.
The report withholds cohort throughput and cost-efficiency rates when execution
evidence requires review. X, TTI, and full seven-rule success remain unavailable.

## Runner corrections and verification

The runner now uses the canonical workspace path for the client and its tools.
A focused canary verified an edit using that exact absolute path in 15.822 seconds.
Its session contained one task prompt, no personal instructions, no skill catalog,
and no rejected native patch. Outside reads and dependency writes remained blocked.
That canary is excluded from the cohort.

All 25 local tests passed with the installed CLI probe enabled. The 10 non-browser
fixture verdicts also matched expectations. The cohort supplied six real Browserbase
UI grades. Raw sessions, returned apps, receipts, and review notes remain local.

Two earlier cohorts remain separate: one stopped after 12 attempts because its
MCP-only contract did not declare native edits; another stopped after four because
a malformed patch was mistaken for a permission rejection. Neither is pooled here.

The next comparison needs a frozen transcript grader and its required human audit.
The full 18-attempt plan has not been rerun after the canonical-path correction.
Public rankings and the submission service remain deferred.
