import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { launch } from './sandbox.mjs';
import { dependencyPath } from './workspace.mjs';

export async function availablePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
export async function startApp(workspace, { dbFile = path.join(workspace, 'grade.sqlite'), seedData = true } = {}) {
  const port = await availablePort();
  const worker = fileURLToPath(new URL('./worker.cjs', import.meta.url));
  const { child, stop } = launch(workspace, process.execPath, [worker], { read: [worker, dependencyPath], port });
  const pending = new Map(); let serial = 0, diagnostics = '';
  child.stderr.on('data', b => { diagnostics = (diagnostics + b.toString()).slice(-4096); });
  readline.createInterface({ input: child.stdout }).on('line', line => {
    try { const message = JSON.parse(line); const item = pending.get(message.id);
      if (item) { clearTimeout(item.timer); pending.delete(message.id); message.error ? item.reject(new Error(message.error)) : item.resolve(message.result); }
    } catch {}
  });
  const fail = () => { for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error(`App worker stopped: ${diagnostics}`)); } pending.clear(); };
  child.stdin.on('error', fail);
  child.once('error', fail); child.once('exit', fail);
  const control = (action, data) => new Promise((resolve, reject) => {
    const id = ++serial;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`App control timeout: ${action}; ${diagnostics}`)); stop(); }, 10_000);
    pending.set(id, { resolve, reject, timer });
    child.stdin.write(JSON.stringify({ id, action, data }) + '\n');
  });
  try { await control('open', { dbFile, seedData, port }); }
  catch (error) { stop(); throw error; }
  let cookie = '';
  const http = async (url, { method = 'GET', body, headers = {} } = {}) => {
    const response = await fetch(`http://127.0.0.1:${port}${url}`, { method, body, redirect: 'manual',
      headers: { cookie, ...headers }, signal: AbortSignal.timeout(5000) });
    if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    const text = await response.text();
    return { status: response.status, text, headers: Object.fromEntries(response.headers) };
  };
  return { port, dbFile, control, http, stop: async () => {
    try { await control('close'); } finally { stop(); fail(); }
  }, login: () => http('/login', { method: 'POST', body: 'email=owner%40example.com&password=password123&remember=1', headers: { 'content-type': 'application/x-www-form-urlencoded' } }) };
}
