import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { copyApp, appSource, dependencyPath, root, inventory, sha256 } from './workspace.mjs';
import { execute, probeSandbox } from './sandbox.mjs';
import { availablePort } from './server.mjs';
import { priceUsage, requestReserve } from './accounting.mjs';
import { visibleTests } from './visible-tests.mjs';

export const tools = [
  ['read_file', 'Read a UTF-8 file in the app.', { path: { type: 'string' } }],
  ['write_file', 'Write a complete UTF-8 app file.', { path: { type: 'string' }, content: { type: 'string' } }],
  ['run_command', 'Run a shell command in the isolated app. Use PORT for local servers. Output and duration are bounded.', { command: { type: 'string' } }],
  ['run_tests', 'Run the original visible test suite with its HTTP tests assigned the permitted loopback port.', {}],
].map(([name, description, properties]) => ({ type: 'function', name, description, strict: true,
  parameters: { type: 'object', properties, required: Object.keys(properties), additionalProperties: false } }));

export async function performTool(workspace, call, { timeoutMs, port }) {
  const args = JSON.parse(call.arguments);
  if (call.name === 'run_tests') return visibleTests(workspace, port, timeoutMs);
  if (call.name === 'run_command') {
    if (typeof args.command !== 'string' || args.command.length > 32768) throw new Error('Invalid command');
    return execute(workspace, args.command, { timeoutMs, read: [dependencyPath], port, env: { PORT: String(port) } });
  }
  if (['read_file', 'write_file'].includes(call.name)) {
    const helper = fileURLToPath(new URL('./file-tool.cjs', import.meta.url));
    const result = await execute(workspace, `${JSON.stringify(process.execPath)} ${JSON.stringify(helper)}`, {
      timeoutMs, read: [helper], input: JSON.stringify({ ...args, action: call.name }),
    });
    if (result.code !== 0) throw new Error(result.output || 'File tool failed');
    return JSON.parse(result.output).value;
  }
  throw new Error('Unknown tool');
}

export async function runAttempt({ ticket, model, limits, adapter, outputDir, budget, kind = 'live' }) {
  if (!['01', '04', '07'].includes(ticket)) throw new Error('Unsupported pilot ticket');
  if (fs.existsSync(outputDir)) throw new Error('Attempt directory already exists; automatic reruns are forbidden.');
  fs.mkdirSync(outputDir, { recursive: true, mode: 0o700 });
  const workspace = copyApp();
  const journal = (event) => fs.appendFileSync(path.join(outputDir, 'events.jsonl'), JSON.stringify(event) + '\n', { mode: 0o600 });
  let record, started;
  try {
    await probeSandbox(workspace);
    const port = await availablePort();
    const instructions = fs.readFileSync(path.join(root, 'pilot/contracts/common.md'), 'utf8') + '\nUse read_file, write_file, run_command, and run_tests. Use run_tests for the visible suite. Shell commands may access only the app and the allocated loopback port. Other network access is denied.\n';
    const prompt = fs.readFileSync(path.join(root, `tasks/tier-1-entry/tickets/${ticket}.md`), 'utf8') + '\n' + fs.readFileSync(path.join(root, `pilot/contracts/${ticket}.md`), 'utf8');
    const input = [{ role: 'user', content: prompt }];
    record = { schemaVersion: 'tti-pilot-run/1', runId: crypto.randomUUID(), kind, ticket, model,
      execution: { method: 'api', client: 'tti-responses', version: '1', billing: 'usage' },
      costBasis: 'api_list_price', timingBasis: 'runner',
      limits, prompt, instructions, taskHash: sha256(instructions + '\n' + prompt), appFiles: inventory(appSource),
      runnerFiles: inventory(path.join(root, 'pilot')), platform: { os: process.platform, node: process.version },
      startedAt: new Date().toISOString(), status: 'turn_limit', costUsd: 0, reservedUsd: 0, calls: [] };
    journal({ type: 'start', record });
    started = performance.now();
    const deadline = started + limits.attemptSeconds * 1000;
    for (let turn = 0; turn < limits.maxTurns; turn++) {
      const remaining = deadline - performance.now();
      if (remaining <= 0) { record.status = 'timeout'; break; }
      const body = { model: model.id, instructions, input, tools, parallel_tool_calls: false,
        reasoning: { effort: model.effort }, max_output_tokens: limits.maxOutputTokens,
        service_tier: 'default', store: false, include: ['reasoning.encrypted_content'], prompt_cache_key: record.runId };
      const signal = AbortSignal.timeout(Math.max(1, Math.floor(remaining)));
      let count;
      try { count = await adapter.count(body, signal); }
      catch (error) { record.status = signal.aborted ? 'timeout' : 'provider_error'; journal({ type: 'count_error', message: error.message }); break; }
      if (count > limits.maxInputTokens) { record.status = 'context_limit'; break; }
      const reserve = requestReserve(limits, model.rates);
      if (record.reservedUsd + reserve > limits.attemptUsd + 1e-9 || budget.remainingUsd + 1e-9 < reserve) { record.status = 'budget_limit'; break; }
      // Keep the full reservation after every call, including failures. Uncertain spend never funds another call.
      budget.remainingUsd -= reserve; record.reservedUsd += reserve;
      journal({ type: 'request', turn, inputTokens: count, reservedUsd: reserve, body });
      let response;
      try { response = await adapter.respond(body, signal); }
      catch (error) { record.status = signal.aborted ? 'timeout' : 'provider_error'; record.costUsd = null; journal({ type: 'provider_error', message: error.message }); break; }
      const { data, requestId } = response;
      journal({ type: 'response', turn, requestId, data });
      record.calls.push({ requestId, responseId: data.id, model: data.model, serviceTier: data.service_tier, usage: data.usage });
      if (data.model !== model.id) { record.costUsd = null; record.status = 'model_mismatch'; break; }
      try {
        if (data.usage.input_tokens > limits.maxInputTokens || data.usage.output_tokens > limits.maxOutputTokens) throw new Error('Provider exceeded the reserved token limits');
        if (data.service_tier && data.service_tier !== 'default') throw new Error('Unexpected billing tier');
        record.costUsd += priceUsage(data.usage, model.rates);
      } catch { record.costUsd = null; record.status = 'usage_unavailable'; break; }
      if (data.status !== 'completed') { record.status = data.status === 'incomplete' ? 'output_limit' : 'provider_error'; break; }
      if (!Array.isArray(data.output)) throw new Error('Provider output is missing');
      input.push(...data.output);
      const calls = data.output.filter(item => item.type === 'function_call');
      if (!calls.length) {
        record.final = data.output.filter(item => item.type === 'message').flatMap(item => item.content || []).filter(item => item.type === 'output_text').map(item => item.text).join('\n');
        record.status = record.final ? 'submitted' : 'empty_response'; break;
      }
      for (const call of calls) {
        if (performance.now() >= deadline) { record.status = 'timeout'; break; }
        let output;
        try { output = await performTool(workspace, call, { port, timeoutMs: Math.max(1, Math.min(limits.commandSeconds * 1000, deadline - performance.now())) }); }
        catch (error) { output = { error: error.message }; }
        const item = { type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(output) };
        input.push(item); journal({ type: 'tool', call, output });
      }
      if (record.status === 'timeout') break;
    }
    record.elapsedSeconds = (performance.now() - started) / 1000;
    record.finishedAt = new Date().toISOString();
    try {
      record.submittedFiles = inventory(workspace);
      const submission = path.join(outputDir, 'submission');
      fs.cpSync(workspace, submission, { recursive: true, filter: file => !path.relative(workspace, file).split(path.sep).some(p => ['node_modules', '.runner-home'].includes(p)) });
    } catch (error) { record.status = 'invalid_submission'; record.submissionError = error.message; }
    fs.writeFileSync(path.join(outputDir, 'run.json'), JSON.stringify(record, null, 2) + '\n', { mode: 0o600 });
    journal({ type: 'finished', status: record.status, elapsedSeconds: record.elapsedSeconds });
    return record;
  } catch (error) {
    journal({ type: 'runner_error', message: error.message });
    if (record) {
      record.status = 'runner_error'; record.elapsedSeconds = (performance.now() - started) / 1000;
      record.finishedAt = new Date().toISOString(); record.error = error.message;
      fs.writeFileSync(path.join(outputDir, 'run.json'), JSON.stringify(record, null, 2) + '\n', { mode: 0o600 });
      return record;
    }
    throw error;
  } finally { fs.rmSync(workspace, { recursive: true, force: true }); }
}
