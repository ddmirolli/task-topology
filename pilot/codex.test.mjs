import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { codexAccount, requireAllowance } from './codex-account.mjs';
import { copyApp, root } from './workspace.mjs';

const temporary = t => { const p = fs.mkdtempSync(path.join(os.tmpdir(), 'tti-codex-test-')); t.after(() => fs.rmSync(p, { recursive: true, force: true })); return p; };

test('subscription preflight reads metadata without exposing account identity or authorizing credits', async t => {
  const dir = temporary(t), fake = path.join(dir, 'client');
  fs.writeFileSync(fake, `#!${process.execPath}\nconst rl=require('readline').createInterface({input:process.stdin});rl.on('line',l=>{const q=JSON.parse(l);if(q.id==null)return;let result;if(q.method==='initialize')result={};else if(q.method==='account/read')result={account:{type:'chatgpt',planType:'pro',email:'PRIVATE',id:'PRIVATE'}};else if(q.method==='account/rateLimits/read')result={ordinaryUsageAllowed:true,accountId:'PRIVATE',rateLimits:{primary:{usedPercent:12},credits:{hasCredits:false}}};else if(q.method==='model/list')result={data:[{id:'any-model',model:'any-model',supportedReasoningEfforts:[]}]};else process.exit(9);process.stdout.write(JSON.stringify({id:q.id,result})+'\\n')});`, { mode: 0o700 });
  const account = await codexAccount(fake);
  requireAllowance(account); assert.doesNotMatch(JSON.stringify(account), /PRIVATE/);
  assert.throws(() => requireAllowance({ ...account, auth: 'apiKey' }), /Subscription login/);
  assert.throws(() => requireAllowance({ ...account, ordinaryUsageAllowed: null }), /could not be confirmed/);
  for (const usedPercent of [100, undefined, '12', NaN, -1]) assert.throws(() => requireAllowance({ ...account, windows: [{ id: 'codex', primary: { usedPercent }, hasCredits: true }] }), /no credit or API fallback/);
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
