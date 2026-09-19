import assert from 'node:assert/strict';

export const efficiencyFormula = 'mtb-efficiency-geometric/2' as const;
export interface EfficiencyPlan {
  comparisonKey: string;
  configurationId: string;
  costBasis: string | null;
  slots: readonly { attemptId: string; taskId: string; workUnits: number }[];
}
export interface EfficiencyAttempt {
  attemptId: string;
  taskId: string;
  comparisonKey: string;
  configurationId: string;
  costBasis: string | null;
  verdict: 'pass' | 'fail' | 'pending' | 'environment_failure';
  elapsedSeconds: number | null;
  costUsd: number | null;
}
export interface EfficiencyResult {
  formulaVersion: typeof efficiencyFormula;
  calibrationStatus: 'candidate';
  comparisonEligible: false;
  publishedEfficiency: null;
  candidateEfficiency: number | null;
  costBasis: string | null;
  completedWork: number | null;
  elapsedSeconds: number | null;
  costUsd: number | null;
  workPerHour: number | null;
  workPerDollar: number | null;
  reasons: string[];
}

// The operator supplies the frozen plan and adjudicated records. This function
// checks their structure and arithmetic, not their authenticity or calibration.
export function executionEfficiency(plan: EfficiencyPlan, attempts: readonly EfficiencyAttempt[]): EfficiencyResult {
  assert.ok(typeof plan.comparisonKey === 'string' && plan.comparisonKey.trim());
  assert.ok(typeof plan.configurationId === 'string' && plan.configurationId.trim());
  assert.ok(plan.costBasis === null || typeof plan.costBasis === 'string' && plan.costBasis.trim());
  assert.ok(plan.slots.length > 0 && attempts.length === plan.slots.length, 'Account for every planned attempt');
  const slots = new Map<string, { taskId: string; workUnits: number }>();
  for (const slot of plan.slots) {
    assert.ok(typeof slot.attemptId === 'string' && slot.attemptId.trim() && !slots.has(slot.attemptId), 'Unique planned attempt IDs required');
    assert.ok(typeof slot.taskId === 'string' && slot.taskId.trim());
    assert.ok(Number.isFinite(slot.workUnits) && slot.workUnits > 0, 'Fix positive work units before runs');
    slots.set(slot.attemptId, slot);
  }
  let completedWork = 0, seconds = 0, dollars = 0;
  let timeKnown = true, costKnown = plan.costBasis !== null, graded = true;
  const reasons = new Set<string>();
  for (const attempt of attempts) {
    const slot = slots.get(attempt.attemptId);
    assert.ok(slot !== undefined, 'Unexpected or duplicate attempt'); slots.delete(attempt.attemptId);
    assert.equal(attempt.taskId, slot.taskId, 'Attempt does not match the planned task');
    assert.equal(attempt.comparisonKey, plan.comparisonKey, 'Different comparison protocol');
    assert.equal(attempt.configurationId, plan.configurationId, 'Do not pool reasoning settings or clients');
    assert.equal(attempt.costBasis, plan.costBasis, 'Do not pool cost bases');
    assert.ok(['pass', 'fail', 'pending', 'environment_failure'].includes(attempt.verdict));
    for (const value of [attempt.elapsedSeconds, attempt.costUsd])
      assert.ok(value === null || typeof value === 'number' && Number.isFinite(value) && value >= 0, 'Invalid measurement');
    if (attempt.verdict === 'pass') completedWork += slot.workUnits;
    if (attempt.verdict === 'pending' || attempt.verdict === 'environment_failure') {
      graded = false; reasons.add(attempt.verdict === 'pending' ? 'grading_pending' : 'environment_review_required');
    }
    if (attempt.elapsedSeconds === null) timeKnown = false; else seconds += attempt.elapsedSeconds;
    if (attempt.costUsd === null) costKnown = false; else dollars += attempt.costUsd;
  }
  assert.ok([completedWork, seconds, dollars].every(Number.isFinite), 'Aggregate exceeds numeric range');
  if (!timeKnown || seconds <= 0) reasons.add('elapsed_time_unavailable');
  if (!costKnown || dollars <= 0) reasons.add('cost_unavailable');
  let workPerHour = graded && timeKnown && seconds > 0 ? completedWork / seconds * 3600 : null;
  let workPerDollar = graded && costKnown && dollars > 0 ? completedWork / dollars : null;
  if (workPerHour !== null && !Number.isFinite(workPerHour)) { workPerHour = null; reasons.add('numeric_range'); }
  if (workPerDollar !== null && !Number.isFinite(workPerDollar)) { workPerDollar = null; reasons.add('numeric_range'); }
  let candidateEfficiency = workPerHour !== null && workPerDollar !== null ? Math.sqrt(workPerHour) * Math.sqrt(workPerDollar) : null;
  if (candidateEfficiency !== null && !Number.isFinite(candidateEfficiency)) { candidateEfficiency = null; reasons.add('numeric_range'); }
  return { formulaVersion: efficiencyFormula, calibrationStatus: 'candidate', comparisonEligible: false,
    publishedEfficiency: null, candidateEfficiency, costBasis: plan.costBasis, completedWork: graded ? completedWork : null,
    elapsedSeconds: timeKnown ? seconds : null, costUsd: costKnown ? dollars : null,
    workPerHour, workPerDollar, reasons: [...reasons].sort() };
}
