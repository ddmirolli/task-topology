import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { capture } from '../.build/core/runtime.js';

test('model tool bridge executes within the workspace and denies outside evidence', { skip: process.platform !== 'darwin' }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mtb-mcp-test-')), workspace = path.join(dir, 'workspace'); fs.mkdirSync(workspace);
  const secret = path.join(dir, 'operator-secret'); fs.writeFileSync(secret, 'do-not-read');
  try {
    const request = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'run_command', arguments: { command: `printf ok > proof.txt; cat '${secret}'` } } };
    const child = spawn(process.execPath, ['suite/mcp-stdio.mjs', workspace, '0', '1000'], { stdio: ['pipe', 'pipe', 'pipe'], detached: true, env: { PATH: process.env.PATH } });
    const result = await capture(child, JSON.stringify(request) + '\n'); assert.equal(result.code, 0, result.stderr);
    const value = JSON.parse(JSON.parse(result.stdout).result.content[0].text);
    assert.notEqual(value.code, 0); assert.match(value.stderr, /Operation not permitted/); assert.ok(!value.stdout.includes('do-not-read'));
    assert.equal(fs.readFileSync(path.join(workspace, 'proof.txt'), 'utf8'), 'ok');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
