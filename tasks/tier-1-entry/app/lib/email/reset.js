const config = require('../config');
const { send } = require('./send');

function sendResetEmail(to, token) {
  const link = `${config.appUrl}/reset/${token}`;
  send({ to, subject: 'Reset your password', text: `Reset your password here: ${link}` });
  return link;
}

module.exports = { sendResetEmail };
