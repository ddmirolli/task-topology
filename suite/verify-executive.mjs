import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { root, temp } from '../.build/core/runtime.js';
import { deployExecutive, acceptExecutive } from '../.build/core/executive.js';
const out = process.argv[2]; assert.ok(out && !fs.existsSync(out)); fs.mkdirSync(out, { mode: 0o700 });
const dir = temp('mtb-executive-negatives-');
try {
  for (const variant of ['lost-data', 'duplicate-import']) {
    const source = path.join(dir, variant); fs.cpSync(path.join(root, 'tasks/tier-3-executive/reference'), source, { recursive: true });
    if (variant === 'lost-data') {
      const file = path.join(source, 'start.sh'); fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('exec ./server', 'psql -X -q -c "TRUNCATE comments,tickets RESTART IDENTITY CASCADE"\nexec ./server'));
    } else {
      const file = path.join(source, 'import.py'); fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace("quote(row[k]) for k in ['external_id', 'title', 'description']", "('NULL' if k == 'external_id' else quote(row[k])) for k in ['external_id', 'title', 'description']"));
    }
    const app = await deployExecutive(path.join(dir, variant + '-run'), source);
    try {
      const result = await acceptExecutive(app); fs.writeFileSync(path.join(out, variant + '.json'), JSON.stringify(result, null, 2), { mode: 0o600 });
      assert.equal(result.appPass, false);
      const check = variant === 'lost-data' ? 'first restart preserves work' : 'Python import is authenticated and idempotent';
      assert.equal(result.checks.find(c => c.name === check).pass, false);
    } finally { await app.close(); }
  }
  console.log(JSON.stringify({ pass: true, rejected: ['lost-data', 'duplicate-import'], evidence: out }));
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
