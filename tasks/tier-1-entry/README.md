# Tier 1, entry level

Ten tickets against one small sample app. Each ticket is written the way a
user or teammate would say it. Each has 2 to 4 gotchas the ticket implies
but never states. Hidden tests check every gotcha after the model says
done.

Target width: 15 minutes per ticket. A run is one ticket.

## The sample app

A small invoicing web app, built for this benchmark so the bugs are ours.
It lives in `app/`. The checked-in app contains the planted bugs. Shape:

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

## Verify the fixtures

From the repository root, run:

```sh
npm ci --prefix tasks/tier-1-entry/app
npm run test:tier1
```

The verifier checks the exact failures in the planted app, applies each
reference fix to a fresh temporary copy, and runs that ticket's hidden
checks plus the visible tests. It also applies all ten fixes and checks
the clean app. It makes no model calls and sends no email.

The visible suite intentionally records two incorrect totals and the
broken theme snapshot, as specified in tickets 01 and 02. Those tickets
require updates to the assertions and snapshot. Other visible tests must
keep passing.

## Prepare an app copy

```sh
node tasks/tier-1-entry/scripts/prepare.mjs task
node tasks/tier-1-entry/scripts/prepare.mjs clean
```

Each command prints a new temporary directory. `task` copies the planted
app. `clean` also applies all reference fixes. In that directory, run
`npm ci`, `npm test`, and `npm start`. The server binds to localhost.

Only copy `app/` into a model's workspace. Give the model the session
opening and one ticket. Keep `hidden/`, `answers/`, and `solutions/`
outside that workspace. These directories are public maintainer material,
not secret answers. The preparation script is a file copier, not a security
sandbox. A future harness must prevent access to the surrounding repository
and public answer files during scored runs.

## Check one candidate

Set `MTB_APP_DIR` to the absolute path of the candidate app, with its
locked dependencies installed. For example, to check ticket 03:

```sh
MTB_APP_DIR=/absolute/path/to/candidate node --test tasks/tier-1-entry/hidden/03-*.test.js
```

The thirty checks cover the published gotchas. They are a local fixture
verification suite, not the full transcript grader. CSS checks currently
recognize the sample app's shared button class and dark override. They do
not grade arbitrary CSS rewrites. Session checks verify cookie expiry;
they do not wait for an hour or thirty days.

Reference patches use zero context so independent fixes to the same file
can combine. Apply them only to this fixture revision. The verifier checks
both individual patches and their combined result.
