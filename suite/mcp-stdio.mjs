import readline from 'node:readline';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { isolated, capture } from '../.build/core/runtime.js';
const [workspaceArg, portText = '0', timeoutText = '30000'] = process.argv.slice(2);
const workspace = fs.realpathSync(workspaceArg), port = Number(portText), timeout = Number(timeoutText);
assert.ok(Number.isSafeInteger(port) && port >= 0 && port <= 65535);
assert.ok(Number.isSafeInteger(timeout) && timeout > 0 && timeout <= 120000);
const env = port ? { MTB_CRM_PORT: String(port), PGPORT: String(port) } : {};
for await (const line of readline.createInterface({ input: process.stdin })) {
  let request;
  try {
    request = JSON.parse(line); if (request.id == null) continue;
    let result;
    if (request.method === 'initialize') result = { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'mtb-suite', version: '2' } };
    else if (request.method === 'ping') result = {};
    else if (request.method === 'tools/list') result = { tools: [{ name: 'run_command', description: 'Run an offline shell command inside the task workspace. Read, edit, and test files here. Only the task CRM port is reachable when supplied.', inputSchema: { type: 'object', properties: { command: { type: 'string', maxLength: 20000 } }, required: ['command'], additionalProperties: false } }] };
    else if (request.method === 'tools/call') {
      assert.equal(request.params.name, 'run_command'); const command = request.params.arguments?.command;
      assert.ok(typeof command === 'string' && command.length <= 20000);
      const value = await capture(isolated(workspace, '/bin/sh', ['-c', command], port ? [port] : [], env), '', timeout);
      result = { content: [{ type: 'text', text: JSON.stringify(value) }] };
    } else throw new Error('Unsupported MCP method');
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }) + '\n');
  } catch (error) {
    if (request?.id != null) process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, error: { code: -32603, message: error.message } }) + '\n');
  }
}
