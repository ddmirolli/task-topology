import readline from 'node:readline';
import { performTool, tools } from './run.mjs';
const [workspace, portText, timeoutText] = process.argv.slice(2);
const port = Number(portText), timeoutMs = Number(timeoutText);
if (!workspace || !Number.isSafeInteger(port) || !Number.isSafeInteger(timeoutMs)) throw new Error('Workspace, port, and timeout required');
const input = readline.createInterface({ input: process.stdin });
for await (const line of input) {
  let request;
  try {
    request = JSON.parse(line);
    if (request.id == null) continue;
    let result;
    if (request.method === 'initialize') result = { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'mtb', version: '1' } };
    else if (request.method === 'ping') result = {};
    else if (request.method === 'tools/list') result = { tools: tools.map(t => ({ name: t.name, description: t.description, inputSchema: t.parameters })) };
    else if (request.method === 'tools/call') {
      try {
        const value = await performTool(workspace, { name: request.params.name, arguments: JSON.stringify(request.params.arguments ?? {}) }, { port, timeoutMs });
        result = { content: [{ type: 'text', text: JSON.stringify(value) }] };
      } catch (error) { result = { isError: true, content: [{ type: 'text', text: error.message }] }; }
    } else throw new Error('Unsupported MCP method');
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }) + '\n');
  } catch (error) {
    if (request?.id != null) process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: request.id, error: { code: -32603, message: error.message } }) + '\n');
  }
}
