import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

const quoted = (value) => JSON.stringify(fs.realpathSync(value));
export function sandboxProfile(workspace, { read = [], port } = {}) {
  if (process.platform !== 'darwin') throw new Error('The pilot requires macOS sandbox-exec; no unrestricted fallback.');
  const system = ['/bin', '/sbin', '/usr', '/System', '/Library/Apple', '/dev', path.dirname(path.dirname(process.execPath))];
  return `(version 1)
(deny default)
(allow process-exec)
(allow process-fork)
(allow sysctl-read)
(deny sysctl-read (sysctl-name-regex #"^kern\\.proc"))
(allow mach-lookup)
(allow file-read-metadata)
(allow file-read* (literal "/") ${system.filter(fs.existsSync).map(p => `(subpath ${quoted(p)})`).join(' ')}
  (subpath ${quoted(workspace)}) ${read.map(p => `(subpath ${quoted(p)})`).join(' ')})
(allow file-write* (subpath ${quoted(workspace)}) (literal "/dev/null"))
${port ? `(allow network-inbound (local ip "localhost:${port}"))\n(allow network-outbound (remote ip "localhost:${port}"))` : ''}`;
}

export function launch(workspace, command, args, options = {}) {
  const home = path.join(workspace, '.runner-home');
  fs.mkdirSync(home, { recursive: true });
  const child = spawn('/usr/bin/sandbox-exec', ['-p', sandboxProfile(workspace, options), command, ...args], {
    cwd: workspace, detached: true, stdio: ['pipe', 'pipe', 'pipe'],
    env: { PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin`, HOME: home, TMPDIR: home,
      TZ: 'UTC', LANG: 'en_US.UTF-8', NODE_ENV: 'test', ...options.env },
  });
  const stop = () => { try { process.kill(-child.pid, 'SIGKILL'); } catch {} };
  return { child, stop };
}

export async function execute(workspace, command, { timeoutMs = 30_000, maxBytes = 32_768, input = '', ...options } = {}) {
  const { child, stop } = launch(workspace, '/bin/sh', ['-c', command], options);
  let output = '', bytes = 0, limited = false, timedOut = false, settle;
  const completed = new Promise((resolve, reject) => { settle = resolve; child.once('error', reject); child.once('close', resolve); });
  const consume = (chunk) => {
    bytes += chunk.length;
    output += chunk.subarray(0, Math.max(0, maxBytes - Buffer.byteLength(output))).toString();
    if (bytes > maxBytes) { limited = true; stop(); settle(null); }
  };
  child.stdout.on('data', consume); child.stderr.on('data', consume);
  child.stdin.on('error', () => {});
  child.stdin.end(input);
  const timer = setTimeout(() => { timedOut = true; stop(); settle(null); }, timeoutMs);
  try {
    const code = await completed;
    return { code, output, timedOut, outputLimited: limited };
  } finally { clearTimeout(timer); stop(); child.stdin.destroy(); child.stdout.destroy(); child.stderr.destroy(); }
}

export async function probeSandbox(workspace) {
  const secretDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mtb-denied-'));
  const sentinel = path.join(secretDir, 'answer'); fs.writeFileSync(sentinel, 'PRIVATE-SENTINEL');
  try {
    const script = `const fs=require('fs'); let denied=false; try { fs.readFileSync(${JSON.stringify(sentinel)}) } catch(e) { denied=e.code==='EPERM'||e.code==='EACCES' } if(!denied) process.exit(9); fs.writeFileSync('probe-ok','ok'); console.log('isolated')`;
    const result = await execute(workspace, `${JSON.stringify(process.execPath)} -e '${script.replaceAll("'", "'\\''")}'`);
    if (result.code !== 0 || result.output.trim() !== 'isolated') throw new Error(`Sandbox probe failed: ${JSON.stringify(result)}`);
    fs.unlinkSync(path.join(workspace, 'probe-ok'));
  } finally { fs.rmSync(secretDir, { recursive: true, force: true }); }
}
