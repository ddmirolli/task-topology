const express = require('express');
const { isValidEmail } = require('../lib/validate');
const { createUser, findUserByEmail, verifyPassword } = require('../lib/user');
const { send } = require('../lib/email/send');
const { renderEmail } = require('../lib/email/templates');

const router = express.Router();

router.get('/login', (req, res) => res.render('login', { error: null }));

router.post('/login', (req, res) => {
  const db = req.app.locals.db;
  const user = findUserByEmail(db, req.body.email);
  if (!user || !verifyPassword(req.body.password || '', user.password_hash)) {
    return res.status(401).render('login', { error: 'Wrong email or password.' });
  }
  req.session.userId = user.id;
  if (req.body.remember) {
    req.session.cookie.maxAge = 30 * 24 * 3600; // thirty days
  }
  res.redirect('/dashboard');
});

router.get('/signup', (req, res) => res.render('signup', { error: null }));

router.post('/signup', (req, res) => {
  const db = req.app.locals.db;
  if (!isValidEmail(req.body.email)) {
    return res.status(400).render('signup', { error: 'That email address does not look right.' });
  }
  if ((req.body.password || '').length < 8) {
    return res.status(400).render('signup', { error: 'Password must be at least 8 characters.' });
  }
  if (findUserByEmail(db, req.body.email)) {
    return res.status(400).render('signup', { error: 'That email is already registered.' });
  }
  const user = createUser(db, req.body.email, req.body.password);
  send({ to: user.email, subject: 'Welcome', text: renderEmail('welcome', { email: user.email }) });
  req.session.userId = user.id;
  res.redirect('/dashboard');
});

router.post('/logout', (req, res) => req.session.destroy(() => res.redirect('/login')));

module.exports = router;
