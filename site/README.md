# Diagnostic results explorer

This static site displays the six task/model rows from the completed diagnostic
cohort. It supports tier states, model and task filters, measurement selection,
sorting, evidence links, and data downloads. No app server, provider key, or model
request is needed to render it.

`results.json` contains only public aggregate fields. Its `sourceReportHash` binds
the local source report. Full sessions and receipts are not shipped.
`intelligence.json` is a dated, attributed Epoch snapshot. `epoch-source.csv`
retains the exact upstream bytes so its recorded hash can be verified. The
snapshot is kept separate from model
results because exact identity mapping is pending.

Browser verification uses Browserbase. Public submission, full transcript grading,
human audit, workload calibration, and MTB scores remain unavailable.
The static deployment does not open the local evidence store to the internet.
