# Synthetic source generator

`seed.py` creates a task directory and a separate operator directory. The same
integer seed produces the same manifest and file hashes. Other seeds vary
customers affected by discrepancies and monetary values.

The task contains billing SQLite data, a UTF-16 support export, access instructions,
and synthetic CRM credentials. The operator directory contains PostgreSQL setup
SQL, a reference CRM snapshot, and the generated answer key.

Only `task/` belongs in the model workspace. Keep the generator, manifest,
operator files, and repository history outside it. PostgreSQL runs as a separate
service. Its reader account can select records but cannot change source tables.
The stale password and current synthetic credential differ intentionally.

Generate a fresh packet:

```sh
python3 tasks/tier-2-management/seed/seed.py NEW_DIRECTORY --seed 20260918
```

The numeric grader accepts reordered findings and requires complete discrepancy
records. The report's factual claims and clarity still require a separate review.
