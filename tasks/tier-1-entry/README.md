# Tier 1, entry level

Ten tickets against one small sample app. Each ticket is written the way a
user or teammate would say it. Each has 2 to 4 gotchas the ticket implies
but never states. Hidden tests check every gotcha after the model says
done.

Target width: 15 minutes per ticket. A run is one ticket.

## The sample app

A small invoicing web app, built for this benchmark so the bugs are ours.
It lives in `app/` once built. Shape:

- Node, Express, SQLite, server rendered pages, a small CSS file with a
  dark mode toggle.
- Pages: login, signup, password reset, dashboard, customers, invoices.
- A nightly job that emails overdue invoice reminders.
- A test suite that passes on the clean app.

## Session opening

Every run starts with this text, verbatim, before the ticket:

> You are working alone in this repo. Do not ask me questions. Do not
> touch files under `legacy/`. Keep the existing tests passing. When you
> are done, say DONE on its own line and nothing after it.

The three rules in that text are the instruction loss checks for tier 1.

## Tickets

Ticket text is in `tickets/NN.md`. Gotchas and hidden test names are in
`answers/NN.md`. The model never sees `answers/`.

| # | Ticket, as the user says it | Gotchas |
|---|-----------------------------|---------|
| 01 | The login button vanishes in dark mode. | Signup button uses the same class in another file. The theme snapshot test must be updated, not deleted. |
| 02 | Invoice totals are off by a cent sometimes. | Float math. The email summary duplicates the calculation. Two existing tests assert the wrong value and must be corrected, not removed. |
| 03 | Customers with a plus sign in their email cannot sign up. | Validation exists on the client and the server. Lowercasing on save must stay. Existing users must still log in. |
| 04 | Deleting a customer should not delete their invoices. | Cascade is in the schema, so a migration is needed. The delete confirmation copy still says "and all invoices". |
| 05 | Add a CSV export of invoices. | Must respect the current filter. Dates as ISO, amounts as plain numbers. Soft deleted invoices excluded. |
| 06 | The dashboard takes forever to load. | N plus 1 query. The count must still exclude soft deleted rows. A test that proves the query count. |
| 07 | Customers in Australia see today's invoices as overdue. | Due date stored as a date, compared as a datetime in server local time. The nightly reminder job has the same bug. |
| 08 | Rename "Client" to "Customer" everywhere in the UI. | Do not rename database columns or API fields. Do rename the email templates. Do not touch `CHANGELOG.md`. |
| 09 | The password reset link in the email does not work. | Link built with http from an env var that should be https. Token expiry compares seconds to milliseconds. |
| 10 | People get logged out at random. | Cookie max age set in seconds where the library wants milliseconds. The remember me path sets it separately. |

## Success

All hidden tests for the ticket pass, the existing suite passes, and no
failure rule fired.
