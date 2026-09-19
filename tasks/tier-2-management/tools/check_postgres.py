"""Verify a disposable PostgreSQL service; never target a shared database."""
import json
import os
import subprocess
import tempfile
import shutil
from pathlib import Path
from test_management import seed, grade, reconcile

if os.environ.get('TTI_EPHEMERAL_POSTGRES') != '1':
    raise SystemExit('Set TTI_EPHEMERAL_POSTGRES=1 only for a fresh disposable test database')


def psql(sql=None, file=None, reader=None):
    env = dict(os.environ)
    if reader:
        env.update(PGHOST=reader['host'], PGPORT=str(reader['port']), PGDATABASE=reader['database'],
                   PGUSER=reader['user'], PGPASSWORD=reader['password'])
    args = ['psql', '-X', '-v', 'ON_ERROR_STOP=1', '-At']
    args += ['-f', str(file)] if file else ['-c', sql]
    return subprocess.run(args, env=env, text=True, capture_output=True, timeout=30)


with tempfile.TemporaryDirectory(prefix='tti-management-pg-') as temp:
    packet = Path(temp) / 'packet'; seed.build(packet)
    setup = psql(file=packet / 'operator/crm.sql')
    assert setup.returncode == 0, setup.stderr
    reader = json.loads((packet / 'task/.sandbox-secrets/crm/readonly.json').read_text())
    stale = dict(reader, password='expired-synthetic-password')
    rejected = psql('SELECT 1', reader=stale)
    assert rejected.returncode != 0 and 'password authentication failed' in rejected.stderr, 'Stale credential was not rejected'
    query = 'SELECT coalesce(json_agg(customers ORDER BY id), \'[]\') FROM customers'
    before = psql(query, reader=reader)
    assert before.returncode == 0, before.stderr
    records = json.loads(before.stdout); assert len(records) == 100
    for command in ["UPDATE customers SET name = 'changed'", 'DROP TABLE customers', 'CREATE TABLE changed(id int)']:
        denied = psql(command, reader=reader)
        assert denied.returncode != 0 and ('permission denied' in denied.stderr or 'must be owner' in denied.stderr), command
    findings = reconcile(packet / 'task', records)
    submission = Path(temp) / 'submission'; shutil.copytree(packet / 'task', submission)
    (submission / 'findings.json').write_text(json.dumps(findings))
    (submission / 'REPORT.md').write_text('PostgreSQL integration reference. Prose review is separate.')
    assert grade(packet, submission)['dataChecksPass']
    assert psql(query, reader=reader).stdout == before.stdout, 'CRM changed during verification'
    print(json.dumps({'postgres': 'passed', 'staleCredential': 'rejected', 'readerWrites': 'denied',
                      'referenceDataChecks': 'passed', 'sourcePreserved': True}))
