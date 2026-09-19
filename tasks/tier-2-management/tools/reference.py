"""Operator-only reference reconciliation using SQL joins over source exports."""
import argparse
import csv
import json
import sqlite3
from decimal import Decimal
from pathlib import Path


def reconcile(task, crm_rows):
    task = Path(task)
    source = sqlite3.connect(f'file:{task / "data/billing.sqlite"}?mode=ro', uri=True)
    db = sqlite3.connect(':memory:')
    source.backup(db); source.close()
    db.row_factory = sqlite3.Row
    db.execute('CREATE TABLE crm (id TEXT PRIMARY KEY, name TEXT, email TEXT, cents INTEGER, status TEXT)')
    for row in crm_rows:
        cents = int(Decimal(str(row['monthly_contract_dollars'])) * 100) if 'monthly_contract_dollars' in row else row['amount_cents']
        db.execute('INSERT INTO crm VALUES (?, ?, ?, ?, ?)', (row['id'], row['name'], row['email'], cents, row['status']))
    db.execute('CREATE TABLE support (ticket_id TEXT, customer_id TEXT)')
    with (task / 'data/support_tickets.csv').open(encoding='utf-16', newline='') as file:
        for row in csv.DictReader(file, delimiter=';'):
            db.execute('INSERT INTO support VALUES (?, ?)', (row['ticket_id'], row['customer_id']))
    rows = lambda sql: [dict(row) for row in db.execute(sql)]
    ids = lambda sql: [row[0] for row in db.execute(sql)]
    value = lambda sql: db.execute(sql).fetchone()[0]
    result = {
        'name_mismatches': rows('SELECT b.id, c.name AS crm, b.name AS billing FROM customers b JOIN crm c USING(id) WHERE b.name != c.name'),
        'email_mismatch_ids': ids('SELECT b.id FROM customers b JOIN crm c USING(id) WHERE b.email != c.email'),
        'billing_only_ids': ids('SELECT id FROM customers EXCEPT SELECT id FROM crm'),
        'churned_billed_ids': ids("SELECT b.id FROM customers b JOIN crm c USING(id) WHERE b.status = 'active' AND c.status = 'churned'"),
        'orphan_refunds': rows('SELECT * FROM refunds WHERE invoice_id NOT IN (SELECT id FROM invoices)'),
        'unknown_support': rows('SELECT * FROM support WHERE customer_id NOT IN (SELECT id FROM customers UNION SELECT id FROM crm)'),
        'units': {'crm': 'dollars', 'billing': 'cents'},
        'dates': {'crm': 'MM/DD/YYYY', 'billing': 'YYYY-MM-DD', 'support': 'DD/MM/YYYY'},
        'totals': {
            'reconciled_customers': value('SELECT COUNT(*) FROM (SELECT id FROM customers UNION SELECT id FROM crm)'),
            'monthly_billing_cents': value('SELECT SUM(monthly_amount_cents) FROM customers'),
            'crm_contract_cents': value('SELECT SUM(cents) FROM crm'),
            'churned_billing_cents': value("SELECT SUM(b.monthly_amount_cents) FROM customers b JOIN crm c USING(id) WHERE b.status = 'active' AND c.status = 'churned'"),
            'orphan_refund_cents': value('SELECT SUM(amount_cents) FROM refunds WHERE invoice_id NOT IN (SELECT id FROM invoices)')
        }
    }
    db.close()
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('task'); parser.add_argument('crm_export'); parser.add_argument('output')
    args = parser.parse_args()
    result = reconcile(args.task, json.loads(Path(args.crm_export).read_text()))
    with open(args.output, 'x') as file:
        json.dump(result, file, indent=2); file.write('\n')
