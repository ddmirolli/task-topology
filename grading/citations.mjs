import assert from 'node:assert/strict';

// Copy the cited line from the packet. This does not establish verdict truth.
export function attachSourceLines(packet, review) {
  const attached = structuredClone(review);
  for (const decision of [attached.environment, ...attached.decisions]) {
    assert.ok(Array.isArray(decision.evidence), 'Missing evidence array');
    for (const ref of decision.evidence) {
      assert.deepEqual(Object.keys(ref).sort(), ['line', 'source'], 'Judge must select a source line');
      assert.ok(Object.hasOwn(packet.sources, ref.source), 'Unknown evidence source');
      const source = packet.sources[ref.source].split('\n');
      assert.ok(Number.isInteger(ref.line) && ref.line > 0 && ref.line <= source.length, 'Evidence line is out of range');
      assert.ok(source[ref.line - 1].trim(), 'Cannot cite a blank line');
      ref.quote = source[ref.line - 1];
    }
  }
  return attached;
}

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
