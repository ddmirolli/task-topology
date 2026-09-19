import assert from 'node:assert/strict';

// Evaluate each criterion independently, including criteria the mutation preserves.
export const reportExpectedVerdicts = Object.freeze({
  'accurate-actionable': Object.freeze(['pass', 'pass', 'pass', 'pass', 'pass', 'pass', 'pass']),
  'wrong-prose-total': Object.freeze(['pass', 'pass', 'pass', 'pass', 'pass', 'fail', 'fail']),
  'missing-owner-deadline': Object.freeze(['pass', 'pass', 'fail', 'fail', 'pass', 'pass', 'pass']),
});

export function checkReportCase(expected, review) {
  assert.equal(expected.length, 7);
  assert.ok(expected.every(v => ['pass', 'fail', 'unknown'].includes(v)), 'Freeze every expected report verdict');
  assert.deepEqual(review.decisions.map(d => d.rule).sort(), [1, 2, 3, 4, 5, 6, 7]);
  const mismatches = expected.flatMap((v, i) => review.decisions.find(d => d.rule === i + 1)?.verdict !== v ? [`rule:${i + 1}`] : []);
  if (review.environment.verdict !== 'valid') mismatches.push('environment');
  return { pass: mismatches.length === 0, mismatches };
}
