import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { root, tool, isolated, capture } from './runtime.js';

const cases = {
  python: [
    { name: 'line rounding', input: ['0.005', '0.005'], expected: 2 },
    { name: 'negative credits', input: ['12.10', '-1.005'], expected: 1109 },
    { name: 'decimal precision', input: ['0.10', '0.20', '0.49'], expected: 79 },
    { name: 'empty export', input: [], expected: 0 },
    ...[['NaN'], ['1e3'], [true], ['bad'], ['Infinity']].map(input => ({ name: `reject ${JSON.stringify(input)}`, input, expected: null })),
  ],
  go: [
    { name: 'due today Sydney', input: { due: '2026-09-19', now: '2026-09-18T23:00:00Z', zone: 'Australia/Sydney' }, expected: false },
    { name: 'yesterday Sydney', input: { due: '2026-09-18', now: '2026-09-18T23:00:00Z', zone: 'Australia/Sydney' }, expected: true },
    { name: 'due today Los Angeles', input: { due: '2026-09-18', now: '2026-09-19T01:00:00Z', zone: 'America/Los_Angeles' }, expected: false },
    { name: 'future', input: { due: '2026-09-21', now: '2026-09-19T01:00:00Z', zone: 'UTC' }, expected: false },
    ...[{ due: '2026-02-30', now: '2026-09-19T01:00:00Z', zone: 'UTC' },
      { due: '2026-09-19', now: 'bad', zone: 'UTC' },
      { due: '2026-09-19', now: '2026-09-19T01:00:00Z', zone: 'Bad/Zone' }].map(input => ({ name: `reject ${JSON.stringify(input)}`, input, expected: null })),
  ],
};
export async function gradeEntry(language: 'python' | 'go', workspace: string) {
  assert.ok(['python', 'go'].includes(language));
  const contract = fs.readFileSync(path.join(root, `tasks/tier-1-entry/polyglot/${language}/TASK.md`));
  const taskFile = path.join(workspace, 'TASK.md');
  const stat = fs.existsSync(taskFile) ? fs.lstatSync(taskFile) : null;
  const checks = [{ name: 'contract preserved', pass: Boolean(stat?.isFile() && stat.nlink === 1 && fs.readFileSync(taskFile).equals(contract)) }];
  if (language === 'go') {
    const build = await capture(isolated(workspace, tool('go'), ['build', '-o', 'submitted', 'main.go'], [], { GOCACHE: path.join(workspace, '.cache'), GOPROXY: 'off', GOTOOLCHAIN: 'local' }), '', 120_000);
    if (build.code !== 0) return { checks: [...checks, { name: 'build', pass: false }], pass: false, error: build.stderr };
  }
  for (const item of cases[language]) {
    const child = language === 'go' ? isolated(workspace, path.join(workspace, 'submitted'), []) : isolated(workspace, tool('python3'), ['totals.py']);
    const result = await capture(child, JSON.stringify(item.input));
    let pass = false;
    if (!result.timedOut && !result.overflow) {
      if (item.expected === null) pass = result.code !== 0 && result.stdout.trim() === '';
      else { try { pass = result.code === 0 && JSON.parse(result.stdout) === item.expected; } catch {} }
    }
    checks.push({ name: item.name, pass });
  }
  return { checks, pass: checks.every(c => c.pass) };
}
