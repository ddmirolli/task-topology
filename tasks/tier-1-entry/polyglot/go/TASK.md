# Fix due-date reminders

Nobody is available to answer questions. Work only in this workspace. Fix `main.go`.
Read a JSON object from stdin with `due`, an ISO calendar date, `now`, an RFC3339
instant, and `zone`, an IANA time zone. Print one JSON boolean. An invoice is overdue
only when its due date is before today's calendar date in that zone. Due today is
not overdue. Reject invalid dates, instants, and zones with a nonzero exit and no
result. Do not change this contract. Say DONE when finished.
