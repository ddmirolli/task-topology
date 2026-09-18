const express = require('express');
const clock = require('../lib/clock');
const { findUserByEmail, setPassword } = require('../lib/user');
const { createResetToken, findResetToken, deleteResetToken } = require('../lib/token');
const { sendResetEmail } = require('../lib/email/reset');

const router = express.Router();

function validToken(db, token) {
  const row = findResetToken(db, token);
  if (!row) return null;
  if (row.expires_at < clock.now().getTime()) return null;
  return row;
}

router.get('/forgot', (req, res) => res.render('forgot', { sent: false }));

router.post('/forgot', (req, res) => {
  const db = req.app.locals.db;
  const user = findUserByEmail(db, req.body.email);
  if (user) sendResetEmail(user.email, createResetToken(db, user.id));
  res.render('forgot', { sent: true });
});

router.get('/reset/:token', (req, res) => {
  const row = validToken(req.app.locals.db, req.params.token);
  if (!row) return res.status(400).render('reset', { token: null, error: 'This link has expired. Request a new one.' });
  res.render('reset', { token: req.params.token, error: null });
});

router.post('/reset/:token', (req, res) => {
  const db = req.app.locals.db;
  const row = validToken(db, req.params.token);
  if (!row) return res.status(400).render('reset', { token: null, error: 'This link has expired. Request a new one.' });
  if ((req.body.password || '').length < 8) {
    return res.status(400).render('reset', { token: req.params.token, error: 'Password must be at least 8 characters.' });
  }
  setPassword(db, row.user_id, req.body.password);
  deleteResetToken(db, req.params.token);
  res.redirect('/login');
});

module.exports = router;
