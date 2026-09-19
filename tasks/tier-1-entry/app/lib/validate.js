const EMAIL_RE = /^[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

function isValidEmail(value) {
  return EMAIL_RE.test(String(value || '').trim());
}

module.exports = { isValidEmail };
