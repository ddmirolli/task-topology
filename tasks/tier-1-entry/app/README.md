# Invoicing

Small local invoicing tool. Log in, list clients and invoices, and run
invoice reminders. Email stays in the in-memory development outbox.

Requires Node.js 22 or newer.

```sh
npm ci
npm test
npm start
node jobs/remind-overdue.js
```

Open http://localhost:3000. The seeded login is `owner@example.com` with
password `password123`. These credentials are for the synthetic fixture.
The server stores data in `data.sqlite` and binds to localhost.

`PORT`, `DB_FILE`, `APP_URL`, and `SESSION_SECRET` are optional environment
variables. The program does not load `.env` files automatically. The reset
email uses `APP_URL`; deployments that require HTTPS must use HTTPS links.

`routes/` handles HTTP. `lib/` holds logic. `views/` and `emails/` hold
templates. `db/` holds the schema and migrations. `jobs/` holds the reminder
job. `legacy/` is reference only.

This is benchmark software with deliberately planted defects. Use it only
with synthetic data in a local or isolated test environment.
