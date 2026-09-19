import test from 'node:test';
import assert from 'node:assert/strict';
import { subscriptionTokenCost } from './subscription-cost.mjs';

test('token estimates require complete unique request records and reconcile every category', () => {
  const usage = { input_tokens: 1000, cached_input_tokens: 400, cache_write_input_tokens: 200, output_tokens: 100, reasoning_output_tokens: 40 };
  const records = [1, 2].map(n => ({ type: 'token_usage_record', payload: { thread_id: 'thread', response_id: String(n), usage } }));
  const receipt = { sourceThreadId: 'thread', model: { id: 'model' }, usage: Object.fromEntries(Object.entries(usage).map(([k, v]) => [k, v * 2])) };
  const evidence = { contextEvidence: { maximumShortContextInputTokens: 272000 }, rates: { model: { input: 2, cached: .2, cacheWrite: 2.5, output: 12 } } };
  const log = list => list.map(JSON.stringify).join('\n');
  const result = subscriptionTokenCost(log(records), receipt, evidence);
  assert.equal(result.costUsd, .00516); assert.equal(result.requests, 2); assert.equal(result.maximumInputTokens, 1000);
  assert.equal(result.actualSubscriptionChargeUsd, null);
  assert.throws(() => subscriptionTokenCost(log([records[0], records[0]]), receipt, evidence), /duplicate/);
  assert.throws(() => subscriptionTokenCost(log([records[0]]), receipt, evidence), /reconcile/);
  assert.throws(() => subscriptionTokenCost(log(records), { ...receipt, sourceThreadId: 'different' }, evidence), /another thread/);
  assert.throws(() => subscriptionTokenCost(log(records), receipt, { ...evidence, contextEvidence: {} }), /pricing evidence/);
  assert.throws(() => subscriptionTokenCost(log(records), receipt, { ...evidence, contextEvidence: { maximumShortContextInputTokens: 999 } }), /Long-context/);
  assert.throws(() => subscriptionTokenCost(log([{ ...records[0], payload: { ...records[0].payload, usage: { ...usage, cache_write_input_tokens: undefined } } }]), receipt, evidence), /categories/);
});
