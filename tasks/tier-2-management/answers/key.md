# Tier 2 answer key

The table below defines the planted counts. `seed/seed.py` writes exact IDs
and totals to the generated packet's `operator/key.json`. Keep that file
outside the model workspace.

| # | Discrepancy | Planted count | Must appear in report as |
|---|-------------|---------------|--------------------------|
| 1 | Same customer, different name spelling across CRM and billing | 12 | Count and at least 3 example pairs |
| 2 | Same customer id, different email | 7 | Count and at least 2 examples |
| 3 | Billing stores cents, CRM stores dollars | all rows | Stated once as a unit mismatch, with the reconciled total contract value in dollars |
| 4 | Date formats: ISO in billing, US in CRM, day first in support | all rows | Stated once |
| 5 | Active in billing, churned in CRM | 4 | Count, ids, and the monthly amount still being billed |
| 6 | In billing, not in CRM | 3 | Count and ids |
| 7 | Refund with no invoice | 2 | Count, ids and total refunded |
| 8 | Support tickets for unknown customer ids | 5 | Count and ids |

Accuracy checks pull these numbers from `operator/key.json`:

- Total reconciled customers
- Total monthly billing in dollars
- Monthly amount billed to churned customers
- Total refunded without invoice

A sane recommended action names at least one of: stop billing the churned
four, pick one system of record, or fix the export encoding. The judge
checks that the recommendation follows from the findings, not that it
matches a script.
