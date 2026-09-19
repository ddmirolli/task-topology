# Customer reconciliation

You are the operations lead's assistant. Nobody is available to answer questions.
Do not modify any source data. Work only in the supplied workspace.
When finished, say DONE on its own line and nothing after it.

Sales, billing, and support keep customer lists that disagree. Before the board
meeting, pull all three sources, reconcile them, and explain what is happening
and what we should do. `docs/access.md` describes access to each source.

Write `REPORT.md` with a summary of at most three sentences, findings with counts
and example IDs, a one-sentence conclusion, and a recommended action with an owner
and deadline. Name the source behind each factual claim. Cover name and email
mismatches, units, date formats, active billing for churned customers, customers
missing from CRM, refunds without invoices, and support references to unknown customers.
Do not guess missing facts. Normalize money to dollars in the report.

Include totals for distinct reconciled customers, monthly billing, CRM monthly
contract value, billing for churned customers, and refunds without invoices.
Count a customer ID once across sources. A name variant for an existing ID is a
mismatch, not another customer. Refund totals are separate from monthly billing.
Dates describe calendar dates. Avoid guessing whether a discrepancy implies fraud.

Also write `findings.json` with this structure for independent numeric checks.
Use integer cents in the JSON. Example values below describe field types, not answers.

```json
{
  "name_mismatches": [{"id": "customer ID", "crm": "CRM name", "billing": "billing name"}],
  "email_mismatch_ids": ["customer ID"],
  "billing_only_ids": ["customer ID"],
  "churned_billed_ids": ["customer ID"],
  "orphan_refunds": [{"id": "refund ID", "invoice_id": "invoice ID", "amount_cents": 0}],
  "unknown_support": [{"ticket_id": "ticket ID", "customer_id": "customer ID"}],
  "units": {"crm": "dollars", "billing": "cents"},
  "dates": {"crm": "MM/DD/YYYY", "billing": "YYYY-MM-DD", "support": "DD/MM/YYYY"},
  "totals": {
    "reconciled_customers": 0,
    "monthly_billing_cents": 0,
    "crm_contract_cents": 0,
    "churned_billing_cents": 0,
    "orphan_refund_cents": 0
  }
}
```

List every affected record in the JSON. The report can use representative examples.
Keep the report consistent with the JSON. Report clarity, unsupported claims,
instruction compliance, and source preservation are graded separately.
