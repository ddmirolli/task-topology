// Development mailer. Messages land in `outbox` instead of going anywhere.
const outbox = [];

function send(message) {
  outbox.push({ ...message, sentAt: new Date().toISOString() });
}

module.exports = { send, outbox };
