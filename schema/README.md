# Data model

Two shapes. Runs go in, aggregates come out, the chart reads aggregates.

## Run

`run.schema.json`. One per benchmark run. The harness writes it, `tti
submit` sends it, the server fills in `grade` after regrading the
transcript. Anything a submitter puts in `grade` is thrown away.

## Aggregate

`aggregate.schema.json`. One per model per tier per task set version. This
is one dot on the chart. The server recomputes it every time a run for
that model and tier is accepted.

## How a run becomes a dot

1. Accept. Task fingerprint matches a published set, prices match the
   price list for that date, transcript hash matches the upload.
2. Grade. Apply GRADING.md. Record success, failure rule and failure time.
3. Trust. Held if far outside the spread for that model and tier.
   Unverified if one submitter. Verified if two or more independent
   submitters agree. Official if reproduced in the reference harness.
4. Aggregate. Over all accepted runs for the model and tier:
   - p_window = failures / total 10 minute windows observed
   - hours_at_90 = (10 / 60) x ln(0.90) / ln(1 - p_window)
   - success_rate = successes / total
   - mean_cost_per_attempt = mean over runs of tokens x prices
   - successful_hours_per_usd = task_hours x success_rate / mean_cost_per_attempt
   - eci from the Epoch Capabilities Index feed, dated
   - tti = cube root of (hours_at_90 x eci x successful_hours_per_usd)

## Chart

- Reads a list of aggregates.
- Tier selector filters on `tier`.
- Trust filter defaults to all, with a switch for reference harness only
  and for official only.
- Each dot links to the run list behind it, each run links to its
  transcript.
