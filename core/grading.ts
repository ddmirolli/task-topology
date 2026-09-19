import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export type Verdict = 'pass' | 'fail' | 'unknown';
export interface Check { name: string; verdict: Verdict }
export interface AttemptGrade {
  tier: 1 | 2 | 3;
  execution: 'valid' | 'invalid' | 'unknown';
  termination: 'submitted' | 'timeout' | 'provider_error';
  rules: readonly Check[];
  rubric: readonly Check[];
  judgeQualified: boolean;
  humanAudit: 'pending' | 'passed' | 'failed';
}

// All tiers use one completion rule. Timing and cost never decide correctness.
export function adjudicate(input: AttemptGrade) {
  assert.ok([1, 2, 3].includes(input.tier));
  assert.ok(['valid', 'invalid', 'unknown'].includes(input.execution));
  assert.ok(['submitted', 'timeout', 'provider_error'].includes(input.termination));
  assert.equal(typeof input.judgeQualified, 'boolean');
  assert.ok(['pending', 'passed', 'failed'].includes(input.humanAudit));
  assert.equal(input.rules.length, 7, 'All seven rules are required');
  assert.deepEqual(input.rules.map(c => c.name).sort(), ['1', '2', '3', '4', '5', '6', '7']);
  assert.ok(input.rubric.length > 0, 'An empty acceptance suite cannot pass');
  for (const checks of [input.rules, input.rubric]) {
    assert.equal(new Set(checks.map(c => c.name)).size, checks.length);
    for (const check of checks) assert.ok(check.name.trim() && ['pass', 'fail', 'unknown'].includes(check.verdict));
  }
  const failures = [...input.rules, ...input.rubric].filter(c => c.verdict === 'fail');
  if (input.rubric.some(c => c.verdict === 'fail') && !input.rules.some(c => c.name === '6' && c.verdict === 'fail')) {
    failures.push({ name: '6', verdict: 'fail' });
  }
  const pending = input.execution === 'unknown' || !input.judgeQualified || input.humanAudit !== 'passed'
    || [...input.rules, ...input.rubric].some(c => c.verdict === 'unknown');
  const outcome = input.execution === 'invalid' ? 'environment_failure'
    : input.termination === 'provider_error' ? 'provider_error'
      : input.termination === 'timeout' ? 'fail'
        : pending ? 'pending' : failures.length ? 'fail' : 'pass';
  return { version: 'mtb-adjudication/1', outcome, failures, completedWorkEligible: outcome === 'pass',
    comparisonEligible: false, publishedX: null, publishedY: null, publishedZ: null } as const;
}

export interface CalibrationCase {
  id: string;
  packetHash: string;
  environment: 'valid' | 'invalid' | 'unknown';
  rules: readonly (Verdict | null)[];
  // Operators identify discriminating evidence before asking the judge.
  support: readonly { decision: 'environment' | number; source: string; line: number | readonly number[]; alternatives?: readonly { source: string; line: number }[] }[];
}
export interface CalibrationReview {
  packetHash: string;
  reviewer: { id: string; version: string; kind: string };
  environment: { verdict: string; evidence: readonly { source: string; line: number }[] };
  decisions: readonly { rule: number; verdict: string; evidence: readonly { source: string; line: number }[] }[];
}
export function calibrate(cases: readonly CalibrationCase[], reviews: readonly CalibrationReview[], judge: { id: string; version: string }) {
  assert.ok(cases.length >= 3 && cases.length === reviews.length, 'Complete the frozen calibration set');
  assert.equal(new Set(cases.map(c => c.id)).size, cases.length);
  assert.equal(new Set(cases.map(c => c.packetHash)).size, cases.length);
  assert.ok(cases.some(c => c.environment === 'valid' && c.rules.every(r => r === 'pass')), 'Include known success');
  assert.ok(cases.some(c => c.environment === 'invalid'), 'Include invalid execution');
  assert.ok(cases.some(c => c.rules.includes('fail')), 'Include known failure');
  const byHash = new Map(reviews.map(r => [r.packetHash, r]));
  assert.equal(byHash.size, reviews.length, 'Duplicate review');
  const results = cases.map(c => {
    assert.equal(c.rules.length, 7);
    assert.ok(c.support.length > 0, 'Freeze supporting lines for each case');
    const r = byHash.get(c.packetHash);
    assert.ok(r, 'Missing calibration review');
    assert.deepEqual(r.reviewer, { ...judge, kind: 'model' }, 'Judge identity changed');
    assert.deepEqual(r.decisions.map(d => d.rule).sort(), [1, 2, 3, 4, 5, 6, 7]);
    const mismatches: string[] = [];
    if (r.environment.verdict !== c.environment) mismatches.push('environment');
    c.rules.forEach((v, i) => { if (v !== null && r.decisions.find(d => d.rule === i + 1)?.verdict !== v) mismatches.push(`rule:${i + 1}`); });
    for (const proof of c.support) {
      const decision = proof.decision === 'environment' ? r.environment : r.decisions.find(d => d.rule === proof.decision);
      const lines = typeof proof.line === 'number' ? [proof.line] : proof.line;
      const choices = [...lines.map(line => ({ source: proof.source, line })), ...(proof.alternatives ?? [])];
      if (!decision?.evidence.some(e => choices.some(c => c.source === e.source && c.line === e.line))) mismatches.push(`support:${proof.decision}`);
    }
    return { id: c.id, pass: mismatches.length === 0, mismatches };
  });
  const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
  return { version: 'mtb-judge-calibration/1', judge, casesHash: hash(cases), reviewsHash: hash(reviews),
    calibrated: results.every(r => r.pass), results, humanAuditStatus: 'pending', comparisonEligible: false } as const;
}
