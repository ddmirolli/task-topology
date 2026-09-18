const path = require('path');
const express = require('express');
const session = require('express-session');
const { openDb } = require('./db');
const { seed } = require('./db/seed');
const auth = require('./routes/auth');
const reset = require('./routes/reset');
const dashboard = require('./routes/dashboard');
const clients = require('./routes/clients');
const invoices = require('./routes/invoices');
const api = require('./routes/api');

function createApp({ dbFile = ':memory:', seedData = true, requireHttps = false } = {}) {
  const app = express();
  const db = openDb(dbFile);
  if (seedData) seed(db);
  app.locals.db = db;

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  if (requireHttps) {
    app.use((req, res, next) => req.secure ? next() : res.redirect(308, `https://${req.get('host')}${req.originalUrl}`));
  }
  app.use(express.urlencoded({ extended: false }));
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 3600 }, // one hour
  }));

  app.use((req, res, next) => {
    res.locals.theme = req.query.theme === 'dark' ? 'dark' : 'light';
    res.locals.user = req.session.userId
      ? db.prepare('SELECT id, email FROM users WHERE id = ?').get(req.session.userId)
      : null;
    next();
  });

  app.get('/', (req, res) => res.redirect(req.session.userId ? '/dashboard' : '/login'));
  app.use(auth);
  app.use(reset);
  app.use(dashboard);
  app.use(clients);
  app.use(invoices);
  app.use(api);
  return app;
}

module.exports = { createApp };
