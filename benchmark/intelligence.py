"""Import dated Epoch ECI observations without guessing model identity."""
import argparse
import csv
import hashlib
import io
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen
from urllib.parse import urlparse

SOURCE = 'https://epoch.ai/data/eci_scores.csv'


def normalize(raw):
    reader = csv.DictReader(io.StringIO(raw.decode('utf-8-sig')))
    required = {'Model', 'Display name', 'eci', 'eci_ci_low', 'eci_ci_high', 'date', 'Organization', 'model_versions'}
    if not required.issubset(reader.fieldnames or []):
        raise ValueError('Epoch CSV columns changed')
    observations, seen = [], set()
    for row in reader:
        name = row['Model'].strip()
        if not name or name in seen:
            raise ValueError('Missing or duplicate upstream model name')
        seen.add(name)
        score = float(row['eci'])
        low = float(row['eci_ci_low']) if row['eci_ci_low'].strip() else None
        high = float(row['eci_ci_high']) if row['eci_ci_high'].strip() else None
        if not all(v is None or math.isfinite(v) for v in [score, low, high]):
            raise ValueError('Nonfinite score')
        if low is not None and low > score or high is not None and high < score:
            raise ValueError('Invalid confidence bounds')
        observations.append({'sourceModel': name, 'displayName': row['Display name'], 'organization': row['Organization'],
            'score': score, 'low': low, 'high': high, 'modelDate': row['date'] or None,
            'sourceVersions': row['model_versions'] or None})
    if not observations:
        raise ValueError('Empty Epoch dataset')
    return observations


def snapshot(output):
    output = Path(output)
    if output.exists():
        raise ValueError('Use a new snapshot directory')
    with urlopen(SOURCE, timeout=30) as response:
        if urlparse(response.url).hostname != 'epoch.ai':
            raise ValueError('Unexpected source redirect')
        raw = response.read(5_000_001)
        if len(raw) > 5_000_000:
            raise ValueError('Dataset exceeds size limit')
        modified, etag = response.headers.get('Last-Modified'), response.headers.get('ETag')
    observations = normalize(raw)
    record = {'version': 'mtb-intelligence-snapshot/1', 'source': 'Epoch AI', 'metric': 'ECI',
        'sourceUrl': SOURCE, 'methodologyUrl': 'https://epoch.ai/eci',
        'licenseUrl': 'https://creativecommons.org/licenses/by/4.0/',
        'attribution': 'Epoch AI, Epoch Capabilities Index. Data normalized for Model Topography.',
        'fetchedAt': datetime.now(timezone.utc).isoformat(), 'lastModified': modified, 'etag': etag,
        'rawSha256': hashlib.sha256(raw).hexdigest(), 'identityMapping': 'unmapped', 'observations': observations}
    output.mkdir(parents=True)
    (output / 'source.csv').write_bytes(raw)
    (output / 'snapshot.json').write_text(json.dumps(record, indent=2, allow_nan=False) + '\n')
    return record


if __name__ == '__main__':
    parser = argparse.ArgumentParser(); parser.add_argument('new_directory'); args = parser.parse_args()
    record = snapshot(args.new_directory)
    print(json.dumps({k: record[k] for k in ['source', 'metric', 'rawSha256', 'fetchedAt', 'identityMapping']} | {'observations': len(record['observations'])}))
