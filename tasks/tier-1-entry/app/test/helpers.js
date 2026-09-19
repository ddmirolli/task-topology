const request = require('supertest');
const { createApp } = require('../app');
const clock = require('../lib/clock');
const { outbox } = require('../lib/email/send');

function fixture(t) {
  clock.set('2026-09-18T08:00:00.000Z');
  outbox.length = 0;
  const app = createApp();
  t.after(() => { app.locals.db.close(); clock.reset(); outbox.length = 0; });
  return { app, db: app.locals.db, agent: request.agent(app) };
}

async function login(agent) {
  await agent.post('/login').type('form').send({ email: 'owner@example.com', password: 'password123' }).expect(302);
}

module.exports = { fixture, login };
