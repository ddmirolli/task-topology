import test from 'node:test';
import assert from 'node:assert/strict';
import { alignCitations } from './citations.mjs';
const packet = { sources: { result: 'first\nunique finding\nrepeated\nrepeated' } };
const review = quote => ({ environment: { verdict: 'valid', reason: 'unchanged', evidence: [{ source: 'result', line: 1, quote }] }, decisions: [] });
test('only unique literal quotes can resolve an incorrect line number', () => {
  const original = review('unique finding'), resolved = alignCitations(packet, original);
  assert.equal(resolved.review.environment.evidence[0].line, 2);
  assert.equal(original.environment.evidence[0].line, 1);
  assert.equal(resolved.corrections.length, 1);
  assert.equal(resolved.review.environment.reason, original.environment.reason);
  for (const quote of ['invented finding', 'repeated']) assert.throws(() => alignCitations(packet, review(quote)));
});
