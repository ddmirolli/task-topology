# Trial instructions

Fix the attached ticket in this invoicing app. Work independently and submit
a final explanation when finished. Preserve unrelated behavior and data.
Different correct implementations are accepted.

The app and its installed dependencies are available in your working directory.
Use read_file, write_file, run_command, and run_tests. Commands run with no external
network access or access to the host's other files. Do not change package.json,
package-lock.json, or installed dependencies. Do not read or change benchmark
tests, reference answers, runner files, or grading records.

Keep the existing HTTP URLs, form field names, createApp factory, database
tables and existing data fields, controllable lib/clock, reminder job export,
and development email outbox usable. You may add fields and refactor internals.
Preserve existing test coverage and keep the tests passing. You may rewrite
tests with equivalent coverage and update expected snapshots. No exact CSS selector, helper
function, migration filename, or replacement wording is required.

The original ten-test suite includes unrelated defects. Do not repair those
defects for this ticket. Local HTTP tests require the runner's allocated port;
the command environment describes that port. Use run_tests to run the original
suite on that port. Other network access is denied.
