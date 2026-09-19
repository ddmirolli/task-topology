import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { appSource, root, inventory, sha256 } from './workspace.mjs';
import { summarize } from './accounting.mjs';

function taskContent(ticket) {
  assert.ok(['01', '04', '07'].includes(ticket), 'Unsupported pilot ticket');
  const instructions = fs.readFileSync(path.join(root, 'pilot/contracts/common.md'), 'utf8');
  const prompt = fs.readFileSync(path.join(root, `tasks/tier-1-entry/tickets/${ticket}.md`), 'utf8') + '\n'
    + fs.readFileSync(path.join(root, `pilot/contracts/${ticket}.md`), 'utf8');
  return { instructions, prompt, taskHash: sha256(instructions + '\n' + prompt) };
}
function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
}
export function exportTask(ticket, destination) {
  const content = taskContent(ticket);
  assert.ok(!fs.existsSync(destination), 'Choose a new task directory');
  fs.mkdirSync(destination, { recursive: true, mode: 0o700 });
  const taskDir = path.join(destination, 'task'), appDir = path.join(taskDir, 'app');
  fs.mkdirSync(appDir, { recursive: true });
  const files = inventory(appSource);
  for (const file of Object.keys(files)) {
    assert.ok(!file.split('/').some(part => ['.git', '.env'].includes(part)) && !/\.sqlite(?:-|$)/.test(file), 'Unexpected private app file');
    const target = path.join(appDir, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(appSource, file), target);
  }
  fs.writeFileSync(path.join(taskDir, 'instructions.md'), content.instructions);
  fs.writeFileSync(path.join(taskDir, 'ticket.md'), content.prompt);
  const manifest = { version: 'tti-task-export/1', runId: crypto.randomUUID(), ticket,
    taskHash: content.taskHash, appFiles: files, taskFiles: inventory(taskDir) };
  writeJson(path.join(destination, 'manifest.json'), manifest);
  return manifest;
}
function text(value, label) {
  assert.ok(typeof value === 'string' && value.trim().length > 0, `Supply ${label}`);
}
export async function gradeExternal({ packet, submission, receipt, outputDir, browser }) {
  assert.ok(!fs.existsSync(outputDir), 'Choose a new output directory; retain earlier attempts');
  const manifest = JSON.parse(fs.readFileSync(path.join(packet, 'manifest.json'), 'utf8'));
  assert.equal(manifest.version, 'tti-task-export/1');
  const content = taskContent(manifest.ticket);
  assert.equal(manifest.taskHash, content.taskHash, 'Task version differs from this grader');
  assert.deepEqual(manifest.appFiles, inventory(appSource), 'Starting app version differs from this grader');
  assert.deepEqual(manifest.taskFiles, inventory(path.join(packet, 'task')), 'Keep the original packet unchanged');
  assert.equal(fs.readFileSync(path.join(packet, 'task/instructions.md'), 'utf8'), content.instructions, 'Task instructions changed');
  assert.equal(fs.readFileSync(path.join(packet, 'task/ticket.md'), 'utf8'), content.prompt, 'Task prompt changed');
  assert.deepEqual(inventory(path.join(packet, 'task/app')), manifest.appFiles, 'Starting app changed');
  assert.equal(receipt.version, 'tti-external-receipt/1');
  assert.equal(receipt.runId, manifest.runId);
  assert.equal(receipt.taskHash, manifest.taskHash);
  for (const key of ['id', 'vendor']) text(receipt.model?.[key], `model.${key}`);
  for (const key of ['method', 'client', 'version', 'billing']) text(receipt.execution?.[key], `execution.${key}`);
  text(receipt.transcript, 'transcript');
  assert.ok(['submitted', 'timeout', 'provider_error', 'cancelled', 'invalid_execution'].includes(receipt.status), 'Supply the attempt outcome');
  assert.ok(receipt.elapsedSeconds == null || Number.isFinite(receipt.elapsedSeconds) && receipt.elapsedSeconds >= 0, 'Invalid elapsed time');
  const files = inventory(submission);
  fs.mkdirSync(outputDir, { recursive: true, mode: 0o700 });
  const snapshot = path.join(outputDir, 'submission');
  fs.mkdirSync(snapshot);
  // Copy only inventoried regular files. Dependencies are supplied by the grader.
  for (const file of Object.keys(files)) {
    const target = path.join(snapshot, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(submission, file), target);
  }
  assert.deepEqual(inventory(snapshot), files, 'Submission changed during collection');
  writeJson(path.join(outputDir, 'receipt.json'), receipt);
  const record = { schemaVersion: 'tti-external-run/1', runId: manifest.runId, ticket: manifest.ticket,
    model: receipt.model, execution: receipt.execution, taskHash: manifest.taskHash,
    instructions: content.instructions, prompt: content.prompt,
    appFiles: manifest.appFiles, submittedFiles: files, runnerFiles: inventory(path.join(root, 'pilot')),
    status: receipt.status, elapsedSeconds: receipt.elapsedSeconds ?? null, timingBasis: 'submitter_reported',
    costUsd: null, costBasis: 'unavailable', reportedUsage: receipt.usage ?? null,
    reportedCost: receipt.cost ?? null, transcriptHash: sha256(receipt.transcript),
    evidenceStatus: 'unverified', comparisonEligible: false };
  // Save evidence before executing submitted code. Submitter grades are discarded.
  writeJson(path.join(outputDir, 'run.json'), record);
  try {
    const { grade } = await import('./grade.mjs');
    record.grade = await grade(snapshot, manifest.ticket, { browser });
  } catch (error) { record.gradingError = error.message; }
  record.metrics = summarize([record]);
  fs.writeFileSync(path.join(outputDir, 'run.json'), JSON.stringify(record, null, 2) + '\n', { mode: 0o600 });
  return record;
}
async function main() {
  const [mode, ...args] = process.argv.slice(2);
  if (mode === 'export') {
    assert.equal(args.length, 2, 'Usage: node pilot/external.mjs export TICKET NEW_DIRECTORY');
    console.log(JSON.stringify(exportTask(...args), null, 2));
    return;
  }
  assert.ok(mode === 'grade' && args.length === 4,
    'Usage: node pilot/external.mjs grade PACKET SUBMITTED_APP RECEIPT_JSON NEW_OUTPUT_DIRECTORY');
  const [packet, submission, receiptFile, outputDir] = args;
  let connection;
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(packet, 'manifest.json'), 'utf8'));
    if (manifest.ticket === '01') {
      const { connectBrowserbase } = await import('./browserbase.mjs');
      connection = await connectBrowserbase();
    }
    const record = await gradeExternal({ packet, submission, receipt: JSON.parse(fs.readFileSync(receiptFile, 'utf8')), outputDir, browser: connection?.browser });
    console.log(JSON.stringify({ runId: record.runId, status: record.status, pass: record.grade?.pass ?? null,
      evidenceStatus: record.evidenceStatus, metrics: record.metrics, gradingError: record.gradingError }, null, 2));
    if (record.gradingError) process.exitCode = 1;
  } finally { if (connection) await connection.close(); }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
