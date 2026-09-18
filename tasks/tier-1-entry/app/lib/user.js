const crypto = require('crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(8).toString('hex');
  return salt + ':' + crypto.scryptSync(password, salt, 32).toString('hex');
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), crypto.scryptSync(password, salt, 32));
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function createUser(db, email, password) {
  const info = db
    .prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)')
    .run(normalizeEmail(email), hashPassword(password), new Date().toISOString());
  return db.prepare('SELECT id, email FROM users WHERE id = ?').get(info.lastInsertRowid);
}

function findUserByEmail(db, email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(normalizeEmail(email));
}

function setPassword(db, userId, password) {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), userId);
}

module.exports = { createUser, findUserByEmail, verifyPassword, setPassword, normalizeEmail };
