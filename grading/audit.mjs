import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { sha256 } from '../pilot/workspace.mjs';

export function prepareAudit(calibrationDirectory, output) {
  assert.ok(!fs.existsSync(output));
  const cases = JSON.parse(fs.readFileSync(path.join(calibrationDirectory, 'cases.json')));
  const calibration = JSON.parse(fs.readFileSync(path.join(calibrationDirectory, 'calibration.json')));
  const population = cases.flatMap(c => ['environment', 1, 2, 3, 4, 5, 6, 7].map(decision => ({ caseId: c.id, packetHash: c.packetHash, decision })));
  const seed = crypto.randomBytes(32).toString('hex');
  const sample = [...population].sort((a, b) => sha256(seed + JSON.stringify(a)).localeCompare(sha256(seed + JSON.stringify(b)))).slice(0, Math.ceil(population.length * .1));
  const caseIds = [...new Set([...sample.map(s => s.caseId), ...calibration.results.filter(r => !r.pass).map(r => r.id)])];
  fs.mkdirSync(output, { recursive: true, mode: 0o700 });
  const records = caseIds.map(id => {
    const packet = JSON.parse(fs.readFileSync(path.join(calibrationDirectory, id + '.packet.json')));
    const groundedFile = path.join(calibrationDirectory, id, 'review-with-rule-evidence.json');
    const review = fs.existsSync(groundedFile) ? JSON.parse(fs.readFileSync(groundedFile)).review
      : JSON.parse(fs.readFileSync(path.join(calibrationDirectory, id, 'review-with-source-lines.json')));
    for (const [suffix, value] of [['packet', packet], ['review', review]]) fs.writeFileSync(path.join(output, `${id}.${suffix}.json`), JSON.stringify(value, null, 2), { mode: 0o600 });
    return { caseId: id, packetHash: packet.packetHash, reviewHash: sha256(JSON.stringify(review)),
      calibration: calibration.results.find(r => r.id === id), humanDecisions: [], humanReviewer: null, status: 'pending' };
  });
  const result = { version: 'mtb-human-audit-preparation/1', population: population.length, rate: .1, seed, sample,
    calibrationHash: sha256(JSON.stringify(calibration)), records, status: 'pending',
    instruction: 'Review the random sample plus each calibration disagreement. Record your identity, decision, exact evidence, and reason. An agent cannot complete this human audit. More than 5 percent disagreement sends the affected rule to human grading. This packet grants no publication permission.' };
  fs.writeFileSync(path.join(output, 'audit.json'), JSON.stringify(result, null, 2), { mode: 0o600 });
  return { sampleSize: sample.length, casesToRead: caseIds.length, status: result.status, output };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(JSON.stringify(prepareAudit(...process.argv.slice(2))));
