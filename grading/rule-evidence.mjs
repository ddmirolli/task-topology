import assert from 'node:assert/strict';
import { verifyPacket } from './review.mjs';

// The independent grader owns test outcomes. Attach those facts without asking
// the judge to transcribe them. Keep the original model review as a separate file.
export function attachRuleEvidence(packet, review) {
  verifyPacket(packet);
  const augmented = structuredClone(review), additions = [];
  if (packet.appPass !== false) return { review: augmented, additions };
  let result;
  try { result = JSON.parse(packet.sources.result); } catch { return { review: augmented, additions }; }
  assert.equal(result.grade?.pass, false, 'Independent task result differs from packet');
  const failed = result.grade.checks.filter(c => c.pass === false);
  const refs = [];
  for (const check of failed) {
    // Exact independent errors are useful evidence. Never align a judge's reason.
    if (typeof check.error !== 'string' || !check.error.trim()) continue;
    const literal = JSON.stringify(check.error);
    packet.sources.result.split('\n').forEach((line, index) => {
      if (line.includes(`"error": ${literal}`)) refs.push({ source: 'result', line: index + 1, quote: line });
    });
  }
  const finalRefs = [];
  if (packet.rawSources?.events) {
    const events = packet.rawSources.events.split('\n').flatMap((s, index) => { try { return [{ event: JSON.parse(s), record: index + 1 }]; } catch { return []; } });
    const final = events.findLast(({ event }) => event.type === 'item.completed' && event.item?.type === 'agent_message');
    if (final) packet.sources.events.split('\n').forEach((line, index) => {
      if (line.startsWith(`record ${final.record} ["item","text"]`)) finalRefs.push({ source: 'events', line: index + 1, quote: line });
    });
  }
  for (const decision of augmented.decisions) {
    if (![1, 6].includes(decision.rule) || decision.verdict !== 'fail') continue;
    for (const ref of [...refs, ...(decision.rule === 1 ? finalRefs : [])]) {
      if (!decision.evidence.some(e => e.source === ref.source && e.line === ref.line)) {
        decision.evidence.push(ref); additions.push({ rule: decision.rule, ...ref, authority: 'independent task result and retained final submission' });
      }
    }
  }
  return { review: augmented, additions };
}
