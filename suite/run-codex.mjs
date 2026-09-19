import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { root, temp, stop, capture } from '../.build/core/runtime.js';
import { prepareManagement } from '../.build/core/management.js';
import { gradeEntry } from '../.build/core/entry.js';
import { codexConfig, configArgs, collectSession, probeCodex } from '../pilot/codex.mjs';
import { codexAccount, requireAllowance } from '../pilot/codex-account.mjs';
import { inventory, sha256 } from '../pilot/workspace.mjs';
import { sessionEvidence } from '../pilot/session-evidence.mjs';

export async function runSuiteAttempt({ task, model, effort = 'medium', output, attemptSeconds }) {
  assert.ok(['entry-python', 'entry-go', 'management'].includes(task), 'Executive model trials are deferred');
  assert.ok(model && !fs.existsSync(output));
  const limit = task === 'management' ? 3600 : 900;
  attemptSeconds ??= limit;
  assert.ok(Number.isInteger(attemptSeconds) && attemptSeconds > 0 && attemptSeconds <= limit);
  const account = await codexAccount(); requireAllowance(account);
  fs.mkdirSync(output, { recursive: true, mode: 0o700 });
  const home = temp('mtb-suite-client-'); let management, child;
  try {
    let workspace, port = 0;
    if (task === 'management') { management = await prepareManagement(output); workspace = management.workspace; port = management.port; }
    else { workspace = path.join(fs.realpathSync(output), 'workspace'); fs.cpSync(path.join(root, 'tasks/tier-1-entry/polyglot', task.slice(6)), workspace, { recursive: true }); }
    workspace = fs.realpathSync(workspace); fs.mkdirSync(path.join(workspace, '.runner-home'));
    fs.symlinkSync(path.join(process.env.CODEX_HOME ?? path.join(os.homedir(), '.codex'), 'auth.json'), path.join(home, 'auth.json'));
    const config = codexConfig(workspace, port || 1, 30, effort, home);
    config.permissions.mtb.filesystem['/opt/homebrew/Cellar'] = 'read';
    config.permissions.mtb.filesystem['/opt/homebrew/opt'] = 'read';
    config.mcp_servers.mtb.args = [path.join(root, 'suite/mcp-stdio.mjs'), workspace, String(port), '30000'];
    const isolation = probeCodex(workspace, config);
    const taskFiles = inventory(workspace);
    const prompt = fs.readFileSync(path.join(workspace, 'TASK.md'), 'utf8') + '\nUse mtb.run_command for all reads, edits, and tests. Native apply_patch may edit only this workspace. Shell commands are offline except the supplied task database.\n';
    const clientVersion = spawnSync('codex', ['--version'], { encoding: 'utf8' }).stdout.trim();
    const args = ['exec', '--ignore-user-config', '--ignore-rules', '--skip-git-repo-check', '--json', '--color', 'never', '-C', workspace, '-m', model, ...configArgs(config), '-'];
    const write = (name, value) => fs.writeFileSync(path.join(output, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2), { flag: 'wx', mode: 0o600 });
    write('launch.json', { version: 'mtb-suite-launch/2', task, model, effort, clientVersion, account, isolation, taskFiles,
      taskHash: sha256(JSON.stringify(taskFiles)), prompt, promptHash: sha256(prompt), limits: { attemptSeconds, commandSeconds: 30 }, access: 'included_allowance', retryPolicy: 'none' });
    const startedAt = new Date().toISOString(), start = performance.now();
    child = spawn('codex', args, { cwd: workspace, detached: true, stdio: ['pipe', 'pipe', 'pipe'],
      env: { PATH: process.env.PATH, HOME: home, CODEX_HOME: home, TMPDIR: path.join(workspace, '.runner-home'), LANG: 'en_US.UTF-8' } });
    const result = await capture(child, prompt, attemptSeconds * 1000), elapsedSeconds = (performance.now() - start) / 1000, finishedAt = new Date().toISOString();
    write('events.jsonl', result.stdout); write('stderr.log', result.stderr);
    const events = result.stdout.trim().split('\n').flatMap(s => { try { return [JSON.parse(s)]; } catch { return []; } });
    let source, captureError = null;
    try { const session = collectSession(events, startedAt, finishedAt, path.join(home, 'sessions')); write('session.jsonl', session.bytes.toString()); source = sessionEvidence(session.bytes, prompt); }
    catch (e) { captureError = e.message; }
    const status = result.timedOut ? 'timeout' : result.code !== 0 || result.overflow ? 'provider_error'
      : !source?.contextMatches || source.rejectedNativePatches.length || !events.some(e => e.type === 'turn.completed') ? 'invalid_execution' : 'submitted';
    let grade = null, gradingError = null;
    try { grade = management ? management.grade() : await gradeEntry(task.slice(6), workspace); }
    catch (error) { gradingError = error.message; }
    const receipt = { version: 'mtb-suite-receipt/2', task, model, effort, clientVersion, startedAt, finishedAt, elapsedSeconds,
      status, source, captureError, grade, gradingError, usage: events.findLast(e => e.type === 'turn.completed')?.usage ?? null, costUsd: null,
      transcriptHash: sha256(result.stdout), fullPass: null, comparisonEligible: false };
    write('receipt.json', receipt); return receipt;
  } finally { if (child) stop(child); if (management) management.close(); fs.rmSync(home, { recursive: true, force: true }); }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [task, model, output] = process.argv.slice(2);
  console.log(JSON.stringify(await runSuiteAttempt({ task, model, output })));
}
