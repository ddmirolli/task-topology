// Nightly job: email a reminder for every unpaid invoice past its due date.
const clock = require('../lib/clock');
const { send } = require('../lib/email/send');
const { renderEmail } = require('../lib/email/templates');

function remindOverdue(db, now = clock.now()) {
  const rows = db.prepare(`
    SELECT i.*, c.name AS client_name, c.email AS client_email, c.timezone
    FROM invoices i JOIN clients c ON c.id = i.client_id
    WHERE i.deleted_at IS NULL AND i.status != 'paid'
  `).all();
  let sent = 0;
  for (const inv of rows) {
    if (new Date(inv.due_on) < now) {
      send({ to: inv.client_email, subject: `Invoice ${inv.number} is overdue`, text: renderEmail('reminder', { inv }) });
      sent += 1;
    }
  }
  return sent;
}

if (require.main === module) {
  const { openDb } = require('../db');
  const n = remindOverdue(openDb(process.env.DB_FILE || 'data.sqlite'));
  console.log(`Sent ${n} reminder(s)`);
}

module.exports = { remindOverdue };
