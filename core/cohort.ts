import assert from 'node:assert/strict';
import { adjudicate, type AttemptGrade } from './grading.js';
import { executionEfficiency, type EfficiencyPlan } from './efficiency.js';

export interface CohortAttempt {
  attemptId: string;
  taskId: string;
  comparisonKey: string;
  configurationId: string;
  costBasis: string | null;
  elapsedSeconds: number | null;
  costUsd: number | null;
  grade: AttemptGrade;
}
export function scoreCohort(plan: EfficiencyPlan & { tier: 1 | 2 | 3 }, attempts: readonly CohortAttempt[]) {
  for (const a of attempts) assert.equal(a.grade.tier, plan.tier, 'Never pool tiers');
  const records = attempts.map(a => {
    const outcome = adjudicate(a.grade).outcome;
    return { ...a, verdict: outcome === 'provider_error' ? 'pending' as const : outcome };
  });
  return executionEfficiency(plan, records);
}
