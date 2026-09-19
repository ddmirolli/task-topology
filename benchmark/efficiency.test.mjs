import test from 'node:test';
import assert from 'node:assert/strict';
import { executionEfficiency } from '../.build/core/efficiency.js';

function fixture() {
  const plan = { comparisonKey: 'fixed-suite', configurationId: 'model-medium', costBasis: 'api-equivalent-v1',
    slots: [1, 2, 3, 4, 5].map(i => ({ attemptId: String(i), taskId: `task-${i}`, workUnits: 1 })) };
  const attempts = plan.slots.map((slot, i) => ({ attemptId: slot.attemptId, taskId: slot.taskId, comparisonKey: plan.comparisonKey,
    configurationId: plan.configurationId, costBasis: plan.costBasis, verdict: i === 4 ? 'fail' : 'pass', elapsedSeconds: 360, costUsd: 0.4 }));
  return { plan, attempts };
}
const compute = ({ plan, attempts }) => executionEfficiency(plan, attempts);
test('speed and cost improve candidate efficiency independently; publication stays unavailable', () => {
  const f = fixture(), fast = compute(f);
  assert.equal(fast.workPerHour, 8); assert.equal(fast.workPerDollar, 2);
  assert.ok(Math.abs(fast.candidateEfficiency - 4) < 1e-12);
  const slow = executionEfficiency(f.plan, f.attempts.map(a => ({ ...a, elapsedSeconds: 720 })));
  const costly = executionEfficiency(f.plan, f.attempts.map(a => ({ ...a, costUsd: 0.8 })));
  assert.ok(fast.candidateEfficiency > slow.candidateEfficiency); assert.ok(fast.candidateEfficiency > costly.candidateEfficiency);
  assert.equal(fast.publishedEfficiency, null); assert.equal(fast.comparisonEligible, false);
});
test('more reasoning can peak then decline; no effort label grants score credit', () => {
  const f = fixture();
  const values = [
    [2, 360, 0.4], [4, 360, 0.4], [5, 720, 0.8], [5, 1440, 1.6], [5, 2880, 3.2],
  ].map(([passes, seconds, dollars]) => executionEfficiency(f.plan, f.attempts.map((a, i) => ({ ...a,
    verdict: i < passes ? 'pass' : 'fail', elapsedSeconds: seconds, costUsd: dollars }))).candidateEfficiency);
  assert.ok(values[1] > values[0] && values[1] > values[2] && values[2] > values[3] && values[3] > values[4]);
});
test('failed attempts count and duplicating a matched cohort does not inflate efficiency', () => {
  const f = fixture(), initial = compute(f);
  f.attempts[4].costUsd = 4;
  f.attempts[4].elapsedSeconds = 3600;
  assert.ok(compute(f).candidateEfficiency < initial.candidateEfficiency);
  const doubled = fixture();
  doubled.plan.slots.push(...doubled.plan.slots.map(s => ({ ...s, attemptId: s.attemptId + '-repeat' })));
  doubled.attempts.push(...doubled.attempts.map(a => ({ ...a, attemptId: a.attemptId + '-repeat' })));
  assert.ok(Math.abs(compute(doubled).candidateEfficiency - initial.candidateEfficiency) < 1e-12);
});
test('unknown data and unreviewed environments cannot become free or successful work', () => {
  for (const change of [{ costUsd: null }, { elapsedSeconds: null }, { verdict: 'pending' }, { verdict: 'environment_failure' }]) {
    const f = fixture(); Object.assign(f.attempts[0], change);
    assert.equal(compute(f).candidateEfficiency, null);
  }
  const f = fixture();
  assert.equal(executionEfficiency(f.plan, f.attempts.map(a => ({ ...a, costUsd: 0 }))).candidateEfficiency, null);
  assert.equal(executionEfficiency(f.plan, f.attempts.map(a => ({ ...a, verdict: 'fail' }))).candidateEfficiency, 0);
});
test('rejects omitted, duplicated, mixed, or invalid records', () => {
  for (const mutate of [
    f => f.attempts.pop(), f => f.attempts[0].attemptId = '2',
    f => f.attempts[0].taskId = 'easier-task', f => delete f.attempts[0].taskId,
    f => f.attempts[0].configurationId = 'model-ultra', f => f.attempts[0].comparisonKey = 'other-suite',
    f => f.attempts[0].costBasis = 'actual-subscription', f => f.attempts[0].costUsd = NaN,
    f => f.attempts[0].elapsedSeconds = -1, f => f.plan.slots[0].workUnits = 0,
  ]) { const f = fixture(); mutate(f); assert.throws(() => compute(f)); }
});
