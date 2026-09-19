import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { root, inventory, sha256 } from '../pilot/workspace.mjs';
import { tool } from '../.build/core/runtime.js';

export function suiteManifest() {
  const files = {};
  for (const directory of ['core', 'grading', 'pilot', 'tasks', 'suite']) {
    for (const [name, hash] of Object.entries(inventory(path.join(root, directory)))) {
      if (name.split('/').includes('__pycache__') || name.endsWith('.pyc')) continue;
      files[directory + '/' + name] = hash;
    }
  }
  for (const file of ['package.json', 'package-lock.json', 'tsconfig.json', 'GRADING.md', 'SPEC.md', 'ARCHITECTURE.md']) files[file] = sha256(fs.readFileSync(path.join(root, file)));
  return { version: 'mtb-three-tier/2', files, suiteHash: sha256(JSON.stringify(files)) };
}
export function prepareCohort(output, transcriptCalibration, reportCalibration) {
  assert.ok(!fs.existsSync(output), 'Retain every frozen plan');
  fs.mkdirSync(output, { recursive: true, mode: 0o700 });
  const manifest = suiteManifest();
  const environment = { platform: process.platform, architecture: process.arch, release: os.release(),
    cpus: os.cpus().length, memoryBytes: os.totalmem(), node: process.version,
    tools: Object.fromEntries(['go', 'python3', 'psql'].map(name => {
      const result = spawnSync(tool(name), name === 'go' ? ['version'] : ['--version'], { encoding: 'utf8' });
      assert.equal(result.status, 0); return [name, result.stdout.trim()];
    })) };
  const configurations = ['gpt-5.6-luna', 'gpt-5.6-terra'].map(model => ({ model, effort: 'medium', client: 'codex-cli',
    clientVersion: spawnSync('codex', ['--version'], { encoding: 'utf8' }).stdout?.trim() || null, access: 'included_allowance', costBasis: null }));
  const tasks = [
    ...['01', '04', '07'].map(ticket => ({ id: `entry-js-${ticket}`, tier: 1, runner: 'pilot/codex.mjs', attemptSeconds: 900 })),
    { id: 'entry-python', tier: 1, runner: 'suite/run-codex.mjs', attemptSeconds: 900 },
    { id: 'entry-go', tier: 1, runner: 'suite/run-codex.mjs', attemptSeconds: 900 },
    { id: 'management', tier: 2, runner: 'suite/run-codex.mjs', attemptSeconds: 3600 },
  ];
  const slots = [];
  for (let repetition = 1; repetition <= 2; repetition++) for (const [index, task] of tasks.entries()) {
    const order = (index + repetition) % 2 ? [0, 1] : [1, 0];
    for (const configuration of order) slots.push({ attemptId: String(slots.length + 1).padStart(2, '0'), taskId: task.id, tier: task.tier, configuration, repetition, workUnits: 1 });
  }
  const plan = { version: 'mtb-matched-cohort/2', suiteHash: manifest.suiteHash, environment,
    environmentHash: sha256(JSON.stringify(environment)), configurations, tasks, slots,
    seed: 20260919, repetitions: 2, retryPolicy: 'none', commandSeconds: 30, memory: 'off', skills: 'off', network: 'task-database-only',
    timing: 'prompt handoff to final submission or timeout; setup and independent grading excluded',
    exclusion: 'Stop on provider or environment failure. Retain all receipts. No replacement attempts without a new frozen plan.',
    apiSpendAuthorizedUsd: 0, additionalPaidUsage: 'not authorized', executiveTrials: 'deferred',
    comparison: 'within tier and identical task mix only; preserve separate execution configurations',
    readiness: 'held', holds: ['transcript judge qualification', 'report judge qualification', 'human audit', 'fresh allowance preflight'],
    publishedX: null, publishedY: null, publishedZ: null, comparisonEligible: false };
  if (transcriptCalibration && reportCalibration) {
    const transcript = JSON.parse(fs.readFileSync(path.join(transcriptCalibration, 'calibration.json')));
    const report = JSON.parse(fs.readFileSync(path.join(reportCalibration, 'calibration.json')));
    assert.equal(transcript.version, 'mtb-judge-calibration/2', 'Transcript qualification requires every expected verdict');
    assert.equal(report.version, 'mtb-report-calibration/2', 'Report qualification requires every expected verdict');
    assert.equal(transcript.calibrated, true); assert.equal(report.calibrated, true);
    const code = JSON.parse(fs.readFileSync(path.join(transcriptCalibration, 'code.json')));
    for (const [file, hash] of Object.entries(code)) assert.equal(sha256(fs.readFileSync(path.join(root, 'grading', file))), hash, 'Judge code changed since calibration');
    const reportCases = JSON.parse(fs.readFileSync(path.join(reportCalibration, 'cases.json')));
    for (const c of reportCases) {
      const launch = JSON.parse(fs.readFileSync(path.join(reportCalibration, c.id, 'launch.json')));
      assert.equal(launch.judgeCodeHash, code['judge-codex.mjs'], 'Report adapter changed since its canary');
    }
    plan.qualification = { transcript: { status: 'canary_passed', hash: sha256(JSON.stringify(transcript)) },
      report: { status: 'canary_passed', hash: sha256(JSON.stringify(report)) }, humanAudit: 'pending' };
    plan.holds = ['human audit and qualification review', 'fresh allowance preflight'];
    for (const [name, value] of [['transcript-calibration.json', transcript], ['report-calibration.json', report]]) fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2), { flag: 'wx', mode: 0o600 });
  }
  if (configurations.some(c => c.clientVersion === null)) plan.holds.push('execution client version unavailable');
  for (const [file, value] of Object.entries({ 'manifest.json': manifest, 'plan.json': plan })) fs.writeFileSync(path.join(output, file), JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return { suiteHash: manifest.suiteHash, attempts: slots.length, tiers: [1, 2], readiness: plan.readiness, output };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(JSON.stringify(prepareCohort(...process.argv.slice(2))));
