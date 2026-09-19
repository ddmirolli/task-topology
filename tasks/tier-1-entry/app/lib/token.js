const crypto = require('crypto');
const clock = require('./clock');

const TTL_SECONDS = 3600;

function createResetToken(db, userId) {
  const token = crypto.randomBytes(16).toString('hex');
  const expiresAt = Math.floor(clock.now().getTime() / 1000) + TTL_SECONDS;
  db.prepare('INSERT INTO reset_tokens (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt);
  return token;
}

function findResetToken(db, token) {
  return db.prepare('SELECT * FROM reset_tokens WHERE token = ?').get(token);
}

function deleteResetToken(db, token) {
  db.prepare('DELETE FROM reset_tokens WHERE token = ?').run(token);
}

module.exports = { createResetToken, findResetToken, deleteResetToken, TTL_SECONDS };
