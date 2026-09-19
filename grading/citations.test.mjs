import test from 'node:test';
import assert from 'node:assert/strict';
import { alignCitations, attachSourceLines } from './citations.mjs';
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
test('judge references attach verbatim source text and reject nonexistent lines or supplied quotes', () => {
  const selected = { environment: { verdict: 'valid', evidence: [{ source: 'result', line: 2 }] }, decisions: [] };
  const attached = attachSourceLines(packet, selected);
  assert.equal(attached.environment.evidence[0].quote, 'unique finding');
  assert.equal(selected.environment.evidence[0].quote, undefined);
  for (const ref of [{ source: 'invented', line: 1 }, { source: 'result', line: 99 },
    { source: 'result', line: 1, quote: 'forged quote' }, { source: 'result', line: 0 }]) {
    assert.throws(() => attachSourceLines(packet, { environment: { evidence: [ref] }, decisions: [] }));
  }
});
