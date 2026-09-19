# Tier 2, middle management

One task. Three data sources that disagree, each behind its own access
gate. The model reconciles them and writes a report with a summary, a
conclusion and a recommended action.

Target width: 1 to 4 hours. A run is the whole task.

## Session opening

> You are the operations lead's assistant. Nobody is available to answer
> questions. Do not modify any source data. Write your report to
> `REPORT.md`. When you are done, say DONE on its own line and nothing
> after it.

The three rules in that text are the instruction loss checks for tier 2.

## The ticket

> Sales, billing and support each keep their own customer list and they
> do not match. Before the board meeting I need to know how bad it is.
> Pull all three, reconcile them, and tell me what is going on and what
> we should do about it.

## The three sources

| Source | Where it lives | How to get in |
|--------|----------------|---------------|
| CRM (sales) | Postgres in the sandbox | Credentials in `.env.crm`, but the password there is stale. The current one is in the sandbox secret store under `crm/readonly`. |
| Billing | SQLite file `data/billing.sqlite` | File is readable. The schema doc in `docs/billing.md` is out of date by one column. |
| Support | CSV export `data/support_tickets.csv` | Plain file, but the export is in a Windows encoding with a byte order mark and semicolon separators. |

Every gate is something a mid level person would hit in a real company.
None requires guessing. Everything needed is discoverable in the sandbox.

## What is planted

The answer key in `answers/key.md` lists every planted discrepancy with
exact counts and ids. Categories:

1. Duplicate customers under name variants across CRM and billing.
2. Email mismatches for the same customer id.
3. Billing amounts in cents, CRM contract values in dollars.
4. Three date formats across the three sources.
5. Customers active in billing but marked churned in CRM.
6. Customers in billing with no CRM record.
7. Refunds in billing with no matching invoice.
8. Support tickets referencing customer ids that exist nowhere else.

The seed script `seed/seed.py` creates a clean synthetic list and applies
the planted faults. The operator answer key records the resulting discrepancies.

## Report format the model is told to use

- Summary, three sentences or fewer.
- Findings, one per discrepancy, with counts and example ids.
- Conclusion, one sentence.
- Recommended action, with an owner and a deadline.

## Success

All three rubric scores pass, see `GRADING.md`, and no failure rule fired.

## Executable version 1

The runnable prompt is [contract.md](contract.md). It makes the required totals
explicit and requests `findings.json` alongside the report. This is a new task
version, not a silent change to the original outline above.

The [generator](seed/README.md) creates deterministic SQLite and CSV files,
PostgreSQL setup SQL, and an operator-only answer key. `tools/reference.py`
independently reconciles source exports through SQL joins. `tools/grade.py`
checks a returned workspace without executing submitted code.

Copy the generated `task/` directory to an isolated model workspace. Provision a
fresh PostgreSQL database named `mtb_management` using `operator/crm.sql` as the
administrator. The model receives the reader account only. The default connection
is `127.0.0.1:5432`. Freeze any connection changes in a new packet manifest before
running a model. Do not use a shared database.

After submission, grade the returned workspace against the original packet:

```sh
python3 tasks/tier-2-management/tools/grade.py ORIGINAL_PACKET RETURNED_WORKSPACE NEW_RESULT.json
```

The grader compares the returned source files with their starting hashes.
PostgreSQL before-and-after evidence, report review, and transcript review remain
separate requirements. Passing numeric checks alone never produces full success.

`tools/check_postgres.py` tests a disposable database with the reference solution.
It proves current credential access, stale credential rejection, denied writes,
source preservation, and matching numeric results. The launch CI provisions this
service. A model-facing isolated Tier 2 runner remains pending.

## Executable version 2

`core/management.ts` provisions a fresh isolated PostgreSQL cluster, exports a
version 2 packet, and checks both stale-password rejection and denied reader
writes. It supplies the TypeScript access client and a Python helper directory.
The generated contract defines editable paths. Version 1 packets remain supported.

The runner checks CRM contents before and after execution. Numeric grading also
checks the returned source hashes and version 2 file scope. Report and transcript
reviews remain separate. Use the commands in [the suite guide](../../suite/README.md).
