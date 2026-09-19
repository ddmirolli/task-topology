import assert from 'node:assert/strict';
import { priceUsage } from '../pilot/accounting.mjs';

export function subscriptionTokenCost(bytes, receipt, evidence) {
  assert.ok(bytes && receipt.sourceThreadId && receipt.usage, 'Full per-request usage is unavailable');
  const limit = evidence.contextEvidence?.maximumShortContextInputTokens;
  assert.ok(Number.isSafeInteger(limit) && limit > 0, 'Dated context pricing evidence is unavailable');
  const rates = evidence.rates[receipt.model.id];
  for (const key of ['input', 'cached', 'cacheWrite', 'output']) assert.ok(Number.isFinite(rates?.[key]) && rates[key] >= 0, 'Complete dated prices are required');
  const records = bytes.toString().trim().split('\n').map(JSON.parse).filter(e => e.type === 'token_usage_record').map(e => e.payload);
  assert.ok(records.length, 'Per-request usage records are missing');
  const responses = new Set(), totals = { input_tokens: 0, output_tokens: 0, cached_input_tokens: 0, cache_write_input_tokens: 0, reasoning_output_tokens: 0 };
  let costUsd = 0, maximumInputTokens = 0;
  for (const record of records) {
    assert.equal(record.thread_id, receipt.sourceThreadId, 'Usage belongs to another thread');
    assert.ok(typeof record.response_id === 'string' && record.response_id && !responses.has(record.response_id), 'Missing or duplicate response identity');
    responses.add(record.response_id);
    const usage = record.usage;
    for (const key of Object.keys(totals)) {
      assert.ok(Number.isSafeInteger(usage?.[key]) && usage[key] >= 0, 'Complete token categories are required');
      totals[key] += usage[key];
    }
    assert.ok(usage.reasoning_output_tokens <= usage.output_tokens, 'Reasoning tokens must be included in output tokens');
    assert.ok(Number.isSafeInteger(usage.total_tokens) && usage.total_tokens === usage.input_tokens + usage.output_tokens, 'Total tokens must equal input plus output tokens');
    assert.ok(usage.input_tokens <= limit, 'Long-context pricing is not implemented by this estimator');
    maximumInputTokens = Math.max(maximumInputTokens, usage.input_tokens);
    costUsd += priceUsage({ input_tokens: usage.input_tokens, output_tokens: usage.output_tokens,
      input_tokens_details: { cached_tokens: usage.cached_input_tokens, cache_write_tokens: usage.cache_write_input_tokens } }, rates);
  }
  for (const key of Object.keys(totals)) assert.equal(totals[key], receipt.usage[key], 'Per-request usage does not reconcile to the terminal totals');
  return { costUsd, basis: 'api_equivalent_token_estimate', requests: records.length, maximumInputTokens,
    actualSubscriptionChargeUsd: null };
}
