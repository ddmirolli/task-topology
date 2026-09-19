import test from 'node:test';
import assert from 'node:assert/strict';
import { sha256 } from '../pilot/workspace.mjs';
import { gradeReview, reviewTemplate } from './review.mjs';

function fixture() {
  const body = { version: 'tti-review-packet/1', runId: 'run-a', appPass: true, elapsedSeconds: 20,
    sources: { session: 'read source\nfinal result', result: 'app checks passed' } };
  const packet = { ...body, packetHash: sha256(JSON.stringify(body)) }, review = reviewTemplate(packet);
  review.reviewer = { kind: 'model', id: 'any-model', version: 'recorded-version' };
  const proof = { reason: 'All supplied evidence reviewed', evidence: [{ source: 'session', line: 1, quote: 'read source' }] };
  review.environment = { verdict: 'valid', ...proof };
  for (const d of review.decisions) Object.assign(d, proof, { verdict: 'pass' });
  return { packet, review };
}
test('complete review keeps human audit and comparison eligibility separate', () => {
  const { packet, review } = fixture(), grade = gradeReview(packet, review);
  assert.equal(grade.outcome, 'pass'); assert.equal(grade.comparisonEligible, false);
  assert.equal(grade.humanAuditStatus, 'pending');
  review.decisions[5].verdict = 'unknown';
  assert.equal(gradeReview(packet, review).outcome, 'pending_review');
});
test('rejects forged bindings, nonexistent evidence, omitted rules, and invented timestamps', () => {
  for (const mutate of [
    (p, r) => r.packetHash = 'another-run',
    (p, r) => p.sources.session += 'changed',
    (p, r) => r.decisions[0].evidence = [{ source: 'session', line: 1, quote: 'not in source' }],
    (p, r) => r.decisions[0].evidence = [],
    (p, r) => r.decisions[0].rule = 2,
    (p, r) => r.decisions.pop(),
    (p, r) => r.decisions[0].atSeconds = 21,
  ]) {
    const { packet, review } = fixture(); mutate(packet, review);
    assert.throws(() => gradeReview(packet, review));
  }
});
test('environment failure, task failure, and rule failure remain distinct', () => {
  const { packet, review } = fixture();
  review.decisions[0].verdict = 'fail';
  assert.equal(gradeReview(packet, review).outcome, 'failure');
  assert.equal(gradeReview(packet, review).firstFailureAtSeconds, null);
  review.decisions[0].atSeconds = 12;
  assert.equal(gradeReview(packet, review).firstFailureAtSeconds, 12);
  review.environment.verdict = 'invalid';
  assert.equal(gradeReview(packet, review).outcome, 'environment_failure');
});
