import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { sha256 } from '../pilot/workspace.mjs';
import { canonical, executionProfile } from './profile.mjs';

const MAX_BYTES = 8_000_000;
const string = (v, n = 500) => typeof v === 'string' && v.trim().length > 0 && v.length <= n;
function regular(file) {
  const stat = fs.lstatSync(file);
  assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.size <= MAX_BYTES, 'Unsupported evidence file');
  return fs.readFileSync(file);
}
function write(file, data) { fs.writeFileSync(file, data, { flag: 'wx', mode: 0o600 }); }
function ensure(dir) { fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); }
export function registerTask(store, manifest) {
  assert.equal(manifest.version, 'tti-task-export/1');
  assert.match(manifest.taskHash, /^[a-f0-9]{64}$/);
  assert.ok(['01', '04', '07'].includes(manifest.ticket), 'This registry adapter supports the three pilot tickets');
  const registry = { version: 'tti-task-registration/1', taskHash: manifest.taskHash, tier: 1,
    ticket: manifest.ticket, appFiles: manifest.appFiles, taskFiles: manifest.taskFiles };
  const dir = path.join(store, 'tasks'); ensure(dir);
  const target = path.join(dir, manifest.taskHash + '.json'), bytes = canonical(registry);
  if (fs.existsSync(target)) assert.equal(regular(target).toString(), bytes, 'Task hash already registered with different files');
  else write(target, bytes);
  return registry;
}
export function acceptSubmission(store, input) {
  assert.ok(Buffer.byteLength(JSON.stringify(input)) <= MAX_BYTES, 'Submission exceeds 8 MB');
  assert.equal(input.version, 'tti-submission/1');
  assert.match(input.taskHash, /^[a-f0-9]{64}$/);
  assert.ok(string(input.attemptId), 'Supply a stable attempt ID');
  assert.ok(string(input.model?.id) && string(input.model?.vendor), 'Supply model identity or unknown');
  assert.ok(string(input.transcript, 4_000_000), 'Supply transcript evidence');
  assert.ok(input.elapsedSeconds == null || Number.isFinite(input.elapsedSeconds) && input.elapsedSeconds >= 0, 'Invalid elapsed time');
  assert.ok(['submitted', 'timeout', 'provider_error', 'cancelled', 'invalid_execution'].includes(input.status), 'Supply the attempt outcome');
  const profile = executionProfile(input.profile);
  const registered = JSON.parse(regular(path.join(store, 'tasks', input.taskHash + '.json')));
  assert.equal(registered.taskHash, input.taskHash);
  assert.ok(input.files && typeof input.files === 'object' && !Array.isArray(input.files), 'Supply app files');
  assert.ok(Object.keys(input.files).length > 0 && Object.keys(input.files).length <= 1000, 'Invalid file count');
  let bytes = 0;
  for (const [name, content] of Object.entries(input.files)) {
    assert.ok(name.length <= 250 && !name.includes('\\') && !name.includes('\0') && !name.startsWith('/')
      && name.split('/').every(p => p && !['.', '..', '.git', 'node_modules', '.env'].includes(p)), 'Unsafe submitted path');
    assert.ok(typeof content === 'string', 'File contents must be text');
    bytes += Buffer.byteLength(content);
  }
  assert.ok(bytes <= 4_000_000, 'App exceeds 4 MB');
  // Only declared measurements enter the record. Submitted grades and trust labels are discarded.
  const record = { version: 'tti-submission-record/1', attemptId: input.attemptId, taskHash: input.taskHash,
    model: { id: input.model.id, vendor: input.model.vendor }, ...profile,
    transcript: input.transcript, files: input.files, elapsedSeconds: input.elapsedSeconds ?? null,
    reportedUsage: input.usage ?? null, reportedCost: input.cost ?? null,
    status: 'queued', attemptStatus: input.status, evidenceStatus: 'unverified', grade: null, comparisonEligible: false };
  const contentHash = sha256(canonical(record)), key = sha256(input.attemptId), attempts = path.join(store, 'attempts'); ensure(attempts);
  const target = path.join(attempts, key);
  if (fs.existsSync(target)) {
    const existing = JSON.parse(regular(path.join(target, 'record.json')));
    assert.equal(existing.contentHash, contentHash, 'Attempt ID already contains different evidence');
    return { id: key, contentHash, duplicate: true, status: existing.status };
  }
  const staging = path.join(attempts, '.incoming-' + crypto.randomUUID()); ensure(staging);
  const full = { ...record, contentHash, receivedAt: new Date().toISOString() };
  try {
    write(path.join(staging, 'record.json'), JSON.stringify(full, null, 2));
    // A directory rename publishes a complete record atomically.
    try { fs.renameSync(staging, target); } catch (error) {
      if (!['EEXIST', 'ENOTEMPTY'].includes(error.code)) throw error;
      const existing = JSON.parse(regular(path.join(target, 'record.json')));
      assert.equal(existing.contentHash, contentHash, 'Concurrent attempt ID contains different evidence');
      return { id: key, contentHash, duplicate: true, status: existing.status };
    }
  } finally { fs.rmSync(staging, { recursive: true, force: true }); }
  return { id: key, contentHash, duplicate: false, status: 'queued' };
}
