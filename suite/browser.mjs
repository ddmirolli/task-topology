import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { root, temp } from '../.build/core/runtime.js';
import { deployExecutive } from '../.build/core/executive.js';
import { connectBrowserbase } from '../pilot/browserbase.mjs';

export async function verifyExecutiveBrowser(app, browser) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  try {
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== 'https://mtb-executive.invalid') return route.abort();
      const result = await app.request(url.pathname + url.search, request.method(), request.postData() ? JSON.parse(request.postData()) : undefined, request.headers().cookie ?? '');
      await route.fulfill({ status: result.status, body: result.text, headers: {
        'content-type': url.pathname === '/' ? 'text/html' : url.pathname === '/ui.js' ? 'text/javascript' : 'application/json',
        ...(result.cookie ? { 'set-cookie': result.cookie + '; Path=/; SameSite=Strict' } : {}),
      } });
    });
    const page = await context.newPage(); page.setDefaultTimeout(10_000);
    await page.goto('https://mtb-executive.invalid/');
    await page.getByLabel('Email', { exact: true }).fill('browser@example.invalid');
    await page.getByLabel('Password', { exact: true }).fill('browser-password');
    await page.getByRole('button', { name: 'Sign up', exact: true }).click();
    await page.getByText('Account created. Log in.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await page.getByLabel('Title', { exact: true }).fill('Browser ticket');
    await page.getByLabel('Description', { exact: true }).fill('Created through the TypeScript interface');
    await page.getByRole('button', { name: 'Create ticket', exact: true }).click();
    await page.getByRole('button', { name: 'Browser ticket', exact: true }).waitFor();
    await page.getByLabel('Edit title', { exact: true }).fill('Browser edited');
    await page.getByLabel('Assignee', { exact: true }).selectOption({ label: 'browser@example.invalid' });
    await page.getByLabel('Status', { exact: true }).selectOption('in_progress');
    await page.getByRole('button', { name: 'Save ticket', exact: true }).click();
    await page.getByRole('button', { name: 'Browser edited', exact: true }).waitFor();
    await page.getByLabel('Comment', { exact: true }).fill('browser-comment-marker');
    await page.getByRole('button', { name: 'Add comment', exact: true }).click();
    await page.getByText('browser-comment-marker', { exact: true }).waitFor();
    await page.getByLabel('Search', { exact: true }).fill('browser-comment-marker');
    await page.getByRole('button', { name: 'Search tickets', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Browser edited', exact: true }).count(), 1);
    await page.getByRole('button', { name: 'Log out', exact: true }).click();
    await page.getByRole('button', { name: 'Log in', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Browser edited', exact: true }).count(), 0);
    return { pass: true, browser: 'Browserbase', coverage: ['signup', 'login', 'create', 'edit', 'assign', 'status', 'comment', 'search', 'logout'] };
  } finally { await context.close(); }
}
if (process.argv[1]?.endsWith('/suite/browser.mjs')) {
  const output = process.argv[2]; assert.ok(output && !fs.existsSync(output));
  const dir = temp('mtb-executive-browser-'); let app, connection;
  try {
    app = await deployExecutive(dir, path.join(root, 'tasks/tier-3-executive/reference'));
    connection = await connectBrowserbase();
    const result = { ...await verifyExecutiveBrowser(app, connection.browser), sessionId: connection.sessionId };
    fs.writeFileSync(output, JSON.stringify(result, null, 2), { flag: 'wx', mode: 0o600 }); console.log(JSON.stringify(result));
  } finally { if (connection) await connection.close(); if (app) await app.close(); fs.rmSync(dir, { recursive: true, force: true }); }
}
