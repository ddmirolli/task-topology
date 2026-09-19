import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { root, tool, command } from '../.build/core/runtime.js';
import { reportPacket } from './report.mjs';
import { judge } from './judge-codex.mjs';
import { sha256 } from '../pilot/workspace.mjs';
import { reportExpectedVerdicts, checkReportCase } from './report-calibration.mjs';

export async function calibrateReports(output, model) {
  assert.ok(!fs.existsSync(output)); fs.mkdirSync(output, { recursive: true, mode: 0o700 });
  command(tool('python3'), ['-c', `import sys,json,shutil\nfrom pathlib import Path\nsys.path.insert(0,sys.argv[1]);from test_management import seed,grade,reconcile\nout=Path(sys.argv[2]);packet=out/'packet';key=seed.build(packet);task=packet/'task';f=reconcile(task,json.loads((packet/'operator/crm.expected.json').read_text()))\n(out/'findings.json').write_text(json.dumps(f))\n`, path.join(root, 'tasks/tier-2-management/tools'), output], root);
  const findings = path.join(output, 'findings.json'), f = JSON.parse(fs.readFileSync(findings));
  const dollars = n => '$' + (n / 100).toFixed(2);
  const good = `# Summary\nCRM and Billing disagree on customer identity and status. Support also references customers absent from both systems.\n\n# Findings\n- CRM and Billing have ${f.name_mismatches.length} name mismatches, including ${f.name_mismatches[0].id}, and ${f.email_mismatch_ids.length} email mismatches, including ${f.email_mismatch_ids[0]}.\n- Billing has ${f.billing_only_ids.length} customers absent from CRM, including ${f.billing_only_ids[0]}.\n- Billing charges ${f.churned_billed_ids.length} customers that CRM marks churned, including ${f.churned_billed_ids[0]}.\n- Billing has ${f.orphan_refunds.length} refunds with no matching invoice, including ${f.orphan_refunds[0].id}.\n- Support has ${f.unknown_support.length} tickets for IDs absent from CRM and Billing, including ${f.unknown_support[0].ticket_id}.\n- CRM records dollars and Billing records cents. CRM dates use MM/DD/YYYY, Billing uses YYYY-MM-DD, and Support uses DD/MM/YYYY.\n- CRM and Billing together contain ${f.totals.reconciled_customers} distinct customer IDs.\n- Billing monthly charges total ${dollars(f.totals.monthly_billing_cents)}.\n- CRM monthly contract value totals ${dollars(f.totals.crm_contract_cents)}.\n- Billing charges for CRM-churned customers total ${dollars(f.totals.churned_billing_cents)}.\n- Billing refunds without invoices total ${dollars(f.totals.orphan_refund_cents)} and are separate from monthly billing.\n\n# Conclusion\nThe CRM, Billing, and Support discrepancies make the combined board report unreliable until the source owners reconcile them.\n\n# Recommended action\nThe operations lead will coordinate Sales, Finance, and Support to reconcile the listed IDs against the CRM, Billing, and Support exports by 2026-09-21, confirm each disputed status and identity with its source owner, and return a corrected board summary.\n`;
  const cases = [
    { id: 'accurate-actionable', report: good },
    { id: 'wrong-prose-total', report: good.replace(dollars(f.totals.monthly_billing_cents), '$1.00') },
    { id: 'missing-owner-deadline', report: good.replace(/The operations lead will[\s\S]+$/, 'Somebody should look at this soon.\n') },
  ].map(c => ({ ...c, expected: reportExpectedVerdicts[c.id] }));
  fs.writeFileSync(path.join(output, 'cases.json'), JSON.stringify(cases, null, 2), { mode: 0o600 });
  const results = [];
  for (const c of cases) {
    const report = path.join(output, c.id + '.md'); fs.writeFileSync(report, c.report);
    const numeric = { dataChecksPass: true, taskHash: JSON.parse(fs.readFileSync(path.join(output, 'packet/manifest.json'))).taskHash,
      submissionHash: sha256(fs.readFileSync(findings) + '\x00' + c.report), provenance: 'operator-generated reference reconciled against seed key' };
    // Prove the findings against the actual independent numeric grader.
    fs.copyFileSync(findings, path.join(output, 'packet/task/findings.json')); fs.writeFileSync(path.join(output, 'packet/task/REPORT.md'), c.report);
    const checked = JSON.parse(command(tool('python3'), ['-c', 'import sys,json;sys.path.insert(0,sys.argv[1]);from grade import grade;print(json.dumps(grade(sys.argv[2],sys.argv[3])))', path.join(root, 'tasks/tier-2-management/tools'), path.join(output, 'packet'), path.join(output, 'packet/task')], root));
    assert.equal(checked.dataChecksPass, true); assert.equal(checked.submissionHash, numeric.submissionHash);
    const packet = reportPacket(report, checked, findings); fs.writeFileSync(path.join(output, c.id + '.packet.json'), JSON.stringify(packet));
    const directory = path.join(output, c.id); await judge(packet, directory, model, 'report');
    const review = JSON.parse(fs.readFileSync(path.join(directory, 'review-with-source-lines.json')));
    results.push({ id: c.id, ...checkReportCase(c.expected, review) });
  }
  const result = { version: 'mtb-report-calibration/2', model, casesHash: sha256(JSON.stringify(cases)), calibrated: results.every(r => r.pass), results, humanAuditStatus: 'pending', comparisonEligible: false };
  fs.writeFileSync(path.join(output, 'calibration.json'), JSON.stringify(result, null, 2)); return result;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(JSON.stringify(await calibrateReports(...process.argv.slice(2))));
