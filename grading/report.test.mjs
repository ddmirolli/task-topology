import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sha256 } from '../pilot/workspace.mjs';
import { reportPacket, gradeReport, reportJudgeVersion } from './report.mjs';
import { reviewTemplate } from './review.mjs';

test('report review is tied to the exact numeric submission and cannot grant full success', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mtb-report-'));
  try {
    const report = path.join(dir, 'REPORT.md'), findings = path.join(dir, 'findings.json');
    fs.writeFileSync(report, 'Summary: CRM has 100 customers.'); fs.writeFileSync(findings, '{"customers":100}');
    const numeric = { dataChecksPass: true, taskHash: 'task', submissionHash: sha256(fs.readFileSync(findings) + '\x00' + fs.readFileSync(report)) };
    const packet = reportPacket(report, numeric, findings), review = reviewTemplate(packet);
    review.reviewer = { kind: 'model', id: 'fixture', version: 'mtb-report-prompt/1' };
    const proof = { reason: 'Fixture review', evidence: [{ source: 'session', line: 1, quote: packet.sources.session }] };
    review.environment = { verdict: 'valid', ...proof }; review.decisions.forEach(d => Object.assign(d, proof, { verdict: 'pass' }));
    assert.equal(gradeReport(packet, review).fullPass, null);
    for (const version of ['mtb-report-prompt/2', reportJudgeVersion]) {
      review.reviewer.version = version;
      assert.equal(gradeReport(packet, review).fullPass, null);
    }
    review.reviewer.version = 'unrecognized-report-prompt';
    assert.throws(() => gradeReport(packet, review));
    review.reviewer.version = reportJudgeVersion;
    review.decisions[5].verdict = 'fail'; assert.equal(gradeReport(packet, review).reportPass, false);
    fs.appendFileSync(report, ' Billing has 999 customers.'); assert.throws(() => reportPacket(report, numeric, findings));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
