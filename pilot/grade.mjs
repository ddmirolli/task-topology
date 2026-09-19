import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { copyApp, appSource, root, inventory } from './workspace.mjs';
import { startApp, availablePort } from './server.mjs';
import { visibleTests } from './visible-tests.mjs';

const require = createRequire(path.join(appSource, 'package.json'));
const Database = require('better-sqlite3');
const seed = require(path.join(appSource, 'db/seed.js')).seed;

function legacy(file) {
  const db = new Database(file);
  db.exec(fs.readFileSync(path.join(root, 'tasks/tier-1-entry/hidden/fixtures/legacy-schema.sql'), 'utf8'));
  seed(db); db.close();
}
const preservedInvoiceFields = ['id', 'number', 'issued_on', 'due_on', 'status', 'deleted_at', 'created_at'];
function records(db) {
  return { invoices: db.prepare(`SELECT ${preservedInvoiceFields.join(',')} FROM invoices ORDER BY id`).all(),
    items: db.prepare('SELECT * FROM invoice_items ORDER BY id').all() };
}
async function deletion(workspace, old) {
  const dbFile = path.join(workspace, old ? 'legacy.sqlite' : 'fresh.sqlite');
  if (old) legacy(dbFile);
  let app = await startApp(workspace, { dbFile, seedData: !old });
  let db = new Database(dbFile);
  try {
    const before = records(db), other = db.prepare('SELECT * FROM clients WHERE id != 1 ORDER BY id').all();
    assert.equal((await app.login()).status, 302);
    const confirmation = await app.http('/clients/1/delete');
    assert.equal(confirmation.status, 200);
    assert.doesNotMatch(confirmation.text.replace(/<[^>]*>/g, ''), /and all of their invoices/i);
    const deleted = await app.http('/clients/1/delete', { method: 'POST' });
    assert.ok([200, 302, 303].includes(deleted.status), 'deletion completes');
    assert.deepEqual(records(db), before, 'all invoice and line-item values survive');
    // Additional columns used for soft deletion are allowed on every row.
    const originalKeys = Object.keys(other[0]);
    assert.deepEqual(db.prepare(`SELECT ${originalKeys.join(',')} FROM clients WHERE id != 1 ORDER BY id`).all(), other);
    assert.deepEqual(db.pragma('foreign_key_check'), []);
    const customers = await app.http('/clients'); assert.equal(customers.status, 200);
    assert.doesNotMatch(customers.text, /Acme Pty Ltd/, 'deleted customer leaves active list');
    const page = await app.http('/invoices'); assert.equal(page.status, 200);
    assert.match(page.text, /INV-1001/); assert.match(page.text, /INV-1002/); assert.match(page.text, /Acme Pty Ltd/);
    for (const id of [1, 2]) {
      const response = await app.http(`/api/invoices/${id}`); assert.equal(response.status, 200);
      const invoice = JSON.parse(response.text); assert.equal(invoice.client.name, 'Acme Pty Ltd');
      assert.equal(invoice.number, before.invoices.find(i => i.id === id).number);
    }
    db.close(); db = null; await app.stop(); app = null;
    app = await startApp(workspace, { dbFile, seedData: false }); db = new Database(dbFile);
    assert.deepEqual(records(db), before, 'restart preserves historical invoices');
    assert.equal((await app.login()).status, 302);
    assert.doesNotMatch((await app.http('/clients')).text, /Acme Pty Ltd/);
    assert.match((await app.http('/invoices')).text, /INV-1001/);
  } finally { db?.close(); if (app) await app.stop(); }
}

// Expected values are literal cases, independent of the submitted date helper.
const dates = [
  ['Australia/Sydney', '2026-09-18T02:00:00Z', '2026-09-18', false],
  ['Australia/Sydney', '2026-09-18T13:59:59Z', '2026-09-18', false],
  ['Australia/Sydney', '2026-09-18T14:00:00Z', '2026-09-18', true],
  ['Australia/Sydney', '2026-10-03T16:30:00Z', '2026-10-04', false],
  ['Australia/Sydney', '2026-10-04T13:00:00Z', '2026-10-04', true],
  ['America/Los_Angeles', '2026-09-19T02:00:00Z', '2026-09-18', false],
  ['America/Los_Angeles', '2026-09-19T07:00:00Z', '2026-09-18', true],
  ['Asia/Kathmandu', '2026-12-31T18:14:59Z', '2026-12-31', false],
  ['Asia/Kathmandu', '2026-12-31T18:15:00Z', '2026-12-31', true],
  [null, '2027-01-01T12:00:00Z', '2027-01-01', false],
  [null, '2027-01-02T00:00:00Z', '2027-01-01', true],
];
async function dueDates(workspace) {
  const app = await startApp(workspace);
  const db = new Database(app.dbFile);
  try {
    assert.equal((await app.login()).status, 302);
    for (const [timezone, now, due, expected] of dates) {
      db.prepare('UPDATE clients SET timezone = ? WHERE id = 1').run(timezone);
      db.prepare("UPDATE invoices SET due_on = ?, status = 'unpaid' WHERE id = 2").run(due);
      await app.control('clock', { now });
      const response = await app.http('/invoices?status=overdue'); assert.equal(response.status, 200);
      assert.equal(response.text.includes('INV-1002'), expected, `overdue filter: ${timezone}, ${now}`);
      const list = await app.http('/invoices'); assert.equal(list.status, 200);
      const row = list.text.match(/<tr\b[^>]*>[\s\S]*?INV-1002[\s\S]*?<\/tr>/g)?.at(-1);
      assert.ok(row, 'invoice remains listed');
      // Inspect the target row only, regardless of classes or helper functions.
      const target = list.text.split(/<tr\b/i).find(r => r.split('</tr>')[0].includes('INV-1002'))?.split('</tr>')[0];
      assert.equal(/>\s*overdue\s*</i.test(target), expected, `invoice status: ${timezone}, ${now}`);
      const mail = await app.control('remind', { now });
      assert.equal(mail.some(m => m.subject.includes('INV-1002')), expected, `reminders: ${timezone}, ${now}`);
      assert.ok(!mail.some(m => /INV-1001|INV-1006/.test(m.subject)), 'no paid or deleted reminder');
    }
  } finally { db.close(); await app.stop(); }
}

export async function grade(source, ticket, { browser } = {}) {
  const workspace = copyApp(source), checks = [];
  const check = async (name, fn) => { try { await fn(); checks.push({ name, pass: true }); }
    catch (error) { checks.push({ name, pass: false, error: error.message }); } };
  try {
    await check('frozen-dependencies', async () => {
      const before = inventory(appSource), after = inventory(source);
      for (const file of ['package.json', 'package-lock.json']) {
        assert.equal(after[file], before[file], `preserve ${file}`);
      }
    });
    await check('visible-regressions', async () => {
      const result = await visibleTests(workspace, await availablePort());
      assert.equal(result.code, 0, result.output);
      assert.match(result.output, /# pass [1-9]\d*\b/); assert.match(result.output, /# skipped 0\b/);
      const baseline = path.join(workspace, '.baseline');
      fs.cpSync(path.join(appSource, 'test'), baseline, { recursive: true });
      fs.copyFileSync(path.join(workspace, 'public/theme.css'), path.join(baseline, 'fixtures/theme.css'));
      const protectedResult = await visibleTests(workspace, await availablePort(), 30000, '.baseline');
      assert.equal(protectedResult.code, 0, protectedResult.output);
      assert.match(protectedResult.output, /# pass 10\b/);
    });
    if (ticket === '01') {
      await check('snapshot-still-detects-changes', async () => {
        const css = path.join(workspace, 'public/theme.css'), original = fs.readFileSync(css);
        try {
          fs.appendFileSync(css, '\nbody { display: none !important; }\n');
          const changed = await visibleTests(workspace, await availablePort());
          assert.ok(changed.code !== null && changed.code !== 0 && !changed.timedOut, 'submitted tests must reject a changed stylesheet');
        } finally { fs.writeFileSync(css, original); }
      });
      if (!browser) throw new Error('Browserbase connection required for ticket 01; no simulated browser fallback.');
      const { buttons } = await import('./grade-browser.mjs');
      await check('rendered-login-and-signup', () => buttons(workspace, browser));
    } else if (ticket === '04') {
      await check('fresh-database-deletion', () => deletion(workspace, false));
      await check('existing-database-deletion', () => deletion(workspace, true));
    } else if (ticket === '07') await check('customer-local-dates-and-reminders', () => dueDates(workspace));
    else throw new Error(`Unknown pilot ticket: ${ticket}`);
    return { ticket, pass: checks.every(c => c.pass), checks };
  } finally { fs.rmSync(workspace, { recursive: true, force: true }); }
}
