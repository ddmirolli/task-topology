import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { prepare, tierDir, tickets } from './prepare.mjs';

const expectedFailures = {
  '01': ['login-visible-dark', 'signup-visible-dark'],
  '02': ['total-exact-cents', 'email-summary-matches-total', 'original-assertions-present-and-correct'],
  '03': ['server-accepts-plus', 'client-accepts-plus'],
  '04': ['invoices-survive-delete', 'migration-present', 'confirm-copy-updated', 'invoices-page-renders-after-delete'],
  '05': ['export-respects-filter', 'export-format', 'export-excludes-soft-deleted'],
  '06': ['query-count-under-5'],
  '07': ['due-today-not-overdue-sydney', 'reminder-job-same-logic'],
  '08': ['no-client-in-views-or-emails'],
  '09': ['reset-link-https', 'fresh-token-accepted'],
  '10': ['session-lasts', 'remember-me-lasts'],
};

function run(dir, args) {
  const result = spawnSync(process.execPath, args, {
    cwd: dir, encoding: 'utf8', timeout: 60_000,
    env: { ...process.env, TZ: 'UTC', APP_URL: 'http://localhost:3000', TTI_APP_DIR: dir, NODE_ENV: 'test' },
  });
  assert.equal(result.status, 0, result.error?.message || result.stdout + result.stderr);
  return result.stdout;
}
function baseline(dir) {
  const files = fs.readdirSync(path.join(dir, 'test')).filter((f) => f.endsWith('.test.js')).map((f) => path.join('test', f));
  const output = run(dir, ['--test', '--test-reporter=tap', ...files]);
  assert.match(output, /# tests 10\b/); assert.match(output, /# pass 10\b/);
  assert.match(output, /# skipped 0\b/);
}
function hidden(dir, ticket) {
  return JSON.parse(run(dir, [path.join(tierDir, 'hidden/run.cjs'), ...(ticket ? [ticket] : [])]));
}
const dirs = [];
try {
  const broken = prepare({ dependencies: true }); dirs.push(broken);
  baseline(broken);
  const before = hidden(broken);
  assert.equal(before.length, 30);
  for (const ticket of tickets) {
    const failed = before.filter((r) => r.name.startsWith(ticket + '-') && !r.pass).map((r) => r.name);
    assert.deepEqual(failed, expectedFailures[ticket].map((name) => ticket + '-' + name));
    const fixed = prepare({ fixes: [ticket], dependencies: true }); dirs.push(fixed);
    baseline(fixed);
    const results = hidden(fixed, ticket);
    assert.equal(results.length, before.filter((r) => r.name.startsWith(ticket + '-')).length);
    assert.ok(results.every((r) => r.pass), JSON.stringify(results.filter((r) => !r.pass), null, 2));
    console.log(`Ticket ${ticket}: ${failed.length} expected failures; all ${results.length} checks pass after reference fix`);
  }
  const clean = prepare({ fixes: tickets, dependencies: true }); dirs.push(clean);
  baseline(clean);
  const results = hidden(clean);
  assert.ok(results.every((r) => r.pass), JSON.stringify(results.filter((r) => !r.pass), null, 2));
  console.log(`Clean app: ${results.length}/30 hidden checks and 10/10 baseline tests pass. No model calls.`);
} finally { for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true }); }
