const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture, login } = require('./helpers');
const { outbox } = require('../lib/email/send');

test('private pages require login', async (t) => {
  const { agent } = fixture(t);
  for (const path of ['/dashboard', '/clients', '/invoices', '/api/invoices/1']) {
    await agent.get(path).expect(302).expect('Location', '/login');
  }
});

test('login, rendered pages, invoice API, and logout', async (t) => {
  const { agent } = fixture(t);
  await agent.post('/login').type('form').send({ email: 'owner@example.com', password: 'wrong' }).expect(401);
  await login(agent);
  for (const path of ['/dashboard', '/clients', '/clients/1/delete', '/invoices']) await agent.get(path).expect(200);
  const { body } = await agent.get('/api/invoices/1').expect(200);
  assert.equal(body.number, 'INV-1001');
  assert.deepEqual(body.client, { id: 1, name: 'Acme Pty Ltd' });
  await agent.get('/api/invoices/999').expect(404);
  await agent.post('/logout').expect(302);
  await agent.get('/dashboard').expect(302).expect('Location', '/login');
});

test('signup normalizes email and sends only to the local outbox', async (t) => {
  const { agent, db } = fixture(t);
  await agent.post('/signup').type('form').send({ email: 'NEW@EXAMPLE.COM', password: 'password456' }).expect(302);
  assert.equal(db.prepare('SELECT email FROM users WHERE id = 2').get().email, 'new@example.com');
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0].to, 'new@example.com');
  await agent.post('/signup').type('form').send({ email: 'new@example.com', password: 'password456' }).expect(400);
});

test('invoice filters compose and exclude soft deleted rows', async (t) => {
  const { agent } = fixture(t);
  await login(agent);
  const res = await agent.get('/invoices?status=unpaid&q=Birch').expect(200);
  assert.match(res.text, /INV-1003/);
  assert.match(res.text, /INV-1004/);
  assert.doesNotMatch(res.text, /INV-1001|INV-1002|INV-1005|INV-1006/);
  const all = await agent.get('/invoices').expect(200);
  assert.doesNotMatch(all.text, /INV-1006/);
});

test('per customer invoice counts exclude soft deleted rows', async (t) => {
  const { agent } = fixture(t);
  await login(agent);
  const { text } = await agent.get('/dashboard').expect(200);
  for (const [id, count] of [[1, 2], [2, 2], [3, 1]]) assert.match(text, new RegExp(`data-client="${id}" data-count="${count}"`));
  assert.match(text, /data-unpaid="4"/);
});

test('forgot password does not disclose whether an email exists', async (t) => {
  const { agent } = fixture(t);
  const known = await agent.post('/forgot').type('form').send({ email: 'owner@example.com' }).expect(200);
  const unknown = await agent.post('/forgot').type('form').send({ email: 'nobody@example.com' }).expect(200);
  assert.equal(known.text, unknown.text);
  assert.equal(outbox.length, 1);
  await agent.get('/reset/invalid').expect(400);
});
