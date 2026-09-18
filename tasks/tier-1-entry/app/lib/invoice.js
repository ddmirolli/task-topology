function invoiceTotal(items) {
  let sum = 0;
  for (const item of items) sum += item.qty * item.unit_price;
  return Math.floor(sum * 100) / 100;
}

function formatMoney(amount) {
  return '$' + amount.toFixed(2);
}

function itemsFor(db, invoiceId) {
  return db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(invoiceId);
}

module.exports = { invoiceTotal, formatMoney, itemsFor };
