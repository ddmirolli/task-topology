const express = require('express');
const { requireAuth } = require('../lib/auth');
const { invoiceTotal, itemsFor } = require('../lib/invoice');

const router = express.Router();

// Read only JSON used by the mobile app. Field names are part of the contract.
router.get('/api/invoices/:id', requireAuth, (req, res) => {
  const db = req.app.locals.db;
  const row = db.prepare(`
    SELECT i.*, c.name AS client_name
    FROM invoices i JOIN clients c ON c.id = i.client_id
    WHERE i.id = ?
  `).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json({
    id: row.id,
    number: row.number,
    client_id: row.client_id,
    client: { id: row.client_id, name: row.client_name },
    status: row.status,
    issued_on: row.issued_on,
    due_on: row.due_on,
    total: invoiceTotal(itemsFor(db, row.id)),
  });
});

module.exports = router;
