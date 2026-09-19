import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { codexAccount, requireAllowance } from './codex-account.mjs';
import { codexConfig, probeCodex, nativeExecution, collectSession } from './codex.mjs';
import { copyApp, root } from './workspace.mjs';

const temporary = t => { const p = fs.mkdtempSync(path.join(os.tmpdir(), 'mtb-codex-test-')); t.after(() => fs.rmSync(p, { recursive: true, force: true })); return p; };

test('subscription preflight reads metadata without exposing account identity or authorizing credits', async t => {
  const dir = temporary(t), fake = path.join(dir, 'client');
  fs.writeFileSync(fake, `#!${process.execPath}\nconst rl=require('readline').createInterface({input:process.stdin});rl.on('line',l=>{const q=JSON.parse(l);if(q.id==null)return;let result;if(q.method==='initialize')result={};else if(q.method==='account/read')result={account:{type:'chatgpt',planType:'pro',email:'PRIVATE',id:'PRIVATE'}};else if(q.method==='account/rateLimits/read')result={ordinaryUsageAllowed:true,accountId:'PRIVATE',rateLimits:{primary:{usedPercent:12},credits:{hasCredits:false}}};else if(q.method==='model/list')result={data:[{id:'any-model',model:'any-model',supportedReasoningEfforts:[]}]};else process.exit(9);process.stdout.write(JSON.stringify({id:q.id,result})+'\\n')});`, { mode: 0o700 });
  const account = await codexAccount(fake);
  requireAllowance(account); assert.doesNotMatch(JSON.stringify(account), /PRIVATE/);
  assert.throws(() => requireAllowance({ ...account, auth: 'apiKey' }), /Subscription login/);
  assert.throws(() => requireAllowance({ ...account, ordinaryUsageAllowed: null }), /could not be confirmed/);
  for (const hasCredits of [true, null, undefined]) assert.throws(() => requireAllowance({ ...account, windows: [{ id: 'codex', primary: { usedPercent: 12 }, hasCredits }] }), /no credit or API fallback/);
  for (const usedPercent of [90, 100, undefined, '12', NaN, -1]) assert.throws(() => requireAllowance({ ...account, windows: [{ id: 'codex', primary: { usedPercent }, hasCredits: false }] }), /no credit or API fallback/);
});

test('MCP transport executes isolated tools and rejects an outside write', { skip: process.platform !== 'darwin' }, async t => {
  const dir = copyApp(); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const child = spawn(process.execPath, [path.join(root, 'pilot/mcp-stdio.mjs'), dir, '43219', '3000'], { stdio: ['pipe', 'pipe', 'pipe'] });
  let out = '', err = ''; child.stdout.on('data', b => out += b); child.stderr.on('data', b => err += b);
  child.stdin.end([
    { id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05' } },
    { id: 2, method: 'tools/list' },
    { id: 3, method: 'tools/call', params: { name: 'write_file', arguments: { path: 'transport-fixture', content: 'recorded' } } },
    { id: 4, method: 'tools/call', params: { name: 'read_file', arguments: { path: 'transport-fixture' } } },
    { id: 5, method: 'tools/call', params: { name: 'write_file', arguments: { path: '../escape', content: 'bad' } } },
  ].map(q => JSON.stringify({ jsonrpc: '2.0', ...q })).join('\n') + '\n');
  const timer = setTimeout(() => child.kill('SIGKILL'), 10000);
  const code = await new Promise(resolve => child.on('close', resolve)); clearTimeout(timer);
  assert.equal(code, 0, err);
  const responses = out.trim().split('\n').map(JSON.parse);
  assert.equal(responses.find(r => r.id === 2).result.tools.length, 4);
  assert.match(responses.find(r => r.id === 4).result.content[0].text, /recorded/);
  assert.equal(responses.find(r => r.id === 5).result.isError, true);
  assert.equal(fs.readFileSync(path.join(dir, 'transport-fixture'), 'utf8'), 'recorded');
});

// This uses the installed client's sandbox and makes no inference request.
test('installed native client respects workspace and dependency boundaries', { skip: process.platform !== 'darwin' || process.env.MTB_TEST_CODEX !== '1' }, t => {
  const dir = copyApp(); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const config = codexConfig(dir, 43219, 3, 'medium');
  assert.equal(config.memories.use_memories, false);
  assert.equal(config.features.memories, false);
  assert.equal(probeCodex(dir, config).fileIsolation, 'passed');
  assert.equal(fs.existsSync(path.join(dir, 'probe-ok')), false);
});

test('native edit evidence accepts app paths and rejects escape paths or native shell', t => {
  const dir = temporary(t), outside = temporary(t);
  fs.symlinkSync(outside, path.join(dir, 'escape'));
  const event = file => [{ type: 'item.completed', item: { type: 'file_change', status: 'completed', changes: [{ path: file, kind: 'update' }] } }];
  assert.equal(nativeExecution(event(path.join(dir, 'new/file.js')), dir).nativeToolUsed, false);
  for (const file of [path.join(dir, 'escape/secret'), path.join(dir, 'node_modules/pkg.js'), path.join(outside, 'file'), 'relative.js']) {
    assert.equal(nativeExecution(event(file), dir).nativeToolUsed, true);
  }
  assert.equal(nativeExecution([{ item: { type: 'command_execution' } }], dir).nativeToolUsed, true);
});

test('full session collection binds one dated record to the requested thread', t => {
  const dir = temporary(t), day = path.join(dir, '2026/09/18'); fs.mkdirSync(day, { recursive: true });
  const id = '12345678-1234-1234-1234-123456789abc', events = [{ type: 'thread.started', thread_id: id }];
  const start = '2026-09-19T01:00:00Z', finish = '2026-09-19T01:01:00Z';
  const content = [{ type: 'session_meta', payload: { id } }, { type: 'response_item', payload: { type: 'custom_tool_call', input: 'retained' } }].map(JSON.stringify).join('\n');
  const file = path.join(day, `rollout-${id}.jsonl`); fs.writeFileSync(file, content);
  assert.equal(collectSession(events, start, finish, dir).bytes.toString(), content);
  fs.writeFileSync(path.join(day, `duplicate-${id}.jsonl`), content);
  assert.throws(() => collectSession(events, start, finish, dir), /exactly one/);
  fs.unlinkSync(path.join(day, `duplicate-${id}.jsonl`));
  fs.writeFileSync(file, content.replace(id, 'wrong'));
  assert.throws(() => collectSession(events, start, finish, dir), /identity differs/);
});

test('session evidence rejects injected instructions and rejected native patches', async () => {
  const { sessionEvidence } = await import('./session-evidence.mjs');
  const item = payload => ({ type: 'response_item', payload });
  const message = (role, text) => item({ type: 'message', role, content: [{ type: 'input_text', text }] });
  const prompt = 'Fix the supplied task.';
  const base = [message('user', '<environment_context>fixture</environment_context>'), message('user', prompt)];
  const inspect = extra => sessionEvidence([...base, ...extra].map(JSON.stringify).join('\n'), prompt);
  assert.equal(inspect([]).contextMatches, true);
  assert.equal(inspect([message('user', '# AGENTS.md personal instructions')]).contextMatches, false);
  assert.equal(inspect([message('developer', '### Available skills\n- personal skill')]).contextMatches, false);
  const call = item({ type: 'custom_tool_call', name: 'exec', call_id: 'patch', input: 'await tools.apply_patch("patch");' });
  const output = item({ type: 'custom_tool_call_output', call_id: 'patch', output: 'Script error: apply_patch verification failed: Operation not permitted' });
  assert.deepEqual(inspect([call, output]).rejectedNativePatches, ['patch']);
  const aliasRejection = item({ type: 'custom_tool_call_output', call_id: 'patch', output: 'patch rejected: writing outside of the project; rejected by user approval settings' });
  assert.deepEqual(inspect([call, aliasRejection]).rejectedNativePatches, ['patch']);
  for (const text of [
    'apply_patch verification failed: invalid patch: multiple operations target /workspace/routes/clients.js',
    'apply_patch verification failed: Failed to find expected lines in /workspace/example.js',
    'apply_patch failed: invalid patch format',
  ]) {
    const ordinaryError = item({ type: 'custom_tool_call_output', call_id: 'patch', output: text });
    assert.deepEqual(inspect([call, ordinaryError]).rejectedNativePatches, []);
  }
  assert.equal(inspect([]).customCodeInterpretation, 'requires_review');
});

test('an unfinished native edit cannot pass the execution check', t => {
  const dir = temporary(t);
  assert.equal(nativeExecution([{ type: 'item.started', item: { id: 'unfinished', type: 'file_change' } }], dir).nativeToolUsed, true);
});
