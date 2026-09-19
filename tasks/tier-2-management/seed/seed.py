"""Build versioned synthetic reconciliation data. Standard library only."""
import argparse
import csv
import hashlib
import io
import json
import random
import sqlite3
from pathlib import Path

VERSION = 'mtb-management/1'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def write_json(file, value):
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(json.dumps(value, indent=2, sort_keys=True) + '\n')


def sql_text(value):
    return "'" + str(value).replace("'", "''") + "'"


def build(destination, seed=20260918):
    destination = Path(destination)
    if destination.exists():
        raise ValueError('Choose a new output directory; retain earlier task versions')
    task = destination / 'task'
    private = destination / 'operator'
    (task / 'data').mkdir(parents=True)
    (task / 'docs').mkdir()
    (task / '.sandbox-secrets/crm').mkdir(parents=True)
    private.mkdir()
    rng = random.Random(seed)
    ids = [f'C{i:04}' for i in range(1, 104)]
    chosen = rng.sample(ids[:100], 23)
    name_ids, email_ids, churn_ids = chosen[:12], chosen[12:19], chosen[19:23]
    customers = [{ 'id': id, 'name': f'Cedar {i:03} Services', 'email': f'accounts{i}@example.invalid',
                   'amount_cents': (100 + rng.randrange(900)) * 100 + rng.randrange(100),
                   'joined': f'2026-08-{1 + i % 28:02}', 'status': 'active'} for i, id in enumerate(ids, 1)]
    crm = []
    for customer in customers[:100]:
        row = dict(customer)
        if row['id'] in churn_ids:
            row['status'] = 'churned'
        crm.append(row)
    db = sqlite3.connect(task / 'data/billing.sqlite')
    db.executescript('''CREATE TABLE customers (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL,
      monthly_amount_cents INTEGER NOT NULL, joined_on TEXT NOT NULL, status TEXT NOT NULL,
      billing_region TEXT NOT NULL);
      CREATE TABLE invoices (id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, amount_cents INTEGER NOT NULL);
      CREATE TABLE refunds (id TEXT PRIMARY KEY, invoice_id TEXT NOT NULL, amount_cents INTEGER NOT NULL);''')
    for i, c in enumerate(customers, 1):
        name = c['name'].replace('Services', 'Svc.') if c['id'] in name_ids else c['name']
        email = f"old-{c['email']}" if c['id'] in email_ids else c['email']
        db.execute('INSERT INTO customers VALUES (?, ?, ?, ?, ?, ?, ?)',
                   (c['id'], name, email, c['amount_cents'], c['joined'], c['status'], 'US'))
        db.execute('INSERT INTO invoices VALUES (?, ?, ?)', (f'I{i:04}', c['id'], c['amount_cents']))
    db.executemany('INSERT INTO refunds VALUES (?, ?, ?)', [('R0001', 'I0001', 2000),
        ('R0002', 'I9998', 12550), ('R0003', 'I9999', 4799)])
    db.commit()
    bill = [dict(zip(['id', 'name', 'email', 'monthly_amount_cents', 'joined_on', 'status', 'billing_region'], row))
            for row in db.execute('SELECT * FROM customers ORDER BY id')]
    orphan_refunds = [dict(zip(['id', 'invoice_id', 'amount_cents'], row)) for row in db.execute(
        'SELECT r.* FROM refunds r LEFT JOIN invoices i ON i.id = r.invoice_id WHERE i.id IS NULL ORDER BY r.id')]
    db.close()
    support = [{'ticket_id': f'T{i:04}', 'customer_id': ids[(i * 7) % 103],
                'opened_on': f'{1 + i % 28:02}/09/2026', 'subject': 'R\u00e9sum\u00e9 of customer request'} for i in range(1, 31)]
    support += [{'ticket_id': f'T{i:04}', 'customer_id': f'C9{i:03}', 'opened_on': '18/09/2026',
                 'subject': 'Unknown account'} for i in range(31, 36)]
    output = io.StringIO(newline='')
    writer = csv.DictWriter(output, fieldnames=['ticket_id', 'customer_id', 'opened_on', 'subject'], delimiter=';', lineterminator='\r\n')
    writer.writeheader(); writer.writerows(support)
    (task / 'data/support_tickets.csv').write_bytes(output.getvalue().encode('utf-16'))
    password = 'synthetic-' + sha(str(seed).encode())[:24]
    write_json(task / '.sandbox-secrets/crm/readonly.json', {'host': '127.0.0.1', 'port': 5432,
        'database': 'mtb_management', 'user': 'mtb_reader', 'password': password})
    (task / '.env.crm').write_text('PGHOST=127.0.0.1\nPGPORT=5432\nPGDATABASE=mtb_management\nPGUSER=mtb_reader\nPGPASSWORD=expired-synthetic-password\n')
    (task / 'docs/access.md').write_text('''# Data access

CRM uses PostgreSQL. `.env.crm` is a legacy connection file.
The sandbox secret store at `.sandbox-secrets/crm/readonly.json` is authoritative.
Use the read-only account. The operator supplies PostgreSQL client tools.
Billing is `data/billing.sqlite`. Support is `data/support_tickets.csv`.
Inspect source schemas and file encodings. Export documentation can be stale.
All credentials and customer records in this task are synthetic.
''')
    (task / 'docs/billing.md').write_text('''# Billing export

The historical customer columns are id, name, email, monthly_amount_cents,
joined_on, and status. Invoice and refund tables accompany the customer export.
Check the database schema before importing positional values.
''')
    contract = Path(__file__).resolve().parents[1] / 'contract.md'
    (task / 'TASK.md').write_bytes(contract.read_bytes())
    statements = ['BEGIN;', 'CREATE TABLE customers (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, monthly_contract_dollars NUMERIC(12,2) NOT NULL, joined_on TEXT NOT NULL, status TEXT NOT NULL);']
    for c in crm:
        date = c['joined'][5:7] + '/' + c['joined'][8:] + '/' + c['joined'][:4]
        values = [c['id'], c['name'], c['email'], f"{c['amount_cents']/100:.2f}", date, c['status']]
        statements.append('INSERT INTO customers VALUES (' + ','.join(sql_text(v) for v in values) + ');')
    statements += [f"CREATE ROLE mtb_reader LOGIN PASSWORD {sql_text(password)};", 'GRANT CONNECT ON DATABASE mtb_management TO mtb_reader;',
        'GRANT USAGE ON SCHEMA public TO mtb_reader;', 'GRANT SELECT ON ALL TABLES IN SCHEMA public TO mtb_reader;',
        'REVOKE CREATE ON SCHEMA public FROM PUBLIC;', 'COMMIT;']
    (private / 'crm.sql').write_text('\n'.join(statements) + '\n')
    # This snapshot is operator-only. The model accesses CRM through PostgreSQL.
    write_json(private / 'crm.expected.json', crm)
    by_crm = {c['id']: c for c in crm}
    mismatched_names = [{'id': b['id'], 'crm': by_crm[b['id']]['name'], 'billing': b['name']} for b in bill
                        if b['id'] in by_crm and b['name'] != by_crm[b['id']]['name']]
    mismatched_email = [b['id'] for b in bill if b['id'] in by_crm and b['email'] != by_crm[b['id']]['email']]
    churned = [b for b in bill if b['id'] in by_crm and b['status'] == 'active' and by_crm[b['id']]['status'] == 'churned']
    missing = [b['id'] for b in bill if b['id'] not in by_crm]
    known = set(by_crm) | {b['id'] for b in bill}
    unknown = [s for s in support if s['customer_id'] not in known]
    key = {'version': VERSION, 'seed': seed,
        'name_mismatches': mismatched_names, 'email_mismatch_ids': mismatched_email,
        'billing_only_ids': missing, 'churned_billed_ids': [b['id'] for b in churned],
        'orphan_refunds': orphan_refunds, 'unknown_support': unknown,
        'totals': {'reconciled_customers': len(known), 'monthly_billing_cents': sum(b['monthly_amount_cents'] for b in bill),
                   'crm_contract_cents': sum(c['amount_cents'] for c in crm),
                   'churned_billing_cents': sum(b['monthly_amount_cents'] for b in churned),
                   'orphan_refund_cents': sum(r['amount_cents'] for r in orphan_refunds)}}
    write_json(private / 'key.json', key)
    files = {str(p.relative_to(task)): sha(p.read_bytes()) for p in sorted(task.rglob('*')) if p.is_file()}
    write_json(destination / 'manifest.json', {'version': VERSION, 'seed': seed, 'files': files,
        'taskHash': sha(json.dumps(files, sort_keys=True, separators=(',', ':')).encode()),
        'keyHash': sha((private / 'key.json').read_bytes()), 'crmSeedHash': sha((private / 'crm.sql').read_bytes())})
    return key


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('destination')
    parser.add_argument('--seed', type=int, default=20260918)
    args = parser.parse_args()
    key = build(args.destination, args.seed)
    print(json.dumps({'version': VERSION, 'destination': args.destination, 'totals': key['totals']}))
