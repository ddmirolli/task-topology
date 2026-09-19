import test from 'node:test';
import assert from 'node:assert/strict';
import { transcriptFacts } from './summarize-pilot.mjs';

const call = (tool, args, result = { code: 0 }, error = null) => ({ type: 'item.completed', item: {
  id: 'fixture', type: 'mcp_tool_call', server: 'tti', tool, arguments: args,
  result: { content: [{ type: 'text', text: JSON.stringify(result) }] }, error } });
const log = events => events.map(e => JSON.stringify(e)).join('\n');

test('transcript audit distinguishes failed transport, repeated reads, and failed commands', () => {
  const events = [
    ...Array.from({ length: 6 }, () => call('read_file', { path: 'same.js' }, 'content')),
    ...Array.from({ length: 7 }, () => call('run_command', { command: 'true' })),
    ...Array.from({ length: 6 }, () => call('run_command', { command: 'false' }, { code: 1 })),
    call('run_tests', {}, null, { message: 'approval denied' }),
    { type: 'item.completed', item: { type: 'command_execution' } },
    { type: 'turn.completed', usage: { input_tokens: 1 } },
  ];
  const facts = transcriptFacts(log(events));
  assert.equal(facts.calls, 20); assert.equal(facts.failedMcpCalls, 1); assert.equal(facts.nativeCalls, 1);
  assert.deepEqual(facts.thrashCandidates.map(f => f.tool), ['read_file', 'run_command']);
  assert.equal(facts.terminalUsage.input_tokens, 1);
  assert.equal(transcriptFacts(log([events[0]])).terminalUsage, null);
});

test('started and stopped attempts cannot disappear as unstarted schedule slots', async t => {
  const fs = await import('node:fs'), os = await import('node:os'), path = await import('node:path');
  const { pilotReport } = await import('./summarize-pilot.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tti-report-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'plan.json'), JSON.stringify({ models: [{ id: 'model', effort: 'medium' }], tickets: ['07'], repetitions: 2 }));
  const prices = path.join(dir, 'prices.json'); fs.writeFileSync(prices, JSON.stringify({ source: 'https://example.invalid/prices', date: '2026-09-18', rates: {} }));
  fs.mkdirSync(path.join(dir, '01')); fs.writeFileSync(path.join(dir, '01/launch.json'), '{}');
  fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify({ records: [] }));
  let report = pilotReport(dir, prices);
  assert.deepEqual(report.attempts.map(a => a.status), ['incomplete', 'pending']);
  assert.equal(report.groups[0].attempts, 1); assert.equal(report.groups[0].correctPerHour, null);
  fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify({ records: [], stopped: { attempt: 1, message: 'runner failed' } }));
  report = pilotReport(dir, prices);
  assert.equal(report.attempts[0].status, 'runner_error');
  assert.equal(report.attempts[1].status, 'not_run');
  assert.equal(report.attempts[0].gradingError, 'runner failed'); assert.equal(report.groups[0].costUsd, null);
});

test('report binds frozen evidence, preserves malformed runs, and withholds unjustified costs', async t => {
  const fs = await import('node:fs'), os = await import('node:os'), path = await import('node:path');
  const { pilotReport } = await import('./summarize-pilot.mjs');
  const { sha256 } = await import('../pilot/workspace.mjs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tti-report-integrity-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const write = (file, data) => fs.writeFileSync(path.join(dir, file), JSON.stringify(data));
  const plan = { models: [{ id: 'model', effort: 'medium' }], tickets: ['07'], repetitions: 2 };
  write('plan.json', plan);
  const prices = { source: 'https://example.invalid/prices', date: '2026-09-18', rates: { model: { input: 2, cached: .2, cacheWrite: 2.5, output: 12 } } };
  write('prices.json', prices);
  const runnerFiles = { 'price-evidence.json': sha256(JSON.stringify(prices)), 'codex.mjs': 'frozen' };
  const progress = { planHash: sha256(JSON.stringify(plan)), frozenRunnerHash: sha256(JSON.stringify(runnerFiles)), records: [] };
  write('results.json', progress);
  const usage = { input_tokens: 1000, output_tokens: 100, cached_input_tokens: 400, cache_write_input_tokens: 0 };
  const execution = { client: 'codex-cli', settings: { model: 'model', effort: 'medium' } };
  const transcript = log([{ type: 'turn.completed', usage }]);
  const receipt = { runId: '01', model: { id: 'model', reasoning_setting: 'medium' }, execution, transcript, usage,
    status: 'submitted', taskHash: 'task', elapsedSeconds: 10 };
  const record = { runId: '01', taskHash: 'task', transcriptHash: sha256(transcript), appFiles: { 'a.js': 'old' },
    submittedFiles: { 'a.js': 'new' }, grade: { pass: true, checks: [] }, timingBasis: 'runner' };
  const launch = { execution, runnerFiles };
  for (const slot of ['01', '02']) {
    fs.mkdirSync(path.join(dir, slot, 'result'), { recursive: true });
    write(slot + '/receipt.json', { ...receipt, runId: slot }); write(slot + '/launch.json', launch); write(slot + '/result/run.json', { ...record, runId: slot });
  }
  receipt.runId = '02'; record.runId = '02';
  const report = () => pilotReport(dir, path.join(dir, 'prices.json'));
  assert.equal(report().groups[0].correctPerHour, 360);
  assert.equal(report().groups[0].costUsd, null);
  assert.equal(report().groups[0].correctPerDollar, null);
  fs.unlinkSync(path.join(dir, '02/result/run.json'));
  assert.equal(report().attempts[1].gradingError, 'No grading record');
  assert.equal(report().groups[0].correctPerHour, null);
  write('02/result/run.json', record);
  const broken = '{bad json}\n' + transcript;
  write('02/receipt.json', { ...receipt, transcript: broken });
  write('02/result/run.json', { ...record, transcriptHash: sha256(broken) });
  assert.deepEqual(report().attempts[1].transcriptFacts.parseErrors, [1]);
  assert.equal(report().attempts[1].functionalPass, false);
  write('02/receipt.json', receipt); write('02/result/run.json', record);
  write('prices.json', { ...prices, date: 'changed' });
  assert.throws(report, /Price evidence differs/); write('prices.json', prices);
  write('02/launch.json', { ...launch, runnerFiles: { ...runnerFiles, 'codex.mjs': 'changed' } });
  assert.throws(report, /Runner differs/); write('02/launch.json', launch);
  write('02/result/run.json', { ...record, appFiles: { 'a.js': 'different baseline' } });
  assert.throws(report, /Task baseline changed/); write('02/result/run.json', record);
  write('02/receipt.json', { ...receipt, execution: { ...execution, client: 'other' } });
  assert.throws(report, /Receipt client differs/);
  write('02/receipt.json', { ...receipt, runId: '01' });
  assert.throws(report, /duplicate run ID/);
  write('02/receipt.json', { ...receipt, runId: 'wrong' });
  assert.throws(report, /belongs to another run/);
  fs.unlinkSync(path.join(dir, '02/receipt.json'));
  write('results.json', { ...progress, records: [{ index: 2, status: 'submitted', pass: true, elapsedSeconds: 10 }] });
  assert.equal(report().attempts[1].status, 'evidence_missing');
  assert.equal(report().attempts[1].recordedOutcome.pass, true);
  assert.equal(report().groups[0].correctPerHour, null);
});

test('native edits reset consecutive-read candidates', () => {
  const repeated = () => Array.from({ length: 5 }, () => call('read_file', { path: 'same.js' }));
  const facts = transcriptFacts(log([...repeated(), { type: 'item.completed', item: { type: 'file_change' } }, ...repeated()]));
  assert.equal(facts.nativeEditCalls, 1);
  assert.deepEqual(facts.thrashCandidates, []);
});
