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

The seed script `seed/seed.py` builds all three sources from one clean
list and applies the planted faults, so the key is exact by construction.

## Report format the model is told to use

- Summary, three sentences or fewer.
- Findings, one per discrepancy, with counts and example ids.
- Conclusion, one sentence.
- Recommended action, with an owner and a deadline.

## Success

All three rubric scores pass, see `GRADING.md`, and no failure rule fired.
