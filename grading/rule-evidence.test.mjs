import test from 'node:test';
import assert from 'node:assert/strict';
import { sha256 } from '../pilot/workspace.mjs';
import { reviewTemplate, gradeReview } from './review.mjs';
import { attachRuleEvidence } from './rule-evidence.mjs';

test('independent failure evidence is attached without changing the judge verdict or raw review', () => {
  const body = { version: 'mtb-review-packet/1', runId: 'known-failure', appPass: false, elapsedSeconds: 20,
    sources: { result: JSON.stringify({ grade: { pass: false, checks: [{ name: 'contrast', pass: false, error: 'contrast 2.28' }] } }, null, 2) } };
  const packet = { ...body, packetHash: sha256(JSON.stringify(body)) }, review = reviewTemplate(packet);
  review.reviewer = { kind: 'model', id: 'fixture', version: 'v1' };
  const proof = { reason: 'Fixture decision', evidence: [{ source: 'result', line: 1, quote: '{' }] };
  review.environment = { verdict: 'valid', ...proof };
  review.decisions.forEach(d => Object.assign(d, structuredClone(proof), { verdict: d.rule === 1 ? 'fail' : 'pass' }));
  const original = JSON.stringify(review), attached = attachRuleEvidence(packet, review);
  assert.equal(JSON.stringify(review), original);
  assert.ok(attached.additions.some(a => a.rule === 1 && a.quote.includes('contrast 2.28')));
  assert.deepEqual(attached.review.decisions.map(d => d.verdict), review.decisions.map(d => d.verdict));
  assert.ok(gradeReview(packet, attached.review).failures.some(d => d.rule === 6 && d.authority === 'independent task grader'));
});
