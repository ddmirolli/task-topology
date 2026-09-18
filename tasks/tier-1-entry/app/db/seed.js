const { createUser } = require('../lib/user');

function seed(db) {
  if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0) return;
  const now = '2026-09-18T00:00:00.000Z';
  createUser(db, 'owner@example.com', 'password123');

  const client = db.prepare('INSERT INTO clients (name, email, timezone, created_at) VALUES (?, ?, ?, ?)');
  client.run('Acme Pty Ltd', 'ap@acme.example', 'Australia/Sydney', now);
  client.run('Birch & Co', 'billing@birch.example', 'America/New_York', now);
  client.run('Cedar LLC', 'ar@cedar.example', null, now);

  const invoice = db.prepare('INSERT INTO invoices (client_id, number, issued_on, due_on, status, deleted_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const item = db.prepare('INSERT INTO invoice_items (invoice_id, description, qty, unit_price) VALUES (?, ?, ?, ?)');
  const add = (clientId, number, issued, due, status, deleted, items) => {
    const id = invoice.run(clientId, number, issued, due, status, deleted, now).lastInsertRowid;
    for (const [d, q, p] of items) item.run(id, d, q, p);
  };
  add(1, 'INV-1001', '2026-08-01', '2026-08-31', 'paid', null, [['Design', 1, 1200]]);
  add(1, 'INV-1002', '2026-09-01', '2026-09-18', 'unpaid', null, [['Hosting', 1, 0.7], ['Domain', 1, 0.1], ['Storage', 1, 0.1]]);
  add(2, 'INV-1003', '2026-09-05', '2026-09-12', 'unpaid', null, [['Consulting', 4, 150]]);
  add(2, 'INV-1004', '2026-09-10', '2026-10-10', 'unpaid', null, [['Support', 1, 1.15], ['Support', 1, 2.35]]);
  add(3, 'INV-1005', '2026-09-11', '2026-09-25', 'unpaid', null, [['Audit', 1, 500]]);
  add(3, 'INV-1006', '2026-07-01', '2026-07-15', 'unpaid', '2026-07-20T00:00:00Z', [['Void', 1, 99]]);
}

module.exports = { seed };
