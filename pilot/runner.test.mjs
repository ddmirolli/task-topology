import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { copyApp, dependencyPath, root } from './workspace.mjs';
import { execute, probeSandbox } from './sandbox.mjs';
import { runAttempt, performTool } from './run.mjs';
import { priceUsage, requestReserve, summarize } from './accounting.mjs';
import { validatePlan, schedule } from './cli.mjs';
import { openAIAdapter } from './openai.mjs';
import { grade } from './grade.mjs';
import { fixture } from './fixtures.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('./proposal.json', import.meta.url)));
const model = plan.models[1];
const usage = { input_tokens: 1000, output_tokens: 100, input_tokens_details: { cached_tokens: 400, cache_write_tokens: 200 } };
const response = output => ({ data: { id: 'fixture-response', model: model.id, status: 'completed', usage, output }, requestId: 'fixture-request' });
const final = [{ type: 'message', content: [{ type: 'output_text', text: 'Finished the requested change.' }] }];
const temporary = t => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tti-runner-test-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true })); return dir; };

test('the 18-attempt schedule is balanced and fits the proposed cap', () => {
  assert.ok(Math.abs(validatePlan(plan).maximumUsd - 38.016) < 1e-9);
  const entries = schedule(plan); assert.equal(entries.length, 18);
  for (const m of plan.models) for (const ticket of plan.tickets) assert.equal(entries.filter(e => e.model.id === m.id && e.ticket === ticket).length, 3);
  assert.notEqual(entries[0].model.id, entries[2].model.id);
  assert.throws(() => validatePlan({ ...plan, totalUsd: 1 }));
  for (const changed of [{ priceSource: undefined }, { priceDate: 'bad' }, { priceEvidenceHash: 'wrong' }]) assert.throws(() => validatePlan({ ...plan, ...changed }));
  const evidence = JSON.parse(fs.readFileSync(new URL('./price-evidence.json', import.meta.url)));
  assert.throws(() => validatePlan(plan, { live: true, now: Date.parse(evidence.retrievedAt) + 49 * 3600_000 }), /Refresh price evidence/);
});
test('cache reads and writes use separate, non-additive prices', () => {
  assert.equal(priceUsage(usage, model.rates), .00258);
  assert.throws(() => priceUsage({ ...usage, input_tokens_details: { cached_tokens: 1 } }, model.rates));
  assert.throws(() => priceUsage({ ...usage, input_tokens: -1 }, model.rates));
});
test('failures count toward speed and cost, and missing cost stays unavailable', () => {
  const records = [{ status: 'submitted', grade: { pass: true }, elapsedSeconds: 60, costUsd: 1 }, { status: 'timeout', elapsedSeconds: 60, costUsd: 1 }];
  assert.equal(summarize(records).correctPerHour, 30); assert.equal(summarize(records).correctPerDollar, .5);
  assert.equal(summarize(records.map(r => ({ ...r, elapsedSeconds: r.elapsedSeconds * 2 }))).correctPerHour, 15);
  assert.equal(summarize([{ ...records[0], costUsd: null }]).correctPerDollar, null);
});
test('adapter preserves request IDs, usage, and the fixed API destination', async () => {
  const calls = [];
  const adapter = openAIAdapter('fixture-key', { transport: async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return new Response(JSON.stringify(url.endsWith('input_tokens') ? { input_tokens: 123 } : response(final).data), { headers: { 'x-request-id': 'test-id' } });
  } });
  assert.equal(await adapter.count({ model: model.id }), 123);
  assert.equal((await adapter.respond({ model: model.id })).requestId, 'test-id');
  assert.ok(calls.every(c => c.url.startsWith('https://api.openai.com/v1/responses')));
});
test('file tools reject path traversal, dangling symlinks, and hard links', { skip: process.platform !== 'darwin' }, async t => {
  const dir = temporary(t);
  fs.symlinkSync('/etc', path.join(dir, 'escape'));
  fs.symlinkSync(path.join(dir, 'missing-target'), path.join(dir, 'dangling'));
  fs.writeFileSync(path.join(dir, 'original'), 'unchanged'); fs.linkSync(path.join(dir, 'original'), path.join(dir, 'hardlink'));
  for (const p of ['../answer', '/etc/passwd', 'escape/passwd', 'node_modules/x', 'dangling', 'hardlink']) {
    await assert.rejects(() => performTool(dir, { name: 'write_file', arguments: JSON.stringify({ path: p, content: 'changed' }) }, { timeoutMs: 1000 }));
  }
  assert.equal(fs.readFileSync(path.join(dir, 'original'), 'utf8'), 'unchanged');
});
test('sandbox blocks host answers, dependency writes, inherited keys, and excess output', { skip: process.platform !== 'darwin' }, async t => {
  const dir = copyApp(); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  await probeSandbox(dir);
  const result = await execute(dir, `cat '${root}/tasks/tier-1-entry/solutions/01.patch'; env; node -e "require('fs').writeFileSync('node_modules/tti-escape','bad')"`, { read: [dependencyPath] });
  assert.doesNotMatch(result.output, /a\/public\/theme\.css|OPENAI_API_KEY=|OP_SERVICE_ACCOUNT_TOKEN=/);
  assert.notEqual(result.code, 0); assert.ok(!fs.existsSync(path.join(dependencyPath, 'tti-escape')));
  const processRead = await execute(dir, `ps eww -p ${process.pid}`);
  assert.notEqual(processRead.code, 0, 'cannot inspect the parent process environment');
  assert.equal((await execute(dir, 'yes', { maxBytes: 512 })).outputLimited, true);
  assert.equal((await execute(dir, 'sleep 10', { timeoutMs: 30 })).timedOut, true);
  const begin = performance.now();
  const detached = await execute(dir, `node -e "require('child_process').spawn('/bin/sleep',['2'],{detached:true,stdio:'inherit'}).unref()"`, { timeoutMs: 100 });
  assert.equal(detached.timedOut, true); assert.ok(performance.now() - begin < 1500, 'inherited pipes cannot defeat the timeout');
});
test('recorded tool loop edits an app and passes external grading without a model call', { skip: process.platform !== 'darwin' }, async t => {
  const dir = temporary(t), good = fixture('07', 'alternative'); t.after(() => fs.rmSync(good, { recursive: true, force: true }));
  const files = ['lib/calendar-status.js', 'routes/invoices.js', 'jobs/remind-overdue.js']; let turn = 0;
  const adapter = { count: async () => 1000, respond: async () => turn < files.length
    ? response([{ type: 'function_call', call_id: `call-${turn}`, name: 'write_file', arguments: JSON.stringify({ path: files[turn], content: fs.readFileSync(path.join(good, files[turn++]), 'utf8') }) }]) : response(final) };
  const outputDir = path.join(dir, 'attempt');
  const record = await runAttempt({ ticket: '07', model, limits: plan.limits, adapter, outputDir, budget: { remainingUsd: 4 }, kind: 'synthetic' });
  assert.equal(record.status, 'submitted'); assert.equal(record.kind, 'synthetic'); assert.equal(record.calls.length, 4);
  assert.ok(record.elapsedSeconds > 0); assert.equal(record.costUsd, .01032);
  assert.equal((await grade(path.join(outputDir, 'submission'), '07')).pass, true);
  assert.equal(JSON.parse(fs.readFileSync(path.join(outputDir, 'run.json'))).taskHash, record.taskHash);
  await assert.rejects(() => runAttempt({ ticket: '07', model, limits: plan.limits, adapter, outputDir, budget: { remainingUsd: 4 } }), /already exists/);
});
test('budget reservation prevents a call and survives a provider failure', { skip: process.platform !== 'darwin' }, async t => {
  const dir = temporary(t); let calls = 0;
  const adapter = { count: async () => 1000, respond: async () => { calls++; throw new Error('fixture transport failure'); } };
  const run = (name, budget) => runAttempt({ ticket: '07', model, limits: plan.limits, adapter, outputDir: path.join(dir, name), budget, kind: 'synthetic' });
  assert.equal((await run('blocked', { remainingUsd: .01 })).status, 'budget_limit'); assert.equal(calls, 0);
  const budget = { remainingUsd: 4 }, failed = await run('failed', budget);
  assert.equal(failed.status, 'provider_error'); assert.equal(failed.costUsd, null);
  assert.equal(budget.remainingUsd, 4 - requestReserve(plan.limits, model.rates)); assert.equal(calls, 1);
});
test('a different returned model cannot score under the requested model', { skip: process.platform !== 'darwin' }, async t => {
  const dir = temporary(t);
  const adapter = { count: async () => 1000, respond: async () => ({ ...response(final), data: { ...response(final).data, model: 'another-model' } }) };
  const record = await runAttempt({ ticket: '07', model, limits: plan.limits, adapter, outputDir: path.join(dir, 'mismatch'), budget: { remainingUsd: 4 }, kind: 'synthetic' });
  assert.equal(record.status, 'model_mismatch'); assert.equal(record.costUsd, null);
  assert.equal(record.calls[0].model, 'another-model');
});
