const express = require('express');
const { requireAuth } = require('../lib/auth');
const clock = require('../lib/clock');
const { invoiceTotal, formatMoney, itemsFor } = require('../lib/invoice');
const { isOverdue } = require('../lib/overdue');

const router = express.Router();

function listInvoices(db, { status, q }) {
  const where = ['i.deleted_at IS NULL'];
  const params = [];
  if (q) { where.push('(i.number LIKE ? OR c.name LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  if (status === 'paid') where.push("i.status = 'paid'");
  if (status === 'unpaid' || status === 'overdue') where.push("i.status != 'paid'");
  const rows = db.prepare(`
    SELECT i.*, c.name AS client_name, c.timezone AS client_timezone
    FROM invoices i JOIN clients c ON c.id = i.client_id
    WHERE ${where.join(' AND ')}
    ORDER BY i.due_on DESC
  `).all(...params);
  const now = clock.now();
  const enriched = rows.map((row) => ({
    ...row,
    total: invoiceTotal(itemsFor(db, row.id)),
    overdue: isOverdue(row, now, { timezone: row.client_timezone }),
  }));
  return status === 'overdue' ? enriched.filter((r) => r.overdue) : enriched;
}

router.get('/invoices', requireAuth, (req, res) => {
  const filter = { status: req.query.status || '', q: req.query.q || '' };
  res.render('invoices/index', { invoices: listInvoices(req.app.locals.db, filter), filter, formatMoney });
});

module.exports = router;
module.exports.listInvoices = listInvoices;
