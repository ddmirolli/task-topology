import assert from 'node:assert/strict';

// Correct a line number only when the exact quote occurs on one source line.
// Verdicts, source names, reasons, and quotes are never changed.
export function alignCitations(packet, review) {
  const aligned = structuredClone(review), corrections = [];
  for (const decision of [aligned.environment, ...aligned.decisions]) {
    for (const ref of decision.evidence) {
      assert.ok(Object.hasOwn(packet.sources, ref.source), 'Unknown evidence source');
      assert.ok(typeof ref.quote === 'string' && ref.quote.trim(), 'Missing exact quote');
      const source = packet.sources[ref.source].split('\n');
      if (source[ref.line - 1]?.includes(ref.quote)) continue;
      const matches = source.flatMap((line, i) => line.includes(ref.quote) ? [i + 1] : []);
      assert.equal(matches.length, 1, 'Evidence quote is missing or ambiguous');
      corrections.push({ rule: decision.rule ?? 'environment', source: ref.source,
        quote: ref.quote, originalLine: ref.line, resolvedLine: matches[0] });
      ref.line = matches[0];
    }
  }
  return { review: aligned, corrections };
}
