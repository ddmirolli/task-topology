function isOverdue(invoice, now, client) {
  if (invoice.status === 'paid') return false;
  return new Date(invoice.due_on) < now;
}

module.exports = { isOverdue };
