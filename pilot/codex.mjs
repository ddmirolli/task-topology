import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { exportTask, gradeExternal } from './external.mjs';
import { copyApp, root, dependencyPath, inventory, sha256 } from './workspace.mjs';
import { availablePort } from './server.mjs';
import { summarize } from './accounting.mjs';
import { codexAccount, requireAllowance } from './codex-account.mjs';

const toml = value => value && typeof value === 'object' && !Array.isArray(value)
  ? '{' + Object.entries(value).map(([key, v]) => JSON.stringify(key) + '=' + toml(v)).join(',') + '}'
  : Array.isArray(value) ? '[' + value.map(toml).join(',') + ']' : JSON.stringify(value);
export const configArgs = config => Object.entries(config).flatMap(([key, value]) => ['-c', `${key}=${toml(value)}`]);
export function codexConfig(workspace, port, commandSeconds, effort) {
  return { model_provider: 'openai', forced_login_method: 'chatgpt', model_reasoning_effort: effort,
    approval_policy: 'never', default_permissions: 'tti', project_doc_max_bytes: 0,
    web_search: 'disabled', tools: { view_image: false },
    features: { shell_tool: false, unified_exec: false, apps: false, plugins: false, hooks: false, multi_agent: false, shell_snapshot: false, in_app_browser: false, in_app_local_automation: false,
      skill_search: false, skip_host_skill_discovery: true },
    shell_environment_policy: { inherit: 'none', set: { PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin`,
      TMPDIR: path.join(workspace, '.runner-home'), NODE_ENV: 'test', TZ: 'UTC' } },
    permissions: { tti: { filesystem: { ':minimal': 'read',
      ...Object.fromEntries(['/System', '/usr', '/bin', '/sbin', '/Library/Apple', '/dev', path.dirname(path.dirname(process.execPath)), dependencyPath].map(p => [p, 'read'])),
      [workspace]: 'write', [path.join(os.homedir(), '.codex')]: 'deny' }, network: { enabled: false } } },
    mcp_servers: { tti: { command: process.execPath,
      args: [path.join(root, 'pilot/mcp-stdio.mjs'), workspace, String(port), String(commandSeconds * 1000)],
      required: true, default_tools_approval_mode: 'approve', startup_timeout_sec: 20, tool_timeout_sec: commandSeconds + 5 } } };
}
export function probeCodex(workspace, config, binary = 'codex') {
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'tti-codex-denied-'));
  const sentinel = path.join(outside, 'answer'); fs.writeFileSync(sentinel, 'PRIVATE-SENTINEL');
  try {
    const script = `const fs=require('fs');let denied=false;try{fs.readFileSync(${JSON.stringify(sentinel)})}catch(e){denied=['EPERM','EACCES'].includes(e.code)}if(!denied)process.exit(9);fs.writeFileSync('probe-ok','ok');try{fs.writeFileSync(${JSON.stringify(path.join(dependencyPath, 'tti-denied-write'))},'bad');process.exit(10)}catch(e){if(!['EPERM','EACCES'].includes(e.code))throw e}console.log('isolated');`;
    const result = spawnSync(binary, ['sandbox', '-P', 'tti', '-C', workspace,
      ...configArgs({ default_permissions: 'tti', permissions: config.permissions }), process.execPath, '-e', script],
    { encoding: 'utf8', timeout: 15000 });
    assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout.trim(), 'isolated');
    fs.unlinkSync(path.join(workspace, 'probe-ok'));
    return { fileIsolation: 'passed', dependencyProtection: 'passed' };
  } finally { fs.rmSync(outside, { recursive: true, force: true }); }
}
export async function runCodex({ ticket, model, effort = 'medium', outputDir, attemptSeconds = 900, commandSeconds = 30, binary = 'codex', browser }) {
  assert.ok(typeof model === 'string' && model.trim(), 'Model ID required');
  assert.ok(!fs.existsSync(outputDir), 'Choose a new output directory');
  assert.ok(Number.isFinite(attemptSeconds) && attemptSeconds > 0 && Number.isFinite(commandSeconds) && commandSeconds > 0);
  const account = await codexAccount(binary);
  requireAllowance(account);
  const version = spawnSync(binary, ['--version'], { encoding: 'utf8', timeout: 10000 }).stdout.trim();
  fs.mkdirSync(outputDir, { recursive: true, mode: 0o700 });
  const packet = path.join(outputDir, 'packet');
  const manifest = exportTask(ticket, packet), workspace = copyApp(path.join(packet, 'task/app'));
  fs.mkdirSync(path.join(workspace, '.runner-home'), { recursive: true });
  let child;
  const kill = () => { if (child?.pid) { try { process.kill(-child.pid, 'SIGKILL'); } catch {} } };
  try {
    const config = codexConfig(workspace, await availablePort(), commandSeconds, effort);
    const preflight = { account, ...probeCodex(workspace, config, binary) };
    const prompt = fs.readFileSync(path.join(packet, 'task/instructions.md'), 'utf8') + '\n'
      + fs.readFileSync(path.join(packet, 'task/ticket.md'), 'utf8')
      + '\nExecution notes: use the tti MCP tools for app work. Use mcp__tti__run_tests for the visible tests; ordinary shell commands are offline. Work only in the supplied app. Finish within the declared time limit.\n';
    const args = ['exec', '--ignore-user-config', '--ignore-rules', '--ephemeral', '--skip-git-repo-check',
      '--json', '--color', 'never', '-C', workspace, '-m', model, ...configArgs(config), '-'];
    const execution = { method: 'subscription', client: 'codex-cli', version, billing: 'included_allowance',
      settings: { model, effort, webSearch: false, skills: false, plugins: false },
      limits: { attemptSeconds, commandSeconds, stdoutBytes: 20_000_000 }, isolation: 'Codex permission profile and TTI sandboxed MCP tools' };
    fs.writeFileSync(path.join(outputDir, 'launch.json'), JSON.stringify({ execution, args, preflight, prompt,
      promptHash: sha256(prompt), runnerFiles: inventory(path.join(root, 'pilot')) }, null, 2), { mode: 0o600 });
    const env = { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: path.join(workspace, '.runner-home'), LANG: 'en_US.UTF-8' };
    if (process.env.CODEX_HOME) env.CODEX_HOME = process.env.CODEX_HOME;
    const startedAt = new Date().toISOString(), start = performance.now();
    child = spawn(binary, args, { cwd: workspace, env, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '', outcome, timer;
    const exit = await new Promise(resolve => {
      const finish = code => { clearTimeout(timer); resolve(code); };
      child.on('error', error => { stderr += error.message; outcome = 'provider_error'; finish(null); });
      child.on('close', finish);
      child.stdout.on('data', chunk => {
        stdout += chunk; fs.appendFileSync(path.join(outputDir, 'events.jsonl'), chunk, { mode: 0o600 });
        if (Buffer.byteLength(stdout) > 20_000_000) { outcome = 'provider_error'; kill(); finish(null); }
      });
      child.stderr.on('data', chunk => { stderr += chunk; if (Buffer.byteLength(stderr) > 1_000_000) { outcome = 'provider_error'; kill(); finish(null); } });
      timer = setTimeout(() => { outcome = 'timeout'; kill(); finish(null); }, attemptSeconds * 1000);
      child.stdin.on('error', () => {}); child.stdin.end(prompt);
    });
    const elapsedSeconds = (performance.now() - start) / 1000, finishedAt = new Date().toISOString();
    kill(); child.stdout.destroy(); child.stderr.destroy(); child.stdin.destroy();
    fs.writeFileSync(path.join(outputDir, 'stderr.log'), stderr, { mode: 0o600 });
    const events = stdout.split('\n').filter(Boolean).flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
    const completed = events.filter(e => e.type === 'turn.completed').at(-1);
    const toolTransportFailure = events.some(e => e.type === 'item.completed' && e.item?.type === 'mcp_tool_call' && e.item.error);
    const nativeToolUsed = events.some(e => ['command_execution', 'file_change', 'web_search'].includes(e.item?.type));
    const status = outcome ?? (nativeToolUsed ? 'invalid_execution' : exit === 0 && completed && !toolTransportFailure ? 'submitted' : 'provider_error');
    const receipt = { version: 'tti-external-receipt/1', runId: manifest.runId, taskHash: manifest.taskHash,
      model: { id: model, vendor: 'OpenAI', reasoning_setting: effort }, execution, status, elapsedSeconds,
      startedAt, finishedAt, transcript: stdout || stderr || 'Client produced no transcript', usage: completed?.usage ?? null,
      cost: null, exitCode: exit, timingSource: 'parent_monotonic_clock', identitySource: 'requested CLI model; exact backend snapshot unverified' };
    fs.writeFileSync(path.join(outputDir, 'receipt.json'), JSON.stringify(receipt, null, 2), { mode: 0o600 });
    let connection, record;
    try {
      if (ticket === '01' && !browser) {
        const { connectBrowserbase } = await import('./browserbase.mjs');
        connection = await connectBrowserbase();
      }
      record = await gradeExternal({ packet, submission: workspace, receipt, outputDir: path.join(outputDir, 'result'), browser: browser ?? connection?.browser });
      record.browserSessionId = connection?.sessionId ?? null;
    } finally { if (connection) await connection.close(); }
    record.timingBasis = 'runner';
    record.timingEvidence = { source: 'parent_monotonic_clock', startedAt, finishedAt, elapsedSeconds };
    record.executionEvidence = { nativeToolUsed, toolTransportFailure, clientExitCode: exit, terminalEvent: Boolean(completed) };
    record.metrics = summarize([record]);
    fs.writeFileSync(path.join(outputDir, 'result/run.json'), JSON.stringify(record, null, 2) + '\n', { mode: 0o600 });
    return { status, pass: record.grade?.pass ?? null, elapsedSeconds, usage: receipt.usage, outputDir, browserSessionId: record.browserSessionId, gradingError: record.gradingError };
  } finally { kill(); fs.rmSync(workspace, { recursive: true, force: true }); }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [ticket, model, outputDir] = process.argv.slice(2);
  console.log(JSON.stringify(await runCodex({ ticket, model, outputDir }), null, 2));
}
