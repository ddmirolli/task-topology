const express = require('express');
const { requireAuth } = require('../lib/auth');

const router = express.Router();

router.get('/clients', requireAuth, (req, res) => {
  const clients = req.app.locals.db.prepare('SELECT * FROM clients ORDER BY name').all();
  res.render('clients/index', { clients });
});

router.get('/clients/:id/delete', requireAuth, (req, res) => {
  const clientRow = req.app.locals.db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!clientRow) return res.status(404).send('Not found');
  res.render('clients/confirm-delete', { clientRow });
});

router.post('/clients/:id/delete', requireAuth, (req, res) => {
  req.app.locals.db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
  res.redirect('/clients');
});

module.exports = router;
