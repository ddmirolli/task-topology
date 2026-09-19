import test from 'node:test';
import assert from 'node:assert/strict';
import { checkReportCase, reportExpectedVerdicts } from './report-calibration.mjs';

const review = verdicts => ({ environment: { verdict: 'valid' },
  decisions: verdicts.map((verdict, i) => ({ rule: i + 1, verdict })) });

test('report calibration rejects unrelated false failures even when it catches the planted defect', () => {
  const expected = reportExpectedVerdicts['missing-owner-deadline'];
  const observed = review(['pass', 'pass', 'fail', 'fail', 'fail', 'pass', 'fail']);
  assert.deepEqual(checkReportCase(expected, observed), { pass: false, mismatches: ['rule:5', 'rule:7'] });
  assert.equal(checkReportCase(expected, review(expected)).pass, true);
  for (const verdicts of Object.values(reportExpectedVerdicts)) {
    for (let i = 0; i < 7; i++) {
      const mutated = [...verdicts]; mutated[i] = verdicts[i] === 'pass' ? 'fail' : 'pass';
      assert.equal(checkReportCase(verdicts, review(mutated)).pass, false);
    }
  }
});

test('report calibration rejects partial labels, missing decisions, and invalid execution', () => {
  const expected = reportExpectedVerdicts['accurate-actionable'];
  assert.throws(() => checkReportCase([null, ...expected.slice(1)], review(expected)));
  assert.throws(() => checkReportCase(expected, review(expected.slice(1))));
  const invalid = review(expected); invalid.environment.verdict = 'invalid';
  assert.deepEqual(checkReportCase(expected, invalid).mismatches, ['environment']);
});
