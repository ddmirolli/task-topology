import fs from 'node:fs';
import path from 'node:path';
import { prepare } from '../tasks/tier-1-entry/scripts/prepare.mjs';

const replace = (dir, file, before, after) => {
  const p = path.join(dir, file), text = fs.readFileSync(p, 'utf8');
  if (!text.includes(before)) throw new Error(`Fixture replacement missing in ${file}`);
  fs.writeFileSync(p, text.replace(before, after));
};
export function fixture(ticket, variant) {
  const dir = prepare({ fixes: variant === 'reference' || variant.startsWith('partial') ? [ticket] : [] });
  if (variant === 'broken' || variant === 'reference') return dir;
  if (ticket === '01') {
    if (variant === 'alternative') {
      for (const page of ['login', 'signup']) replace(dir, `views/${page}.ejs`, 'class="btn-primary"', 'class="auth-submit"');
      const css = fs.readFileSync(path.join(dir, 'public/theme.css'), 'utf8') + '\n.auth-submit { background: #ffffff; color: #111111; padding: 0.5rem 1rem; border: 2px solid #111111; }\n';
      fs.writeFileSync(path.join(dir, 'public/theme.css'), css); fs.writeFileSync(path.join(dir, 'test/fixtures/theme.css'), css);
      replace(dir, 'test/theme.snapshot.test.js', 'assert.equal(', 'assert.deepStrictEqual(');
    } else if (variant === 'partial-signup') {
      replace(dir, 'views/signup.ejs', 'class="btn-primary"', 'style="color:#1a202c;background:#1a202c"');
    } else if (variant === 'partial-hidden') {
      replace(dir, 'views/login.ejs', 'class="btn-primary"', 'class="btn-primary" style="display:none"');
    } else if (variant === 'partial-transparent') {
      const css = fs.readFileSync(path.join(dir, 'public/theme.css'), 'utf8') + '\n.btn-primary, [data-theme="dark"] .btn-primary { background: transparent; color: var(--fg); }\n';
      fs.writeFileSync(path.join(dir, 'public/theme.css'), css); fs.writeFileSync(path.join(dir, 'test/fixtures/theme.css'), css);
    } else throw new Error('Unknown fixture');
  } else if (ticket === '04') {
    if (variant === 'alternative') {
      // Preserve the existing relationship by removing customers from the active list.
      fs.writeFileSync(path.join(dir, 'db/migrations/042-archive-customers.sql'), 'ALTER TABLE clients ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;\n');
      replace(dir, 'routes/clients.js', 'SELECT * FROM clients ORDER BY name', 'SELECT * FROM clients WHERE archived = 0 ORDER BY name');
      replace(dir, 'routes/clients.js', 'DELETE FROM clients WHERE id = ?', 'UPDATE clients SET archived = 1 WHERE id = ?');
      replace(dir, 'views/clients/confirm-delete.ejs', 'and all of their invoices?', '? Invoices stay available.');
    } else if (variant === 'partial-no-migration') {
      fs.unlinkSync(path.join(dir, 'db/migrations/001-preserve-invoices.sql'));
    } else if (variant === 'partial-erase-items') {
      replace(dir, 'routes/clients.js', "db.transaction(() => {", "db.transaction(() => {\n    db.prepare('DELETE FROM invoice_items WHERE invoice_id IN (SELECT id FROM invoices WHERE client_id = ?)').run(req.params.id);");
    } else throw new Error('Unknown fixture');
  } else if (ticket === '07') {
    if (variant === 'alternative') {
      // The list and job share a new helper; the original isOverdue export is unused.
      fs.writeFileSync(path.join(dir, 'lib/calendar-status.js'), `function pastDue(invoice, instant, customer) {
  if (invoice.status === 'paid') return false;
  const calendar = instant.toLocaleDateString('sv-SE', { timeZone: customer.timezone || 'UTC' });
  return invoice.due_on < calendar;
}
module.exports = { pastDue };
`);
      replace(dir, 'routes/invoices.js', "const { isOverdue } = require('../lib/overdue');", "const { pastDue } = require('../lib/calendar-status');");
      replace(dir, 'routes/invoices.js', 'overdue: isOverdue(', 'overdue: pastDue(');
      replace(dir, 'jobs/remind-overdue.js', "const clock = require('../lib/clock');", "const clock = require('../lib/clock');\nconst { pastDue } = require('../lib/calendar-status');");
      replace(dir, 'jobs/remind-overdue.js', 'new Date(inv.due_on) < now', 'pastDue(inv, now, inv)');
    } else if (variant === 'partial-reminders') {
      replace(dir, 'jobs/remind-overdue.js', 'isOverdue(inv, now, { timezone: inv.timezone })', 'new Date(inv.due_on) < now');
    } else if (variant === 'partial-sydney-only') {
      replace(dir, 'lib/overdue.js', "client.timezone || 'UTC'", "'Australia/Sydney'");
    } else throw new Error('Unknown fixture');
  }
  return dir;
}
