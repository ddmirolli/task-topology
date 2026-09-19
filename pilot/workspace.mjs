import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('..', import.meta.url));
export const appSource = path.join(root, 'tasks/tier-1-entry/app');
export const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
export function inventory(dir) {
  const files = {};
  function visit(current, prefix = '') {
    for (const name of fs.readdirSync(current).sort()) {
      if (['node_modules', '.runner-home'].includes(name)) continue;
      const rel = prefix + name, file = path.join(current, name), stat = fs.lstatSync(file);
      if (stat.isSymbolicLink() || (!stat.isDirectory() && !stat.isFile()) || stat.isFile() && stat.nlink !== 1) throw new Error(`Unsupported file: ${rel}`);
      if (stat.isDirectory()) visit(file, rel + '/');
      else { if (stat.size > 2_000_000) throw new Error(`File too large: ${rel}`); files[rel] = sha256(fs.readFileSync(file)); }
    }
  }
  visit(dir);
  return files;
}
export function copyApp(source = appSource) {
  inventory(source);
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'tti-pilot-'));
  try {
    fs.cpSync(source, workspace, { recursive: true, filter: file => !path.relative(source, file).split(path.sep).some(p => ['node_modules', '.runner-home', '.git', '.env'].includes(p)) && !/\.sqlite(?:-|$)/.test(file) });
    // Dependencies come from the maintainer's locked install, never the submission.
    fs.symlinkSync(path.join(appSource, 'node_modules'), path.join(workspace, 'node_modules'), 'dir');
    return workspace;
  } catch (error) { fs.rmSync(workspace, { recursive: true, force: true }); throw error; }
}
export const dependencyPath = path.join(appSource, 'node_modules');
