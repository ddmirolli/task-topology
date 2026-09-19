import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { registerTask, acceptSubmission } from './store.mjs';
import { gradeQueued } from './cli.mjs';
import { inventory } from '../pilot/workspace.mjs';

test('queued submissions are independently graded and bind back to unchanged intake', { skip: process.platform !== 'darwin' }, async t => {
  const { exportTask } = await import('../pilot/external.mjs');
  const { fixture } = await import('../pilot/fixtures.mjs');
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tti-worker-test-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const packet = path.join(temp, 'packet'), store = path.join(temp, 'store'), manifest = exportTask('04', packet);
  registerTask(store, manifest);
  const h = 'a'.repeat(64), profile = { version: 'tti-execution-profile/1', taskSetHash: h, graderHash: h,
    client: 'fixture-client', clientVersion: '1', accessMethod: 'local', toolContractHash: h, environmentHash: h,
    memoryPolicy: 'fresh', compactionPolicy: 'none', retryPolicy: 'none', timingPolicy: 'task-to-submission',
    limits: { attemptSeconds: 60, commandSeconds: 30, maxOutputBytes: 32000 }, settings: {}, tools: ['file', 'shell'] };
  for (const variant of ['alternative', 'broken']) {
    const app = fixture('04', variant);
    try {
      const files = Object.fromEntries(Object.keys(inventory(app)).map(name => [name, fs.readFileSync(path.join(app, name), 'utf8')]));
      const accepted = acceptSubmission(store, { version: 'tti-submission/1', attemptId: variant, taskHash: manifest.taskHash,
        model: { id: 'fixture', vendor: 'local' }, profile, status: 'submitted', transcript: 'Fixture, not a model run', files, grade: { pass: true } });
      const recordPath = path.join(store, 'attempts', accepted.id, 'record.json'), original = fs.readFileSync(recordPath);
      const result = await gradeQueued(store, accepted.id, packet, path.join(temp, variant));
      assert.equal(result.appPass, variant === 'alternative'); assert.equal(result.comparisonEligible, false);
      assert.deepEqual(fs.readFileSync(recordPath), original);
      const corrupted = JSON.parse(original); corrupted.files['routes/clients.js'] = 'changed after intake';
      fs.writeFileSync(recordPath, JSON.stringify(corrupted));
      await assert.rejects(gradeQueued(store, accepted.id, packet, path.join(temp, variant + '-tampered')), /Queued evidence changed/);
    } finally { fs.rmSync(app, { recursive: true, force: true }); }
  }
});
