import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

// This supplied client only exports sources. Reconciliation belongs to the task.
const source = process.argv[2];
let result;
if (source === 'crm') {
  const c = JSON.parse(fs.readFileSync('.sandbox-secrets/crm/readonly.json', 'utf8')) as Record<string, string | number>;
  result = spawnSync('psql', ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', "SELECT coalesce(json_agg(customers ORDER BY id), '[]') FROM customers"],
    { encoding: 'utf8', env: { ...process.env, PGHOST: String(c.host), PGPORT: process.env.MTB_CRM_PORT ?? String(c.port), PGDATABASE: String(c.database), PGUSER: String(c.user), PGPASSWORD: String(c.password) }, timeout: 10_000 });
} else if (source === 'billing' || source === 'support') {
  const code = source === 'billing'
    ? "import sqlite3,json; d=sqlite3.connect('file:data/billing.sqlite?mode=ro',uri=True); d.row_factory=sqlite3.Row; print(json.dumps({t:[dict(r) for r in d.execute('SELECT * FROM '+t)] for t in ['customers','invoices','refunds']}))"
    : "import csv,json; print(json.dumps(list(csv.DictReader(open('data/support_tickets.csv',encoding='utf-16',newline=''),delimiter=';'))))";
  result = spawnSync('python3', ['-c', code], { encoding: 'utf8', timeout: 10_000 });
} else throw new Error('Use crm, billing, or support');
if (result.status !== 0) throw new Error(result.stderr || 'Source export failed');
process.stdout.write(result.stdout);
