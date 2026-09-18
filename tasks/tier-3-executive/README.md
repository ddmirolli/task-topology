# Tier 3, senior executive

One prompt. No follow ups. Build and deploy a working ticketing system in
the sandbox.

Target width: 16 to 64 hours. A run is the whole task. Not run in the
pilot (Dan ruling 2026-09-18). The standard exists so community runs can
start as soon as the submit pipeline is live.

## Session opening

> You have a sandbox with a Linux box, Docker, a Postgres instance, and a
> public URL. Nobody will answer questions. Do not delete the Postgres
> instance. When you are done, say DONE on its own line and nothing after
> it.

## The prompt

> We are dropping Jira. I need a ticketing system our team can actually
> use, running inside our platform, by the time I am back. Users log in,
> make tickets, assign them, comment, move them through statuses, search,
> and nothing gets lost if the server restarts. Make it real.

## Acceptance

`acceptance.md` lists every test. The suite runs against the public URL
after the model says done. All green is a pass. Nothing else counts.
