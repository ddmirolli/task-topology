import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { prepareCohort, suiteManifest } from './prepare.mjs';

test('prepared cohort is balanced, alternated, frozen, and cannot launch executive trials', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mtb-cohort-test-'));
  try {
    const output = path.join(dir, 'cohort'); const result = prepareCohort(output);
    assert.equal(result.attempts, 24); assert.equal(result.suiteHash, suiteManifest().suiteHash);
    const p = JSON.parse(fs.readFileSync(path.join(output, 'plan.json')));
    for (const task of p.tasks) for (const configuration of [0, 1]) assert.equal(p.slots.filter(s => s.taskId === task.id && s.configuration === configuration).length, 2);
    assert.ok(p.slots.every(s => s.tier !== 3)); assert.equal(p.apiSpendAuthorizedUsd, 0); assert.equal(p.readiness, 'held');
    for (let i = 0; i < p.slots.length; i += 2) assert.notEqual(p.slots[i].configuration, p.slots[i + 1].configuration);
    assert.throws(() => prepareCohort(output));
    const priorPath = process.env.PATH;
    try {
      process.env.PATH = '';
      prepareCohort(path.join(dir, 'without-client'));
      const missing = JSON.parse(fs.readFileSync(path.join(dir, 'without-client/plan.json')));
      assert.equal(missing.configurations[0].clientVersion, null);
      assert.ok(missing.holds.includes('execution client version unavailable'));
    } finally { process.env.PATH = priorPath; }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
