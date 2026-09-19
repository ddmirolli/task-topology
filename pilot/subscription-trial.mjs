import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { runCodex } from './codex.mjs';
import { schedule } from './cli.mjs';
import { root, appSource, inventory, sha256 } from './workspace.mjs';

export function trialInputs() {
  return { runner: inventory(path.join(root, 'pilot')), app: inventory(appSource), tickets: inventory(path.join(root, 'tasks/tier-1-entry/tickets')) };
}
export async function subscriptionTrial(planFile, destination) {
  const planBytes = fs.readFileSync(planFile), plan = JSON.parse(planBytes);
  assert.equal(plan.version, 'mtb-subscription-plan/1');
  assert.equal(plan.retryPolicy, 'none'); assert.equal(plan.billing, 'included_allowance');
  assert.ok(Number.isSafeInteger(plan.repetitions) && plan.repetitions > 0);
  assert.ok(Array.isArray(plan.models) && plan.models.length > 0);
  assert.equal(new Set(plan.models.map(m => m.id)).size, plan.models.length);
  for (const model of plan.models) assert.ok(typeof model.id === 'string' && model.id.trim() && typeof model.effort === 'string' && model.effort.trim());
  assert.ok(Array.isArray(plan.tickets) && plan.tickets.length > 0 && new Set(plan.tickets).size === plan.tickets.length);
  assert.ok(plan.tickets.every(t => ['01', '04', '07'].includes(t)));
  for (const key of ['attemptSeconds', 'commandSeconds']) assert.ok(Number.isSafeInteger(plan.limits[key]) && plan.limits[key] > 0);
  assert.ok(!fs.existsSync(destination), 'Choose a new trial directory');
  let connectBrowserbase;
  if (plan.tickets.includes('01')) {
    ({ connectBrowserbase } = await import('./browserbase.mjs'));
    const probe = await connectBrowserbase(); await probe.close();
  }
  fs.mkdirSync(destination, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(destination, 'plan.json'), planBytes);
  fs.copyFileSync(path.join(root, 'pilot/price-evidence.json'), path.join(destination, 'price-evidence.json'));

  const frozen = trialInputs(), attempts = schedule(plan), records = [];
  const summary = { planHash: sha256(planBytes), frozenRunnerHash: sha256(JSON.stringify(frozen.runner)), frozenInputsHash: sha256(JSON.stringify(frozen)), plannedAttempts: attempts.length, records };
  const save = () => fs.writeFileSync(path.join(destination, 'results.json'), JSON.stringify(summary, null, 2) + '\n', { mode: 0o600 });
  save();
  for (const [index, entry] of attempts.entries()) {
    try {
      assert.deepEqual(trialInputs(), frozen, 'Trial inputs changed; trial stopped');
      const result = await runCodex({ ticket: entry.ticket, model: entry.model.id, effort: entry.model.effort,
        ...plan.limits, outputDir: path.join(destination, String(index + 1).padStart(2, '0')) });
      records.push({ index: index + 1, ticket: entry.ticket, model: entry.model.id, repetition: entry.repetition,
        ...result });
      save();
      if (['provider_error', 'invalid_execution'].includes(result.status) || result.gradingError) throw new Error('Client or grading failure; inspect retained evidence before another trial');
    } catch (error) { summary.stopped = { attempt: index + 1, message: error.message }; save(); throw error; }
  }
  summary.completed = true; save();
  return summary;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [planFile, destination] = process.argv.slice(2);
  console.log(JSON.stringify(await subscriptionTrial(planFile, destination), null, 2));
}
