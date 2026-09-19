import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreCohort } from '../.build/core/cohort.js';

test('publication and audit boundaries survive real adjudication into efficiency arithmetic', () => {
  for (const tier of [1, 2, 3]) {
    const plan = { tier, comparisonKey: 'frozen', configurationId: 'configuration', costBasis: 'synthetic', slots: [{ attemptId: 'a', taskId: 'task', workUnits: 1 }] };
    const record = { attemptId: 'a', taskId: 'task', comparisonKey: 'frozen', configurationId: 'configuration', costBasis: 'synthetic', elapsedSeconds: 60, costUsd: 1,
      grade: { tier, execution: 'valid', termination: 'submitted', judgeQualified: true, humanAudit: 'passed', rules: Array.from({ length: 7 }, (_, i) => ({ name: String(i + 1), verdict: 'pass' })), rubric: [{ name: 'acceptance', verdict: 'pass' }] } };
    assert.equal(scoreCohort(plan, [record]).workPerHour, 60);
    for (const change of [{ humanAudit: 'pending' }, { judgeQualified: false }, { execution: 'invalid' }, { termination: 'provider_error' }]) {
      const value = scoreCohort(plan, [{ ...record, grade: { ...record.grade, ...change } }]);
      assert.equal(value.candidateZ, null); assert.equal(value.publishedZ, null); assert.equal(value.comparisonEligible, false);
    }
    const failed = { ...record, grade: { ...record.grade, rubric: [{ name: 'acceptance', verdict: 'fail' }] } };
    assert.equal(scoreCohort(plan, [failed]).candidateZ, 0);
    assert.equal(scoreCohort(plan, [{ ...failed, grade: { ...failed.grade, judgeQualified: false } }]).candidateZ, null);
    assert.throws(() => scoreCohort(plan, [{ ...record, grade: { ...record.grade, tier: tier === 1 ? 2 : 1 } }]));
  }
});

test('task order, provider names, and linear units do not reward failed work or delay', () => {
  const grade = { tier: 1, execution: 'valid', termination: 'submitted', judgeQualified: true, humanAudit: 'passed', rules: Array.from({ length: 7 }, (_, i) => ({ name: String(i + 1), verdict: 'pass' })), rubric: [{ name: 'acceptance', verdict: 'pass' }] };
  const plan = { tier: 1, comparisonKey: 'frozen', configurationId: 'any-client', costBasis: 'synthetic', slots: [1, 2].map(i => ({ attemptId: String(i), taskId: String(i), workUnits: 1 })) };
  const attempts = plan.slots.map(s => ({ ...s, comparisonKey: 'frozen', configurationId: 'any-client', costBasis: 'synthetic', elapsedSeconds: 60, costUsd: 1, grade }));
  const base = scoreCohort(plan, attempts);
  assert.deepEqual(scoreCohort(plan, [...attempts].reverse()), base);
  for (const factor of [1.01, 2, 10, 100]) {
    assert.ok(scoreCohort(plan, attempts.map(a => ({ ...a, elapsedSeconds: a.elapsedSeconds * factor }))).candidateZ < base.candidateZ);
    assert.ok(scoreCohort(plan, attempts.map(a => ({ ...a, costUsd: a.costUsd * factor }))).candidateZ < base.candidateZ);
  }
});
