import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

export const tierDir = fileURLToPath(new URL('..', import.meta.url));
export const appDir = path.join(tierDir, 'app');
export const tickets = Array.from({ length: 10 }, (_, i) => String(i + 1).padStart(2, '0'));

// This creates a local maintainer fixture. The benchmark sandbox is a separate component.
export function prepare({ fixes = [], dependencies = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mtb-tier1-'));
  try {
    fs.cpSync(appDir, dir, { recursive: true, filter: (source) => {
      const relative = path.relative(appDir, source);
      return !relative.split(path.sep).includes('node_modules') && !/\.sqlite(?:-|$)/.test(relative) && path.basename(source) !== '.env';
    } });
    for (const ticket of fixes) {
      if (!tickets.includes(ticket)) throw new Error(`Unknown ticket ${ticket}`);
      const result = spawnSync('git', ['apply', '--unidiff-zero', path.join(tierDir, 'solutions', `${ticket}.patch`)], { cwd: dir, encoding: 'utf8' });
      if (result.status !== 0) throw new Error(`Patch ${ticket}: ${result.stderr}`);
    }
    if (dependencies) fs.symlinkSync(path.join(appDir, 'node_modules'), path.join(dir, 'node_modules'), 'dir');
    return dir;
  } catch (error) { fs.rmSync(dir, { recursive: true, force: true }); throw error; }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2] || 'task';
  if (!['task', 'clean'].includes(mode)) throw new Error('Usage: node scripts/prepare.mjs [task|clean]');
  console.log(prepare({ fixes: mode === 'clean' ? tickets : [] }));
}
