import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import http from 'node:http';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { root, tool, command, postgres, isolated, capture, freePort, stop, cleanEnv } from './runtime.js';

export async function deployExecutive(directory: string, source: string) {
  const workspace = path.join(directory, 'workspace');
  assert.ok(!fs.existsSync(workspace), 'Use a new deployment directory');
  fs.cpSync(source, workspace, { recursive: true });
  const pg = await postgres('mtb_executive');
  let child: ChildProcess | undefined, gateway: https.Server | undefined;
  try {
    const appPassword = randomBytes(24).toString('hex');
    pg.sql(`CREATE ROLE mtb_app LOGIN PASSWORD '${appPassword}'; GRANT CONNECT ON DATABASE mtb_executive TO mtb_app; GRANT USAGE,CREATE ON SCHEMA public TO mtb_app;`);
    const port = await freePort(), httpsPort = await freePort();
    const env = { ...pg.env, PGUSER: 'mtb_app', PGPASSWORD: appPassword, PORT: String(port), GOCACHE: path.join(workspace, '.cache'), GOPROXY: 'off', GOTOOLCHAIN: 'local' };
    for (const [binary, args, read] of [
      [tool('go'), ['build', '-o', 'server', 'main.go'], []],
      [process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), 'ui.ts', '--strict', '--target', 'ES2022', '--module', 'ES2022', '--lib', 'ES2022,DOM,DOM.Iterable', '--skipLibCheck'], [path.join(root, 'node_modules/typescript'), path.join(root, 'node_modules/@typescript')]],
    ] as [string, string[], string[]][]) {
      const built = await capture(isolated(workspace, binary, args, [], env, read), '', 120_000);
      assert.equal(built.code, 0, built.stderr + built.stdout);
    }
    let diagnostics = '';
    const start = async () => {
      child = isolated(workspace, '/bin/sh', ['start.sh'], [port, pg.port], env);
      child.stderr?.on('data', b => { diagnostics = (diagnostics + b).slice(-4000); });
      child.stdout?.resume(); child.stdin?.end();
      for (let i = 0; i < 100; i++) {
        if (child.exitCode !== null) throw new Error(`App failed to start: ${diagnostics}`);
        try { const r = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(200) }); if (r.ok) return; } catch {}
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      throw new Error(`App did not become reachable: ${diagnostics}`);
    };
    await start();
    command('/usr/bin/openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', path.join(directory, 'tls.key'), '-out', path.join(directory, 'tls.crt'), '-days', '1', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], directory);
    const ca = fs.readFileSync(path.join(directory, 'tls.crt'));
    gateway = https.createServer({ key: fs.readFileSync(path.join(directory, 'tls.key')), cert: ca }, (req, res) => {
      const upstream = http.request({ host: '127.0.0.1', port, path: req.url, method: req.method, headers: req.headers }, response => { res.writeHead(response.statusCode ?? 502, response.headers); response.pipe(res); });
      upstream.on('error', () => { res.writeHead(502); res.end(); }); req.pipe(upstream);
    });
    await new Promise<void>(resolve => gateway!.listen(httpsPort, '127.0.0.1', resolve));
    const request = (url: string, method = 'GET', body?: unknown, cookie = ''): Promise<{ status: number; text: string; cookie: string; json: any }> => new Promise((resolve, reject) => {
      const req = https.request({ host: '127.0.0.1', port: httpsPort, path: url, method, ca, headers: { cookie, 'content-type': 'application/json' }, timeout: 5000 }, res => {
        let text = ''; res.on('data', b => { text += b; if (text.length > 2_000_000) req.destroy(new Error('Response too large')); });
        res.on('end', () => { let json; try { json = JSON.parse(text); } catch {} resolve({ status: res.statusCode ?? 0, text, cookie: res.headers['set-cookie']?.[0]?.split(';')[0] ?? cookie, json }); });
      });
      req.on('error', reject); req.on('timeout', () => req.destroy(new Error('Request exceeded five seconds')));
      req.end(body === undefined ? undefined : JSON.stringify(body));
    });
    return { workspace, port, pg, request,
      restart: async () => { if (child) { const old = child; stop(old); await new Promise<void>(resolve => old.exitCode !== null ? resolve() : old.once('exit', () => resolve())); } await start(); },
      close: async () => { if (child) stop(child); gateway!.closeAllConnections(); await new Promise<void>(resolve => gateway!.close(() => resolve())); pg.close(); } };
  } catch (error) { if (child) stop(child); if (gateway) { gateway.closeAllConnections(); gateway.close(); } pg.close(); throw error; }
}

export async function acceptExecutive(app: Awaited<ReturnType<typeof deployExecutive>>) {
  const checks: { name: string; pass: boolean; error?: string }[] = [];
  const check = async (name: string, fn: () => Promise<void>) => {
    try { await fn(); checks.push({ name, pass: true }); } catch (error) { checks.push({ name, pass: false, error: String(error) }); }
  };
  const call = async (url: string, method = 'GET', data?: unknown, cookie = '') => {
    const r = await app.request(url, method, data, cookie); assert.ok(r.status >= 200 && r.status < 300, `${url}: ${r.status}`); return r;
  };
  const denied = async (url: string, method = 'GET', data?: unknown, cookie = '') => {
    const r = await app.request(url, method, data, cookie); assert.ok(r.status >= 400 && r.status < 500, `${url}: expected rejection, got ${r.status}`);
  };
  let a = '', b = '', id = 0, other = 0;
  await check('HTTPS reachability', async () => { const r = await call('/'); assert.match(r.text, /<html/i); });
  await check('two accounts and login', async () => {
    await call('/api/signup', 'POST', { email: 'one@example.invalid', password: 'test-password-1' });
    other = (await call('/api/signup', 'POST', { email: 'two@example.invalid', password: 'test-password-2' })).json.id;
    a = (await call('/api/login', 'POST', { email: 'one@example.invalid', password: 'test-password-1' })).cookie;
    b = (await call('/api/login', 'POST', { email: 'two@example.invalid', password: 'test-password-2' })).cookie;
    assert.ok(a && b);
  });
  await check('logged out access denied', async () => { await denied('/api/tickets'); });
  await check('create assign comment statuses edit and search', async () => {
    const t = (await call('/api/tickets', 'POST', { title: 'release needle', description: 'Keep this description' }, a)).json; id = t.id;
    assert.equal(t.status, 'open');
    assert.equal((await call(`/api/tickets/${id}`, 'PATCH', { assignee: other }, a)).json.assignee, other);
    await call(`/api/tickets/${id}/comments`, 'POST', { body: 'commentmarker' }, b);
    for (const status of ['open', 'in_progress', 'done']) assert.equal((await call(`/api/tickets/${id}`, 'PATCH', { status }, a)).json.status, status);
    assert.equal((await call(`/api/tickets/${id}`, 'PATCH', { title: 'edited needle' }, a)).json.title, 'edited needle');
    for (const q of ['needle', 'commentmarker']) assert.ok((await call('/api/tickets?q=' + q, 'GET', undefined, a)).json.some((t: any) => t.id === id));
    await denied(`/api/tickets/${id}`);
    await denied(`/api/tickets/${id}`, 'PATCH', { title: 'unauthorized' });
    await denied(`/api/tickets/${id}/comments`, 'POST', { body: 'unauthorized' });
  });
  await check('account ownership and invalid input', async () => {
    await denied('/api/users/' + other, 'PATCH', { email: 'stolen@example.invalid' }, a);
    for (const update of [{ assignee: 999999 }, { status: 'imaginary' }, { title: '' }]) await denied(`/api/tickets/${id}`, 'PATCH', update, a);
    await denied('/api/tickets', 'POST', { title: '' }, a);
  });
  await check('logout invalidates copied session', async () => {
    await call('/api/logout', 'POST', {}, b); await denied('/api/tickets', 'GET', undefined, b);
  });
  await check('first restart preserves work', async () => {
    await app.restart(); a = (await call('/api/login', 'POST', { email: 'one@example.invalid', password: 'test-password-1' })).cookie;
    const t = (await call('/api/tickets/' + id, 'GET', undefined, a)).json;
    assert.equal(t.title, 'edited needle'); assert.equal(t.description, 'Keep this description'); assert.equal(t.assignee, other); assert.equal(t.status, 'done'); assert.equal(t.comments[0].body, 'commentmarker');
  });
  const csv = 'external_id,title,description\next-1,Imported alpha,one\next-2,Imported beta,two\n';
  await check('Python import is authenticated and idempotent', async () => {
    await denied('/api/import', 'POST', { csv });
    await call('/api/import', 'POST', { csv }, a); await call('/api/import', 'POST', { csv }, a);
    assert.equal((await call('/api/tickets?q=Imported', 'GET', undefined, a)).json.length, 2);
    await denied('/api/import', 'POST', { csv: 'external_id,title,description\next-3,Valid,x\next-4,,bad\n' }, a);
    assert.equal((await call('/api/tickets?q=Valid', 'GET', undefined, a)).json.length, 0);
  });
  await check('interrupted import retries without loss or duplicates', async () => {
    const lock = spawn(tool('psql'), ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', 'BEGIN; LOCK tickets IN ACCESS EXCLUSIVE MODE; SELECT pg_sleep(60); ROLLBACK;'],
      { env: { ...cleanEnv(), ...app.pg.env, PGAPPNAME: 'mtb-import-lock' }, stdio: 'ignore', detached: true });
    const waitFor = async (sql: string) => {
      for (let i = 0; i < 100; i++) { if (Number(app.pg.sql(sql)) > 0) return; await new Promise(resolve => setTimeout(resolve, 30)); }
      throw new Error('Import interruption did not reach the observed database boundary');
    };
    let pending: Promise<unknown> | undefined;
    try {
      await waitFor("SELECT COUNT(*) FROM pg_stat_activity WHERE application_name='mtb-import-lock' AND wait_event='PgSleep'");
      const csv = 'external_id,title,description\nretry-1,Retry alpha,one\nretry-2,Retry beta,two\n';
      pending = app.request('/api/import', 'POST', { csv }, a).catch(() => null);
      await waitFor("SELECT COUNT(*) FROM pg_stat_activity WHERE usename='mtb_app' AND wait_event_type='Lock'");
      await app.restart();
      app.pg.sql("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name='mtb-import-lock'");
      await pending;
      for (let i = 0; i < 2; i++) await call('/api/import', 'POST', { csv }, a);
      assert.equal((await call('/api/tickets?q=Retry', 'GET', undefined, a)).json.length, 2);
    } finally {
      app.pg.sql("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name='mtb-import-lock'");
      stop(lock); if (pending) await pending;
    }
  });
  await check('second restart preserves accounts and imports', async () => {
    await app.restart(); b = (await call('/api/login', 'POST', { email: 'two@example.invalid', password: 'test-password-2' })).cookie;
    assert.equal((await call('/api/tickets?q=Imported', 'GET', undefined, b)).json.length, 2);
  });
  await check('200 tickets and list within five seconds', async () => {
    for (let i = 0; i < 200; i++) await call('/api/tickets', 'POST', { title: 'batch-' + i, description: 'load test' }, b);
    const start = performance.now(), list = await call('/api/tickets?q=batch-', 'GET', undefined, b);
    assert.equal(list.json.length, 200); assert.ok(performance.now() - start < 5000);
    await call('/');
  });
  return { version: 'mtb-executive-acceptance/2', checks, appPass: checks.every(c => c.pass), fullPass: null, comparisonEligible: false };
}
