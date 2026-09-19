import test from 'node:test';
import assert from 'node:assert/strict';
import { calibrate, adjudicate } from '../.build/core/grading.js';
import { gradeReview, reviewTemplate } from './review.mjs';
import { sha256 } from '../pilot/workspace.mjs';

test('objective execution holds survive an unsupported all-pass review', () => {
  for (const candidates of [{ nativeRejections: ['call-a'] }, { contextMatches: false }, { transcriptParseErrors: [3] }]) {
    const body = { version: 'mtb-review-packet/1', runId: 'hold', appPass: true, elapsedSeconds: 30,
      sources: { session: 'valid source text' }, candidates };
    const packet = { ...body, packetHash: sha256(JSON.stringify(body)) }, review = reviewTemplate(packet);
    review.reviewer = { kind: 'model', id: 'test', version: '1' };
    const proof = { reason: 'Unsupported pass', evidence: [{ source: 'session', line: 1, quote: 'valid source text' }] };
    review.environment = { verdict: 'valid', ...proof };
    review.decisions.forEach(d => Object.assign(d, proof, { verdict: 'pass' }));
    assert.equal(gradeReview(packet, review).outcome, 'pending_review');
    review.environment.verdict = 'invalid';
    assert.equal(gradeReview(packet, review).outcome, 'environment_failure');
  }
});

test('semantic calibration rejects the wrong verdict and irrelevant but valid citations', () => {
  const judge = { id: 'judge', version: 'frozen' };
  const cases = ['success', 'failure', 'invalid'].map((id, i) => ({ id, packetHash: id,
    environment: i === 2 ? 'invalid' : 'valid', rules: Array.from({ length: 7 }, (_, n) => i === 1 && n === 0 ? 'fail' : 'pass'),
    support: [{ decision: 'environment', source: 'session', line: 2 }] }));
  const reviews = cases.map(c => ({ packetHash: c.packetHash, reviewer: { kind: 'model', ...judge },
    environment: { verdict: c.environment, evidence: [{ source: 'session', line: 2 }] },
    decisions: c.rules.map((verdict, i) => ({ rule: i + 1, verdict, evidence: [] })) }));
  assert.equal(calibrate(cases, reviews, judge).calibrated, true);
  reviews[2].environment.verdict = 'valid';
  assert.equal(calibrate(cases, reviews, judge).calibrated, false);
  reviews[2].environment.verdict = 'invalid'; reviews[2].environment.evidence[0].line = 1;
  assert.equal(calibrate(cases, reviews, judge).calibrated, false);
  assert.throws(() => calibrate(cases, [reviews[0], reviews[0], reviews[2]], judge));
  reviews[2].environment.evidence[0].line = 2;
  const partial = structuredClone(cases); partial[2].rules[4] = null;
  assert.throws(() => calibrate(partial, reviews, judge), /Freeze every expected rule verdict/);
  reviews[2].decisions[4].verdict = 'fail';
  assert.deepEqual(calibrate(cases, reviews, judge).results[2].mismatches, ['rule:5']);
});

test('all tiers retain identical success, failure, timeout, and publication boundaries', () => {
  for (const tier of [1, 2, 3]) {
    const base = { tier, execution: 'valid', termination: 'submitted', judgeQualified: true, humanAudit: 'passed',
      rules: Array.from({ length: 7 }, (_, i) => ({ name: String(i + 1), verdict: 'pass' })), rubric: [{ name: 'observable work', verdict: 'pass' }] };
    assert.equal(adjudicate(base).outcome, 'pass');
    for (const [change, expected] of [[{ execution: 'invalid' }, 'environment_failure'], [{ termination: 'timeout' }, 'fail'],
      [{ termination: 'provider_error' }, 'provider_error'], [{ judgeQualified: false }, 'pending'], [{ humanAudit: 'pending' }, 'pending'],
      [{ rubric: [{ name: 'observable work', verdict: 'fail' }] }, 'fail']]) {
      const result = adjudicate({ ...base, ...change });
      assert.equal(result.outcome, expected); assert.equal(result.completedWorkEligible, false);
      assert.equal(result.comparisonEligible, false); assert.equal(result.publishedZ, null);
    }
    assert.throws(() => adjudicate({ ...base, rubric: [] }));
  }
});
