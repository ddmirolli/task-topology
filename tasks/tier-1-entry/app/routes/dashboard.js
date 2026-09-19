const express = require('express');
const { requireAuth } = require('../lib/auth');

const router = express.Router();

router.get('/dashboard', requireAuth, (req, res) => {
  const db = req.app.locals.db;
  const clients = db.prepare('SELECT * FROM clients ORDER BY name').all();
  const rows = clients.map((client) => ({
    ...client,
    invoiceCount: db
      .prepare('SELECT COUNT(*) AS n FROM invoices WHERE client_id = ? AND deleted_at IS NULL')
      .get(client.id).n,
  }));
  const unpaid = db
    .prepare("SELECT COUNT(*) AS n FROM invoices WHERE status != 'paid' AND deleted_at IS NULL")
    .get().n;
  res.render('dashboard', { rows, unpaid });
});

module.exports = router;
