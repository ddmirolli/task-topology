import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { canonical, executionProfile } from './profile.js';

const MAX_BYTES = 8_000_000;
const text = (value: unknown, max = 500): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
function object(value: unknown): asserts value is Record<string, unknown> {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), 'Supply an object');
}
function textMap(value: unknown): asserts value is Record<string, string> {
  object(value); assert.ok(Object.values(value).every(item => typeof item === 'string'), 'Supply text values');
}
function encoded(value: unknown): string {
  const result = canonical(value); assert.ok(result !== undefined); return result;
}
function regular(file: string): Buffer {
  const stat = fs.lstatSync(file);
  assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.size <= MAX_BYTES, 'Unsupported evidence file');
  return fs.readFileSync(file);
}
function record(file: string): Record<string, unknown> {
  const value: unknown = JSON.parse(regular(file).toString()); object(value); return value;
}
function write(file: string, data: string): void { fs.writeFileSync(file, data, { flag: 'wx', mode: 0o600 }); }
function ensure(dir: string): void { fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); }

export function registerTask(store: string, input: unknown) {
  object(input);
  assert.equal(input.version, 'mtb-task-export/1');
  assert.ok(text(input.taskHash)); assert.match(input.taskHash, /^[a-f0-9]{64}$/);
  assert.ok(text(input.ticket) && ['01', '04', '07'].includes(input.ticket), 'This registry adapter supports the three pilot tickets');
  textMap(input.appFiles); textMap(input.taskFiles);
  const registry = { version: 'mtb-task-registration/1', taskHash: input.taskHash, tier: 1,
    ticket: input.ticket, appFiles: input.appFiles, taskFiles: input.taskFiles };
  const dir = path.join(store, 'tasks'); ensure(dir);
  const target = path.join(dir, input.taskHash + '.json'), bytes = encoded(registry);
  if (fs.existsSync(target)) assert.equal(regular(target).toString(), bytes, 'Task hash already registered with different files');
  else write(target, bytes);
  return registry;
}

export function acceptSubmission(store: string, input: unknown) {
  object(input);
  assert.ok(Buffer.byteLength(JSON.stringify(input)) <= MAX_BYTES, 'Submission exceeds 8 MB');
  assert.equal(input.version, 'mtb-submission/1');
  assert.ok(text(input.taskHash)); assert.match(input.taskHash, /^[a-f0-9]{64}$/);
  assert.ok(text(input.attemptId), 'Supply a stable attempt ID');
  object(input.model);
  assert.ok(text(input.model.id) && text(input.model.vendor), 'Supply model identity or unknown');
  assert.ok(text(input.transcript, 4_000_000), 'Supply transcript evidence');
  assert.ok(input.elapsedSeconds == null || typeof input.elapsedSeconds === 'number' && Number.isFinite(input.elapsedSeconds) && input.elapsedSeconds >= 0, 'Invalid elapsed time');
  assert.ok(text(input.status) && ['submitted', 'timeout', 'provider_error', 'cancelled', 'invalid_execution'].includes(input.status), 'Supply the attempt outcome');
  const profile = executionProfile(input.profile);
  const registered = record(path.join(store, 'tasks', input.taskHash + '.json'));
  assert.equal(registered.taskHash, input.taskHash);
  textMap(input.files);
  assert.ok(Object.keys(input.files).length > 0 && Object.keys(input.files).length <= 1000, 'Invalid file count');
  let bytes = 0;
  for (const [name, content] of Object.entries(input.files)) {
    assert.ok(name.length <= 250 && !name.includes('\\') && !name.includes('\0') && !name.startsWith('/')
      && name.split('/').every(part => part && !['.', '..', '.git', 'node_modules', '.env'].includes(part)), 'Unsafe submitted path');
    bytes += Buffer.byteLength(content);
  }
  assert.ok(bytes <= 4_000_000, 'App exceeds 4 MB');
  // Submitted grades and trust labels are never grading authority.
  const submission = { version: 'mtb-submission-record/1', attemptId: input.attemptId, taskHash: input.taskHash,
    model: { id: input.model.id, vendor: input.model.vendor }, ...profile,
    transcript: input.transcript, files: input.files, elapsedSeconds: input.elapsedSeconds ?? null,
    reportedUsage: input.usage ?? null, reportedCost: input.cost ?? null,
    status: 'queued', attemptStatus: input.status, evidenceStatus: 'unverified', grade: null, comparisonEligible: false };
  const contentHash = sha256(encoded(submission)), key = sha256(input.attemptId), attempts = path.join(store, 'attempts'); ensure(attempts);
  const target = path.join(attempts, key);
  if (fs.existsSync(target)) {
    const existing = record(path.join(target, 'record.json'));
    assert.equal(existing.contentHash, contentHash, 'Attempt ID already contains different evidence');
    return { id: key, contentHash, duplicate: true, status: existing.status };
  }
  const staging = path.join(attempts, '.incoming-' + crypto.randomUUID()); ensure(staging);
  const full = { ...submission, contentHash, receivedAt: new Date().toISOString() };
  try {
    write(path.join(staging, 'record.json'), JSON.stringify(full, null, 2));
    try { fs.renameSync(staging, target); } catch (error: unknown) {
      if (!(error instanceof Error) || !('code' in error) || !['EEXIST', 'ENOTEMPTY'].includes(String(error.code))) throw error;
      const existing = record(path.join(target, 'record.json'));
      assert.equal(existing.contentHash, contentHash, 'Concurrent attempt ID contains different evidence');
      return { id: key, contentHash, duplicate: true, status: existing.status };
    }
  } finally { fs.rmSync(staging, { recursive: true, force: true }); }
  return { id: key, contentHash, duplicate: false, status: 'queued' };
}
