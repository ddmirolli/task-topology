import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { registerTask, acceptSubmission } from './store.mjs';
import { canonical } from './profile.mjs';
import { sha256 } from '../pilot/workspace.mjs';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
export async function gradeQueued(store, id, packet, outputDir, options = {}) {
  assert.match(id, /^[a-f0-9]{64}$/);
  const record = read(path.join(store, 'attempts', id, 'record.json'));
  const { contentHash, receivedAt, ...body } = record;
  assert.equal(sha256(canonical(body)), contentHash, 'Queued evidence changed');
  assert.equal(sha256(record.attemptId), id, 'Attempt ID changed');
  const manifest = read(path.join(packet, 'manifest.json'));
  assert.equal(manifest.taskHash, record.taskHash, 'Wrong task packet');
  const registration = read(path.join(store, 'tasks', record.taskHash + '.json'));
  assert.equal(canonical(registration.appFiles), canonical(manifest.appFiles), 'Starting app differs');
  assert.equal(canonical(registration.taskFiles), canonical(manifest.taskFiles), 'Task files differ');
  assert.ok(!fs.existsSync(outputDir), 'Retain previous grading output');
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'tti-queued-'));
  try {
    for (const [file, content] of Object.entries(record.files)) {
      const target = path.resolve(workspace, file);
      assert.ok(target.startsWith(path.resolve(workspace) + path.sep), 'Unsafe submitted path');
      fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, content, { flag: 'wx' });
    }
    const receipt = { version: 'tti-external-receipt/1', runId: manifest.runId, taskHash: manifest.taskHash,
      model: record.model, execution: { method: record.profile.accessMethod, client: record.profile.client,
        version: record.profile.clientVersion, billing: 'unreported', settings: record.profile.settings },
      status: record.attemptStatus, elapsedSeconds: record.elapsedSeconds, transcript: record.transcript,
      usage: record.reportedUsage, cost: record.reportedCost };
    const { gradeExternal } = await import('../pilot/external.mjs');
    const result = await gradeExternal({ packet, submission: workspace, receipt, outputDir, ...options });
    fs.writeFileSync(path.join(outputDir, 'intake.json'), JSON.stringify({ id, contentHash, profileHash: record.profileHash,
      attemptId: record.attemptId, reviewStatus: 'pending', public: false }, null, 2), { flag: 'wx', mode: 0o600 });
    return { id, appPass: result.grade?.pass ?? null, gradingError: result.gradingError ?? null,
      comparisonEligible: false, outputDir };
  } finally { fs.rmSync(workspace, { recursive: true, force: true }); }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [mode, store, input, packet, output] = process.argv.slice(2);
  assert.ok(store && input, 'Usage: cli.mjs register STORE PACKET | submit STORE SUBMISSION_JSON | grade STORE ID PACKET NEW_OUTPUT');
  if (mode === 'register') console.log(JSON.stringify(registerTask(store, read(path.join(input, 'manifest.json')))));
  else if (mode === 'submit') console.log(JSON.stringify(acceptSubmission(store, read(input))));
  else if (mode === 'grade') {
    let connection;
    try {
      if (read(path.join(packet, 'manifest.json')).ticket === '01') {
        const { connectBrowserbase } = await import('../pilot/browserbase.mjs'); connection = await connectBrowserbase();
      }
      const result = await gradeQueued(store, input, packet, output, { browser: connection?.browser });
      console.log(JSON.stringify(result)); if (result.gradingError) process.exitCode = 1;
    } finally { if (connection) await connection.close(); }
  } else throw new Error('Unknown command');
}
