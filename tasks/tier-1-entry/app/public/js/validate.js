// Shared with the signup form. Keep in step with lib/validate.js.
(function (root) {
  var EMAIL_RE = /^[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
  function isValidEmail(value) {
    return EMAIL_RE.test(String(value || '').trim());
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { isValidEmail: isValidEmail };
  } else {
    root.validate = { isValidEmail: isValidEmail };
  }
})(typeof window !== 'undefined' ? window : this);
