import assert from 'node:assert/strict';

export function priceUsage(usage, rates) {
  const input = usage?.input_tokens, output = usage?.output_tokens;
  const cached = usage?.input_tokens_details?.cached_tokens;
  const written = usage?.input_tokens_details?.cache_write_tokens;
  for (const value of [input, output, cached, written]) assert.ok(Number.isSafeInteger(value) && value >= 0, 'Complete nonnegative provider usage required');
  assert.ok(cached + written <= input, 'Cache categories cannot exceed input tokens');
  return ((input - cached - written) * rates.input + cached * rates.cached + written * rates.cacheWrite + output * rates.output) / 1e6;
}
export function summarize(records) {
  const elapsed = records.reduce((s, r) => s + r.elapsedSeconds, 0);
  const success = records.filter(r => r.status === 'submitted' && r.grade?.pass).length;
  const completeCost = records.every(r => Number.isFinite(r.costUsd));
  const cost = completeCost ? records.reduce((s, r) => s + r.costUsd, 0) : null;
  return { attempts: records.length, successes: success, elapsedSeconds: elapsed, costUsd: cost,
    correctPerHour: elapsed > 0 ? success * 3600 / elapsed : null,
    correctPerDollar: cost > 0 ? success / cost : null, X: null, TTI: null };
}
export function requestReserve(limits, rates) {
  return (limits.maxInputTokens * Math.max(rates.input, rates.cached, rates.cacheWrite) + limits.maxOutputTokens * rates.output) / 1e6;
}
