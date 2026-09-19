# Trial instructions

Fix the attached ticket in this invoicing app. Work independently and submit
a final explanation when finished. Preserve unrelated behavior and data.
Different correct implementations are accepted.

Use your client's file, shell, and test tools in the supplied app workspace.
Do not change package.json, package-lock.json, or installed dependencies.
Do not read or change benchmark tests, reference answers, runner files,
or grading records. The operator supplies locked dependencies and an isolated
workspace. Keep model service access separate from the app's network access.

Keep the existing HTTP URLs, form field names, createApp factory, database
tables and existing data fields, controllable lib/clock, reminder job export,
and development email outbox usable. You may add fields and refactor internals.
Preserve existing test coverage and keep the tests passing. You may rewrite
tests with equivalent coverage and update expected snapshots. No exact CSS selector, helper
function, migration filename, or replacement wording is required.

The original ten-test suite includes unrelated defects. Do not repair those
defects for this ticket. Run the supplied visible tests with your client's
test command. Follow the operator's local network and port configuration.
