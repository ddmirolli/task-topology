import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { root, tool, command, postgres, isolated, capture } from './runtime.js';

const sha = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');
export async function prepareManagement(directory: string, seed = 20260919) {
  const packet = path.join(directory, 'packet'), workspace = path.join(directory, 'workspace');
  assert.ok(!fs.existsSync(packet) && !fs.existsSync(workspace));
  const pg = await postgres('mtb_management');
  try {
    command(tool('python3'), [path.join(root, 'tasks/tier-2-management/seed/seed.py'), packet, '--seed', String(seed)], root);
    pg.sql(fs.readFileSync(path.join(packet, 'operator/crm.sql'), 'utf8'));
    const task = path.join(packet, 'task');
    const credentials = path.join(task, '.sandbox-secrets/crm/readonly.json');
    const reader = JSON.parse(fs.readFileSync(credentials, 'utf8'));
    fs.copyFileSync(path.join(root, '.build/core/management-client.js'), path.join(task, 'access.mjs'));
    fs.copyFileSync(path.join(root, 'core/management-client.ts'), path.join(task, 'access.ts'));
    fs.appendFileSync(path.join(task, 'TASK.md'), '\nUse the supplied TypeScript access client with `node access.mjs crm`, `billing`, or `support`. The operator sets MTB_CRM_PORT and PGPORT to this attempt\'s isolated CRM port. Write Python reconciliation helpers under `work/`. Only `work/`, `REPORT.md`, and `findings.json` are editable. The client preserves source units and dates. Query source schemas with psql or Python when needed.\n');
    fs.mkdirSync(path.join(task, 'work'));
    const manifest = JSON.parse(fs.readFileSync(path.join(packet, 'manifest.json'), 'utf8'));
    for (const file of ['.sandbox-secrets/crm/readonly.json', '.env.crm', 'access.mjs', 'access.ts', 'TASK.md']) manifest.files[file] = sha(fs.readFileSync(path.join(task, file)));
    manifest.files = Object.fromEntries(Object.entries(manifest.files).sort(([a], [b]) => a.localeCompare(b, 'en')));
    // Python's original manifest uses ASCII key ordering.
    manifest.files = Object.fromEntries(Object.keys(manifest.files).sort().map(k => [k, manifest.files[k]]));
    manifest.taskHash = sha(JSON.stringify(manifest.files));
    manifest.suiteVersion = 'mtb-three-tier/2';
    manifest.version = 'mtb-management/2';
    fs.writeFileSync(path.join(packet, 'manifest.json'), JSON.stringify(manifest, null, 2));
    fs.cpSync(task, workspace, { recursive: true });
    const before = pg.sql("SELECT coalesce(json_agg(customers ORDER BY id), '[]') FROM customers");
    const readerEnv = { ...pg.env, PGUSER: reader.user as string, PGPASSWORD: reader.password as string };
    const probe = await capture(isolated(workspace, tool('psql'), ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', 'SELECT COUNT(*) FROM customers'], [pg.port], readerEnv));
    assert.equal(probe.code, 0, probe.stderr); assert.equal(probe.stdout.trim(), '100');
    for (const sql of ["UPDATE customers SET name='bad'", 'DROP TABLE customers', 'CREATE TABLE forbidden(id int)']) {
      const denied = await capture(isolated(workspace, tool('psql'), ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], [pg.port], readerEnv));
      assert.notEqual(denied.code, 0); assert.match(denied.stderr, /permission denied|must be owner/);
    }
    const stale = await capture(isolated(workspace, tool('psql'), ['-X', '-qAt', '-c', 'SELECT 1'], [pg.port], { ...readerEnv, PGPASSWORD: 'expired-synthetic-password' }));
    assert.notEqual(stale.code, 0); assert.match(stale.stderr, /password authentication failed/);
    return { packet, workspace, port: pg.port, taskHash: manifest.taskHash,
      run: (args: string[], timeoutMs = 3_600_000) => capture(isolated(workspace, '/bin/sh', args, [pg.port], { MTB_CRM_PORT: String(pg.port), PGPORT: String(pg.port) }), '', timeoutMs),
      grade: () => {
        const result = JSON.parse(command(tool('python3'), ['-c', `import sys,json;sys.path.insert(0,sys.argv[1]);from grade import grade;print(json.dumps(grade(sys.argv[2],sys.argv[3])))`, path.join(root, 'tasks/tier-2-management/tools'), packet, workspace], root));
        result.liveDatabasePreservation = pg.sql("SELECT coalesce(json_agg(customers ORDER BY id), '[]') FROM customers") === before ? 'passed' : 'failed';
        result.dataChecksPass = result.dataChecksPass && result.liveDatabasePreservation === 'passed';
        return result;
      }, close: pg.close };
  } catch (error) { pg.close(); throw error; }
}
