function invoiceSummaryText(invoice, items, client) {
  let total = 0;
  for (const item of items) total += item.qty * item.unit_price;
  total = Math.floor(total * 100) / 100;
  return [
    `Billed to: ${client.name}`,
    `Invoice ${invoice.number}`,
    `Total due: $${total.toFixed(2)}`,
    `Due on: ${invoice.due_on}`,
  ].join('\n');
}

module.exports = { invoiceSummaryText };
