const test = require('node:test');
const assert = require('node:assert/strict');
const { invoiceTotal } = require('../lib/invoice');

test('whole dollar invoice', () => {
  assert.equal(invoiceTotal([{ qty: 4, unit_price: 150 }]), 600);
});

test('decimal line items', () => {
  assert.equal(invoiceTotal([{ qty: 1, unit_price: 0.7 }, { qty: 1, unit_price: 0.1 }, { qty: 1, unit_price: 0.1 }]), 0.89);
});

test('quantity times decimal price', () => {
  assert.equal(invoiceTotal([{ qty: 1, unit_price: 1.15 }]), 1.14);
});
