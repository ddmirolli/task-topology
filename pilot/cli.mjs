import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { sha256 } from './workspace.mjs';
import { runAttempt } from './run.mjs';
import { openAIAdapter } from './openai.mjs';
import { grade } from './grade.mjs';
import { summarize, requestReserve } from './accounting.mjs';

export function validatePlan(plan, { live = false, now = Date.now(), evidenceFile = new URL('./price-evidence.json', import.meta.url) } = {}) {
  assert.equal(plan.version, 'mtb-pilot-plan/1');
  const evidenceBytes = fs.readFileSync(evidenceFile);
  const evidence = JSON.parse(evidenceBytes);
  assert.equal(plan.priceSource, evidence.source);
  assert.equal(plan.priceDate, evidence.date);
  assert.equal(plan.priceEvidenceHash, sha256(evidenceBytes), 'Price evidence must match the approved plan');
  assert.match(plan.priceDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(new Date(plan.priceDate).toISOString().slice(0, 10), plan.priceDate);
  if (live) {
    const age = now - Date.parse(evidence.retrievedAt);
    assert.ok(Number.isFinite(age) && age >= 0 && age <= 48 * 3600_000, 'Refresh price evidence before a paid trial; maximum age is 48 hours');
  }
  assert.deepEqual(plan.tickets, ['01', '04', '07']);
  assert.ok(Array.isArray(plan.models) && plan.models.length > 0);
  assert.equal(new Set(plan.models.map(m => m.id)).size, plan.models.length, 'Model IDs must be unique');
  assert.ok(Number.isSafeInteger(plan.repetitions) && plan.repetitions > 0);
  for (const name of ['attemptSeconds', 'commandSeconds', 'maxTurns', 'maxInputTokens', 'maxOutputTokens']) assert.ok(Number.isSafeInteger(plan.limits[name]) && plan.limits[name] > 0, name);
  assert.ok(plan.limits.maxInputTokens <= 32000, 'Only the short-context price band is supported');
  for (const n of [plan.totalUsd, plan.limits.attemptUsd]) assert.ok(Number.isFinite(n) && n > 0);
  for (const m of plan.models) {
    assert.ok(typeof m.id === 'string' && m.id.trim(), 'Supply a model ID');
    assert.ok(typeof m.effort === 'string' && m.effort.trim(), 'Supply a reasoning setting');
    for (const key of ['input', 'cached', 'cacheWrite', 'output']) assert.ok(Number.isFinite(m.rates[key]) && m.rates[key] >= 0);
    assert.deepEqual(m.rates, evidence.rates[m.id], 'Model prices must match the dated evidence');
    assert.ok(requestReserve(plan.limits, m.rates) * plan.limits.maxTurns <= plan.limits.attemptUsd + 1e-9);
  }
  const maximumUsd = plan.models.reduce((s, m) => s + requestReserve(plan.limits, m.rates) * plan.limits.maxTurns * plan.tickets.length * plan.repetitions, 0);
  assert.ok(maximumUsd <= plan.totalUsd + 1e-9, 'The full trial must fit inside its cap');
  return { attempts: plan.models.length * plan.tickets.length * plan.repetitions, maximumUsd, capUsd: plan.totalUsd, planHash: sha256(JSON.stringify(plan)) };
}
export function schedule(plan) {
  const result = [];
  for (let repetition = 0; repetition < plan.repetitions; repetition++) for (const [index, ticket] of plan.tickets.entries()) {
    const offset = (repetition + index) % plan.models.length;
    const order = [...plan.models.slice(offset), ...plan.models.slice(0, offset)];
    for (const model of order) result.push({ ticket, model, repetition: repetition + 1 });
  }
  return result;
}
async function main() {
  const [mode = 'plan', file = fileURLToPath(new URL('./proposal.json', import.meta.url)), destination] = process.argv.slice(2);
  const plan = JSON.parse(fs.readFileSync(file, 'utf8'));
  const evidenceFile = plan.priceEvidenceFile ? path.resolve(path.dirname(path.resolve(file)), plan.priceEvidenceFile) : undefined;
  const summary = validatePlan(plan, { evidenceFile });
  if (mode === 'plan') { console.log(JSON.stringify({ ...summary, approved: plan.approved, schedule: schedule(plan).map(r => ({ ticket: r.ticket, model: r.model.id, repetition: r.repetition })) }, null, 2)); return; }
  assert.equal(mode, 'run', 'Usage: node pilot/cli.mjs plan|run [plan.json] [new-output-directory]');
  assert.equal(plan.approved, true, 'The paid plan needs Dan\'s model and spending approval.');
  validatePlan(plan, { live: true, evidenceFile });
  assert.ok(destination && !fs.existsSync(destination), 'Choose a new output directory; no automatic resume.');
  assert.equal(process.platform, 'darwin', 'macOS sandbox-exec required');
  const adapter = openAIAdapter(process.env.OPENAI_API_KEY);
  delete process.env.OPENAI_API_KEY;
  // Confirm browser access before starting a paid model attempt.
  const { connectBrowserbase } = await import('./browserbase.mjs');
  const probe = await connectBrowserbase(); await probe.close();
  fs.mkdirSync(destination, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(destination, 'plan.json'), JSON.stringify(plan, null, 2));
  const budget = { remainingUsd: plan.totalUsd }, records = [];
  for (const [index, entry] of schedule(plan).entries()) {
    const dir = path.join(destination, String(index + 1).padStart(2, '0'));
    const record = await runAttempt({ ...entry, limits: plan.limits, adapter, outputDir: dir, budget });
    // Grade after timing ends. Each browser session is bounded independently of model time.
    let connection;
    let gradingError;
    try {
      if (entry.ticket === '01') connection = await connectBrowserbase();
      if (record.submittedFiles) record.grade = await grade(path.join(dir, 'submission'), entry.ticket, { browser: connection?.browser });
    } catch (error) { record.gradingError = error.message; gradingError = error; }
    finally { if (connection) await connection.close(); }
    records.push(record);
    fs.writeFileSync(path.join(dir, 'run.json'), JSON.stringify(record, null, 2) + '\n');
    fs.writeFileSync(path.join(destination, 'results.json'), JSON.stringify({ planHash: summary.planHash, remainingReservedBudgetUsd: budget.remainingUsd,
      models: plan.models.map(m => ({ model: m.id, ...summarize(records.filter(r => r.model.id === m.id)) })), records }, null, 2) + '\n');
    console.log(`${index + 1}/${summary.attempts} ${entry.model.id} ticket ${entry.ticket}: ${record.status}, ${record.grade?.pass ? 'pass' : 'fail'}`);
    if (gradingError) throw new Error('Grading stopped; the attempt record is retained for investigation.');
    if (['provider_error', 'usage_unavailable', 'runner_error', 'model_mismatch'].includes(record.status)) throw new Error('Provider, accounting, model identity, or runner failure. Trial stopped with records retained.');
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
