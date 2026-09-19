"""Grade structured findings without executing submitted code."""
import argparse
import hashlib
import json
from pathlib import Path


def load(file):
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise ValueError(f'Duplicate JSON key: {key}')
            result[key] = value
        return result
    return json.loads(Path(file).read_text(), object_pairs_hook=pairs)


def grade(packet, submission):
    packet, submission = Path(packet), Path(submission)
    manifest, key = load(packet / 'manifest.json'), load(packet / 'operator/key.json')
    if manifest['version'] != 'mtb-management/1':
        raise ValueError('Unsupported task version')
    if hashlib.sha256((packet / 'operator/key.json').read_bytes()).hexdigest() != manifest['keyHash']:
        raise ValueError('Answer key changed')
    expected_hash = hashlib.sha256(json.dumps(manifest['files'], sort_keys=True, separators=(',', ':')).encode()).hexdigest()
    if expected_hash != manifest['taskHash']:
        raise ValueError('Task manifest changed')
    checks = []
    for file, digest in manifest['files'].items():
        relative = Path(file)
        if relative.is_absolute() or '..' in relative.parts:
            raise ValueError('Invalid manifest path')
        source = submission / relative
        parents = [submission.joinpath(*relative.parts[:i]) for i in range(1, len(relative.parts) + 1)]
        intact = not submission.is_symlink() and not any(p.is_symlink() for p in parents) and source.is_file() and source.stat().st_nlink == 1 and hashlib.sha256(source.read_bytes()).hexdigest() == digest
        checks.append({'name': 'source:' + file, 'pass': intact})
    finding_file, report_file = submission / 'findings.json', submission / 'REPORT.md'
    for file in (finding_file, report_file):
        if submission.is_symlink() or file.is_symlink() or not file.is_file() or file.stat().st_nlink != 1 or file.stat().st_size > 1_000_000:
            raise ValueError('Submit regular findings.json and REPORT.md files under 1 MB')
    found = load(finding_file)
    if not isinstance(found, dict):
        raise ValueError('Findings must be a JSON object')

    def compare(name, fields=None):
        expected, actual = key[name], found.get(name)
        valid = isinstance(actual, list)
        if valid:
            if fields:
                valid = all(isinstance(row, dict) and set(row) == set(fields) for row in actual)
                expected = [{f: row[f] for f in fields} for row in expected]
            else:
                valid = all(isinstance(row, str) for row in actual)
        # Sorted lists preserve multiplicity. Duplicate answers cannot replace missing records.
        serial = lambda rows: sorted(json.dumps(r, sort_keys=True) for r in rows)
        valid = valid and serial(actual) == serial(expected)
        checks.append({'name': name, 'pass': valid})

    compare('name_mismatches', ['id', 'crm', 'billing'])
    for name in ['email_mismatch_ids', 'billing_only_ids', 'churned_billed_ids']:
        compare(name)
    compare('orphan_refunds', ['id', 'invoice_id', 'amount_cents'])
    compare('unknown_support', ['ticket_id', 'customer_id'])
    for name, expected in [('units', {'crm': 'dollars', 'billing': 'cents'}),
                           ('dates', {'crm': 'MM/DD/YYYY', 'billing': 'YYYY-MM-DD', 'support': 'DD/MM/YYYY'})]:
        checks.append({'name': name, 'pass': found.get(name) == expected})
    totals = found.get('totals')
    checks.append({'name': 'totals', 'pass': isinstance(totals, dict) and set(totals) == set(key['totals'])
        and all(type(v) is int for v in totals.values()) and totals == key['totals']})
    checks.append({'name': 'report-present', 'pass': bool(report_file.read_text().strip())})
    return {'version': 'mtb-management-grade/1', 'taskHash': manifest['taskHash'],
            'submissionHash': hashlib.sha256(finding_file.read_bytes() + b'\x00' + report_file.read_bytes()).hexdigest(),
            'dataChecksPass': all(c['pass'] for c in checks), 'checks': checks,
            'reportReview': 'pending', 'transcriptReview': 'pending',
            'liveDatabasePreservation': 'pending', 'fullPass': None, 'comparisonEligible': False}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('packet'); parser.add_argument('submission'); parser.add_argument('output')
    args = parser.parse_args()
    result = grade(args.packet, args.submission)
    with open(args.output, 'x') as file:
        json.dump(result, file, indent=2); file.write('\n')
    print(json.dumps({'dataChecksPass': result['dataChecksPass'], 'fullPass': result['fullPass']}))
