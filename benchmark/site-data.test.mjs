import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { sha256 } from '../pilot/workspace.mjs';

test('published diagnostics contain aggregate fields only and keep scores unavailable', () => {
  const d = JSON.parse(fs.readFileSync(new URL('../site/results.json', import.meta.url)));
  assert.equal(d.status, 'diagnostic'); assert.equal(d.X, null); assert.equal(d.TTI, null);
  assert.match(d.evidenceUrl, /^https:\/\/github.com\/ddmirolli\/task-topology\/blob\/[a-f0-9]{40}\//);
  const fields = ['ticket', 'model', 'attempts', 'appChecksPassed', 'elapsedSeconds', 'apiEquivalentUsd', 'reviewHolds', 'client', 'effort'].sort();
  const seen = new Set();
  for (const row of d.rows) {
    assert.deepEqual(Object.keys(row).sort(), fields);
    assert.ok(!seen.has(row.ticket + row.model)); seen.add(row.ticket + row.model);
    for (const key of ['attempts', 'appChecksPassed', 'reviewHolds']) assert.ok(Number.isSafeInteger(row[key]) && row[key] >= 0);
    assert.ok(row.appChecksPassed <= row.attempts && row.reviewHolds <= row.attempts);
    for (const key of ['elapsedSeconds', 'apiEquivalentUsd']) assert.ok(row[key] === null || Number.isFinite(row[key]) && row[key] >= 0);
  }
  assert.equal(d.rows.reduce((s,r)=>s+r.attempts,0),18);
  assert.equal(d.rows.reduce((s,r)=>s+r.appChecksPassed,0),17);
  assert.equal(d.rows.reduce((s,r)=>s+r.reviewHolds,0),2);
});
test('published intelligence snapshot retains its exact source and attribution', () => {
  const d=JSON.parse(fs.readFileSync(new URL('../site/intelligence.json',import.meta.url)));
  assert.equal(d.rawSha256,sha256(fs.readFileSync(new URL('../site/epoch-source.csv',import.meta.url))));
  assert.equal(d.identityMapping,'unmapped');assert.equal(d.metric,'ECI');
  assert.ok(d.attribution.includes('Epoch AI'));
  assert.equal(new Set(d.observations.map(r=>r.sourceModel)).size,d.observations.length);
  assert.equal(d.observations.length,266);
});
