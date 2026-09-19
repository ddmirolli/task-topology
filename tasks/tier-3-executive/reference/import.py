import csv
import io
import json
import subprocess
import sys


def quote(value):
    return "'" + value.replace("'", "''") + "'"


def main():
    rows = list(csv.DictReader(io.StringIO(sys.stdin.read())))
    if not rows or any(set(row) != {'external_id', 'title', 'description'} or not row['external_id'] or not row['title'].strip() for row in rows):
        raise ValueError('Invalid import')
    statements = ['BEGIN;']
    for row in rows:
        statements.append('INSERT INTO tickets(external_id,title,description) VALUES (' + ','.join(quote(row[k]) for k in ['external_id', 'title', 'description']) + ') ON CONFLICT(external_id) DO NOTHING;')
    statements.append('COMMIT;')
    result = subprocess.run(['psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], input='\n'.join(statements), text=True, capture_output=True, timeout=30)
    if result.returncode:
        raise RuntimeError('Import transaction failed')
    print(json.dumps({'imported': len(rows)}))


if __name__ == '__main__':
    main()
