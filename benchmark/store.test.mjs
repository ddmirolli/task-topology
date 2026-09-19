import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { registerTask, acceptSubmission } from './store.mjs';
import { compareProfiles } from './profile.mjs';
const hash = 'a'.repeat(64);
const profile = { version: 'mtb-execution-profile/1', taskSetHash: hash, graderHash: hash,
  client: 'future-client', clientVersion: '1', accessMethod: 'future-method', toolContractHash: hash,
  environmentHash: hash, memoryPolicy: 'fresh', compactionPolicy: 'recorded', retryPolicy: 'none',
  timingPolicy: 'task-to-submission', limits: { attemptSeconds: 60, commandSeconds: 10, maxOutputBytes: 32000 },
  settings: { effort: 'medium' }, tools: ['read', 'write'] };
function fixture(t) {
  const store = fs.mkdtempSync(path.join(os.tmpdir(), 'mtb-store-'));
  t.after(() => fs.rmSync(store, { recursive: true, force: true }));
  registerTask(store, { version: 'mtb-task-export/1', taskHash: hash, ticket: '04', appFiles: {}, taskFiles: {} });
  return { store, input: { version: 'mtb-submission/1', status: 'submitted', attemptId: 'one', taskHash: hash,
    model: { id: 'unlisted-model', vendor: 'unlisted-provider' }, profile,
    transcript: 'raw client evidence', files: { 'app.js': 'submitted code' }, elapsedSeconds: null,
    grade: { pass: true }, evidenceStatus: 'official' } };
}
test('any model and access method can enter without cost; grades cannot be supplied', t => {
  const { store, input } = fixture(t), result = acceptSubmission(store, input);
  const record = JSON.parse(fs.readFileSync(path.join(store, 'attempts', result.id, 'record.json')));
  assert.equal(record.grade, null); assert.equal(record.evidenceStatus, 'unverified');
  assert.equal(record.reportedCost, null); assert.equal(record.elapsedSeconds, null);
  assert.equal(acceptSubmission(store, input).duplicate, true);
  input.transcript += 'changed'; assert.throws(() => acceptSubmission(store, input));
});
test('rejects unknown tasks and dangerous paths before accepting evidence', t => {
  const { store, input } = fixture(t);
  for (const name of ['../outside', '/absolute', 'a/../../x', '.git/config', 'a\\b', 'a/./b'])
    assert.throws(() => acceptSubmission(store, { ...input, files: { [name]: 'x' } }));
  assert.throws(() => acceptSubmission(store, { ...input, taskHash: 'b'.repeat(64) }));
});
test('configuration identity is stable but never pools different clients or settings', () => {
  assert.equal(compareProfiles(profile, { ...profile, tools: ['write', 'read'] }).matched, true);
  assert.deepEqual(compareProfiles(profile, { ...profile, client: 'another-client' }).differences, ['client']);
  assert.equal(compareProfiles(profile, { ...profile, settings: { effort: 'high' } }).matched, false);
});
