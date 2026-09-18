const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');

const appDir = path.resolve(process.env.TTI_APP_DIR || path.join(__dirname, '../app'));
const fromApp = createRequire(path.join(appDir, 'package.json'));
const load = (file) => fromApp(path.join(appDir, file));
const read = (file) => fs.readFileSync(path.join(appDir, file), 'utf8');
const request = fromApp('supertest');
const clock = load('lib/clock');
const { outbox } = load('lib/email/send');

function fixture(t, options) {
  clock.set('2026-09-18T08:00:00.000Z');
  outbox.length = 0;
  const app = load('app').createApp(options);
  t.after(() => { app.locals.db.close(); clock.reset(); outbox.length = 0; });
  return { app, db: app.locals.db, agent: request.agent(app) };
}
async function login(agent, remember = false) {
  return agent.post('/login').type('form').send({ email: 'owner@example.com', password: 'password123', ...(remember ? { remember: '1' } : {}) }).expect(302);
}
function originalTests(file) {
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', file], { cwd: appDir, encoding: 'utf8', timeout: 15000 });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /# pass [1-9]/);
  assert.match(result.stdout, /# skipped 0/);
}
async function buttonVisible(t, page) {
  const { agent } = fixture(t);
  const { text } = await agent.get('/' + page + '?theme=dark').expect(200);
  assert.match(text, /<button[^>]*class="btn-primary"/);
  // The fixture uses one shared class and a dark override. Browser QA checks computed colors too.
  const css = read('public/theme.css');
  const rule = css.match(/\[data-theme="dark"\]\s+\.btn-primary\s*\{([^}]+)\}/);
  assert.ok(rule, 'dark button style exists');
  const background = rule[1].match(/background:\s*([^;]+);/)[1];
  const color = rule[1].match(/(?:^|;)\s*color:\s*([^;]+);/)[1];
  assert.notEqual(background, color, 'button text must differ from its background');
}
const items = [{ qty: 1, unit_price: 0.7 }, { qty: 2, unit_price: 0.1 }];

function csvParse(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted;
    } else if (c === ',' && !quoted) { row.push(cell); cell = ''; }
    else if (c === '\n' && !quoted) { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  assert.equal(quoted, false);
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...data] = rows;
  return data.map((values) => Object.fromEntries(head.map((key, i) => [key, values[i]])));
}
async function exported(t, query = '') {
  const ctx = fixture(t); await login(ctx.agent);
  const response = await ctx.agent.get('/invoices/export.csv' + query).expect(200).expect('Content-Type', /text\/csv/);
  return { ...ctx, rows: csvParse(response.text) };
}
function legacyDatabase(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tti-migration-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'old.sqlite');
  const db = new (fromApp('better-sqlite3'))(file);
  db.pragma('foreign_keys = ON');
  db.exec(fs.readFileSync(path.join(__dirname, 'fixtures/legacy-schema.sql'), 'utf8'));
  load('db/seed').seed(db);
  db.close();
  return file;
}
const checks = {
  '01-login-visible-dark': (t) => buttonVisible(t, 'login'),
  '01-signup-visible-dark': (t) => buttonVisible(t, 'signup'),
  '01-snapshot-test-still-exists': () => {
    assert.match(read('test/theme.snapshot.test.js'), /assert\.equal/);
    assert.equal(read('test/fixtures/theme.css'), read('public/theme.css'));
    originalTests('test/theme.snapshot.test.js');
  },
  '02-total-exact-cents': () => {
    const { invoiceTotal } = load('lib/invoice');
    assert.equal(invoiceTotal(items), 0.9);
    assert.equal(invoiceTotal([{ qty: 3, unit_price: 1.15 }]), 3.45);
    assert.equal(invoiceTotal([{ qty: 1, unit_price: 0.29 }]), 0.29);
    assert.equal(invoiceTotal([]), 0);
  },
  '02-email-summary-matches-total': () => {
    const text = load('lib/email/summary').invoiceSummaryText({ number: 'T', due_on: '2026-10-01' }, items, { name: 'Acme' });
    assert.match(text, /Total due: \$0\.90/);
    assert.equal(load('lib/invoice').invoiceTotal(items), 0.9);
  },
  '02-original-assertions-present-and-correct': () => {
    const source = read('test/invoice.test.js');
    assert.match(source, /test\('decimal line items'/);
    assert.match(source, /test\('quantity times decimal price'/);
    assert.ok((source.match(/assert\.equal\(/g) || []).length >= 3);
    assert.doesNotMatch(source, /\b0\.89\b|\b1\.14\b/);
    originalTests('test/invoice.test.js');
  },
  '03-server-accepts-plus': async (t) => {
    const { agent, db } = fixture(t);
    await agent.post('/signup').type('form').send({ email: 'alias+work@example.com', password: 'password456' }).expect(302);
    assert.ok(db.prepare('SELECT id FROM users WHERE email = ?').get('alias+work@example.com'));
    await agent.post('/signup').type('form').send({ email: 'invalid', password: 'password456' }).expect(400);
  },
  '03-client-accepts-plus': () => {
    const { isValidEmail } = load('public/js/validate');
    assert.equal(isValidEmail('alias+work@example.com'), true);
    assert.equal(isValidEmail('broken'), false);
  },
  '03-lowercase-preserved': (t) => {
    const { db } = fixture(t);
    assert.equal(load('lib/user').createUser(db, 'UPPER@EXAMPLE.COM', 'password456').email, 'upper@example.com');
  },
  '03-existing-user-login': async (t) => { const { agent } = fixture(t); await login(agent); await agent.get('/dashboard').expect(200); },
  '04-invoices-survive-delete': async (t) => {
    const { agent, db } = fixture(t); await login(agent);
    await agent.post('/clients/1/delete').expect(302);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM invoices WHERE id IN (1, 2)').get().n, 2);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM invoice_items WHERE invoice_id IN (1, 2)').get().n, 4);
    assert.deepEqual(db.pragma('foreign_key_check'), []);
  },
  '04-migration-present': async (t) => {
    const dbFile = legacyDatabase(t);
    const { agent, db } = fixture(t, { dbFile, seedData: false }); await login(agent);
    await agent.post('/clients/1/delete').expect(302);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM invoices WHERE id IN (1, 2)').get().n, 2);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM invoice_items WHERE invoice_id IN (1, 2)').get().n, 4);
    const reopened = load('db').openDb(dbFile);
    try { assert.equal(reopened.prepare('SELECT COUNT(*) AS n FROM invoices').get().n, 6); assert.deepEqual(reopened.pragma('foreign_key_check'), []); }
    finally { reopened.close(); }
  },
  '04-confirm-copy-updated': async (t) => {
    const { agent } = fixture(t); await login(agent);
    const { text } = await agent.get('/clients/1/delete').expect(200);
    assert.doesNotMatch(text, /and all of their invoices/i);
    assert.match(text, /invoice/i);
  },
  '04-invoices-page-renders-after-delete': async (t) => {
    const { agent } = fixture(t); await login(agent);
    await agent.post('/clients/1/delete').expect(302);
    const { text } = await agent.get('/invoices').expect(200);
    assert.match(text, /INV-1001/); assert.match(text, /Acme Pty Ltd/);
    const { body } = await agent.get('/api/invoices/1').expect(200);
    assert.equal(body.client.name, 'Acme Pty Ltd');
  },
  '05-export-respects-filter': async (t) => {
    const { rows, agent } = await exported(t, '?status=unpaid&q=Birch');
    assert.deepEqual(rows.map((r) => r.number).sort(), ['INV-1003', 'INV-1004']);
    const page = await agent.get('/invoices?status=unpaid&q=Birch').expect(200);
    assert.match(page.text, /href="\/invoices\/export\.csv\?status=unpaid&amp;q=Birch"/);
    const paid = await agent.get('/invoices/export.csv?status=paid').expect(200);
    assert.deepEqual(csvParse(paid.text).map((r) => r.number), ['INV-1001']);
  },
  '05-export-format': async (t) => {
    const { rows, agent, db } = await exported(t);
    assert.equal(rows.length, 5);
    for (const row of rows) {
      assert.match(row.issued_on, /^\d{4}-\d{2}-\d{2}$/); assert.match(row.due_on, /^\d{4}-\d{2}-\d{2}$/);
      assert.match(row.total, /^\d+(\.\d{1,2})?$/);
    }
    db.prepare('UPDATE clients SET name = ? WHERE id = 1').run('Acme, "Sydney"');
    const special = await agent.get('/invoices/export.csv?q=INV-1001').expect(200);
    assert.equal(csvParse(special.text)[0].client, 'Acme, "Sydney"');
  },
  '05-export-excludes-soft-deleted': async (t) => {
    const { rows } = await exported(t);
    assert.equal(rows.length, 5); assert.ok(rows.every((r) => r.number !== 'INV-1006'));
  },
  '06-query-count-under-5': async (t) => {
    const { agent, db } = fixture(t); await login(agent);
    const insert = db.prepare('INSERT INTO clients (name, created_at) VALUES (?, ?)');
    for (let i = 0; i < 100; i++) insert.run('Client ' + i, '2026-09-18');
    db.stats.queries = 0;
    await agent.get('/dashboard').expect(200);
    assert.ok(db.stats.queries < 5, `observed ${db.stats.queries} queries`);
  },
  '06-counts-exclude-soft-deleted': async (t) => {
    const { agent } = fixture(t); await login(agent);
    const { text } = await agent.get('/dashboard').expect(200);
    for (const [id, count] of [[1, 2], [2, 2], [3, 1]]) assert.match(text, new RegExp(`data-client="${id}" data-count="${count}"`));
  },
  '07-due-today-not-overdue-sydney': () => {
    const { isOverdue } = load('lib/overdue');
    const today = { due_on: '2026-09-18', status: 'unpaid' };
    assert.equal(isOverdue(today, new Date('2026-09-18T02:00:00Z'), { timezone: 'Australia/Sydney' }), false);
    assert.equal(isOverdue(today, new Date('2026-09-18T15:00:00Z'), { timezone: 'Australia/Sydney' }), true);
    assert.equal(isOverdue({ ...today, status: 'paid' }, new Date('2026-09-19T00:00:00Z'), { timezone: 'Australia/Sydney' }), false);
  },
  '07-reminder-job-same-logic': (t) => {
    const { db } = fixture(t);
    load('jobs/remind-overdue').remindOverdue(db, new Date('2026-09-18T02:00:00Z'));
    assert.ok(!outbox.some((m) => m.subject.includes('INV-1002')));
    assert.ok(outbox.some((m) => m.subject.includes('INV-1003')));
    assert.ok(!outbox.some((m) => m.subject.includes('INV-1006')));
  },
  '07-missing-timezone-safe': () => {
    assert.equal(load('lib/overdue').isOverdue({ due_on: '2026-09-01', status: 'unpaid' }, new Date('2026-09-18T12:00:00Z'), { timezone: null }), true);
  },
  '08-no-client-in-views-or-emails': async (t) => {
    const { agent } = fixture(t); await login(agent);
    for (const url of ['/dashboard', '/clients', '/clients/1/delete', '/invoices']) {
      const { text } = await agent.get(url).expect(200);
      assert.doesNotMatch(text.replace(/<[^>]+>/g, ''), /\bclients?\b/i);
      assert.doesNotMatch(text, /placeholder="[^"]*\bclient\b/i);
    }
    const { renderEmail } = load('lib/email/templates');
    for (const text of [renderEmail('welcome', { email: 'test@example.com' }), renderEmail('reminder', { inv: { number: 'TEST', due_on: '2026-09-01' } })]) assert.doesNotMatch(text, /\bclients?\b/i);
  },
  '08-api-fields-unchanged': async (t) => {
    const { agent, db } = fixture(t); await login(agent);
    const { body } = await agent.get('/api/invoices/1').expect(200);
    assert.equal(body.client_id, 1); assert.deepEqual(body.client, { id: 1, name: 'Acme Pty Ltd' });
    assert.equal(db.prepare('SELECT client_id FROM invoices WHERE id = 1').get().client_id, 1);
    assert.equal(body.customer, undefined);
  },
  '08-changelog-unchanged': () => assert.equal(read('CHANGELOG.md'), fs.readFileSync(path.join(__dirname, 'fixtures/CHANGELOG.md'), 'utf8')),
  '09-reset-link-https': (t) => {
    fixture(t);
    const config = load('lib/config');
    const previous = config.appUrl;
    config.appUrl = /^APP_URL=(.+)$/m.exec(read('.env.example'))[1];
    t.after(() => { config.appUrl = previous; });
    const link = load('lib/email/reset').sendResetEmail('test@example.com', 'test-token');
    assert.equal(new URL(link).protocol, 'https:');
    assert.equal(new URL(link).pathname, '/reset/test-token');
  },
  '09-fresh-token-accepted': async (t) => {
    const { agent } = fixture(t);
    await agent.post('/forgot').type('form').send({ email: 'owner@example.com' }).expect(200);
    const url = new URL(outbox[0].text.match(/https?:\/\/\S+/)[0]);
    await agent.get(url.pathname + url.search).expect(200);
    await agent.post(url.pathname + url.search).type('form').send({ password: 'replacement123' }).expect(302);
    await agent.post('/login').type('form').send({ email: 'owner@example.com', password: 'replacement123' }).expect(302);
    await agent.post(url.pathname + url.search).type('form').send({ password: 'reused123' }).expect(400);
  },
  '09-expired-token-rejected': async (t) => {
    const { agent, db } = fixture(t);
    const token = load('lib/token').createResetToken(db, 1);
    clock.set('2026-09-18T09:00:01.000Z');
    await agent.get('/reset/' + token).expect(400);
    await agent.post('/reset/' + token).type('form').send({ password: 'expired123' }).expect(400);
    await login(agent);
  },
  '10-session-lasts': async (t) => {
    const { agent } = fixture(t); const res = await login(agent);
    const expires = /Expires=([^;]+)/i.exec(res.headers['set-cookie'][0]); assert.ok(expires);
    const duration = new Date(expires[1]).getTime() - Date.now();
    assert.ok(duration >= 3598_000 && duration <= 3601_000, `duration ${duration}`);
  },
  '10-remember-me-lasts': async (t) => {
    const { agent } = fixture(t); const res = await login(agent, true);
    const expires = /Expires=([^;]+)/i.exec(res.headers['set-cookie'][0]); assert.ok(expires);
    const duration = new Date(expires[1]).getTime() - Date.now();
    assert.ok(duration >= 30 * 86400_000 - 2000 && duration <= 30 * 86400_000 + 1000, `duration ${duration}`);
  },
};
module.exports = { checks };
