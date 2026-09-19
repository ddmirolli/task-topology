import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export function tool(name: string): string {
  const candidates = [process.env[`MTB_${name.toUpperCase()}`], `/opt/homebrew/opt/postgresql@17/bin/${name}`, `/opt/homebrew/opt/python@3.12/libexec/bin/${name}`, `/opt/homebrew/bin/${name}`, `/usr/bin/${name}`];
  for (const candidate of candidates) if (candidate && fs.existsSync(candidate)) return fs.realpathSync(candidate);
  const found = spawnSync('/bin/sh', ['-c', 'command -v "$1"', 'sh', name], { encoding: 'utf8' });
  assert.ok(found.status === 0 && found.stdout.trim(), `Install ${name} before running this suite`);
  return fs.realpathSync(found.stdout.trim());
}
export const cleanEnv = (): NodeJS.ProcessEnv => ({ PATH: `${path.dirname(process.execPath)}:/opt/homebrew/opt/python@3.12/libexec/bin:/opt/homebrew/bin:/opt/homebrew/opt/postgresql@17/bin:/usr/bin:/bin`, LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8', TZ: 'UTC' });
export function command(binary: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = {}, input?: string) {
  const result = spawnSync(binary, args, { cwd, env: { ...cleanEnv(), HOME: cwd, TMPDIR: cwd, ...env }, input, encoding: 'utf8', timeout: 120_000, maxBuffer: 4_000_000 });
  assert.equal(result.status, 0, `${path.basename(binary)} failed: ${result.error?.message ?? result.stderr.slice(-3000)}`);
  return result.stdout.trim();
}
export const temp = (prefix: string) => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
export async function freePort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  await new Promise<void>(resolve => server.close(() => resolve()));
  return address.port;
}
export function stop(child: ChildProcess) { if (child.pid) { try { process.kill(-child.pid, 'SIGKILL'); } catch {} } }

// The child gets task files and local test services, never operator answers or auth.
export function isolated(workspace: string, binary: string, args: string[], ports: number[] = [], env: NodeJS.ProcessEnv = {}, extraRead: string[] = []) {
  assert.equal(process.platform, 'darwin', 'This runner requires sandbox-exec; no unrestricted fallback');
  const read = ['/bin', '/sbin', '/usr', '/System', '/Library/Apple', '/dev', '/opt/homebrew/Cellar', '/opt/homebrew/opt', path.dirname(path.dirname(process.execPath)), ...extraRead].filter(fs.existsSync);
  const q = (s: string) => JSON.stringify(fs.realpathSync(s));
  const profile = `(version 1)(deny default)(allow process-exec)(allow process-fork)(allow sysctl-read)(deny sysctl-read (sysctl-name-regex #"^kern\\.proc"))(allow mach-lookup)(allow file-read-metadata)
    (allow file-read* (literal "/") (subpath ${q(workspace)}) ${read.map(p => `(subpath ${q(p)})`).join(' ')})
    (allow file-write* (subpath ${q(workspace)}) (literal "/dev/null"))
    ${ports.map(p => `(allow network-outbound (remote ip "localhost:${p}"))(allow network-inbound (local ip "localhost:${p}"))`).join('\n')}`;
  const child = spawn('/usr/bin/sandbox-exec', ['-p', profile, binary, ...args], { cwd: workspace, detached: true,
    env: { ...cleanEnv(), HOME: workspace, TMPDIR: workspace, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
  return child;
}
export async function capture(child: ChildProcess, input = '', timeoutMs = 30_000) {
  let stdout = '', stderr = '', overflow = false, timedOut = false;
  const collect = (kind: 'stdout' | 'stderr', bytes: Buffer) => {
    if (kind === 'stdout') stdout += bytes; else stderr += bytes;
    if (stdout.length + stderr.length > 2_000_000) { overflow = true; stop(child); }
  };
  child.stdout?.on('data', b => collect('stdout', b)); child.stderr?.on('data', b => collect('stderr', b));
  child.stdin?.on('error', () => {}); child.stdin?.end(input);
  const timer = setTimeout(() => { timedOut = true; stop(child); }, timeoutMs);
  try {
    const code = await new Promise<number | null>((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
    return { code, stdout, stderr, timedOut, overflow };
  } finally { clearTimeout(timer); stop(child); }
}
export async function postgres(database: string) {
  assert.match(database, /^mtb_[a-z]+$/);
  const directory = temp('mtb-pg-'), data = path.join(directory, 'data'), port = await freePort();
  const password = randomBytes(24).toString('hex');
  fs.writeFileSync(path.join(directory, 'password'), password, { mode: 0o600 });
  command(tool('initdb'), ['-D', data, '-U', 'mtb_operator', '--auth-host=scram-sha-256', '--auth-local=scram-sha-256', '--pwfile', path.join(directory, 'password'), '--no-locale'], directory);
  const env = { PGHOST: '127.0.0.1', PGPORT: String(port), PGUSER: 'mtb_operator', PGPASSWORD: password, PGDATABASE: database };
  try {
    command(tool('pg_ctl'), ['-D', data, '-l', path.join(directory, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port} -k ${directory}`, '-w', 'start'], directory);
    command(tool('createdb'), [database], directory, env);
  } catch (error) { try { command(tool('pg_ctl'), ['-D', data, '-m', 'immediate', 'stop'], directory); } catch {} fs.rmSync(directory, { recursive: true, force: true }); throw error; }
  return { directory, port, env,
    sql: (sql: string, other: NodeJS.ProcessEnv = {}) => command(tool('psql'), ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', sql], directory, { ...env, ...other }),
    close: () => { try { command(tool('pg_ctl'), ['-D', data, '-m', 'immediate', '-w', 'stop'], directory); } finally { fs.rmSync(directory, { recursive: true, force: true }); } } };
}
