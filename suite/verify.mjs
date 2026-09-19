import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { root, temp, tool, isolated, capture } from '../.build/core/runtime.js';
import { gradeEntry } from '../.build/core/entry.js';
import { prepareManagement } from '../.build/core/management.js';
import { deployExecutive, acceptExecutive } from '../.build/core/executive.js';

const output = process.argv[2];
assert.ok(output && !fs.existsSync(output), 'Supply a new evidence directory');
fs.mkdirSync(output, { recursive: true, mode: 0o700 });
const receipts = [];
const record = (name, result) => {
  receipts.push({ name, ...result });
  fs.writeFileSync(path.join(output, name + '.json'), JSON.stringify(result, null, 2), { flag: 'wx', mode: 0o600 });
};
const work = temp('mtb-suite-verify-');
try {
  for (const language of ['python', 'go']) {
    for (const variant of ['broken', 'reference', 'alternative', 'partial']) {
      const workspace = path.join(work, language + '-' + variant);
      fs.cpSync(path.join(root, 'tasks/tier-1-entry/polyglot', language), workspace, { recursive: true });
      const filename = language === 'python' ? 'totals.py' : 'main.go';
      if (variant !== 'broken') {
        let solution = fs.readFileSync(path.join(root, 'tasks/tier-1-entry/polyglot/operator', filename), 'utf8');
        if (variant === 'alternative' && language === 'python') solution = `import json,sys\nfrom decimal import Decimal,ROUND_HALF_UP\ndef total(values):\n    import re\n    if not isinstance(values,list) or any(not isinstance(v,str) or not re.fullmatch(r'-?\\d+(?:\\.\\d+)?',v) for v in values): raise ValueError('Invalid amounts')\n    return sum(int(Decimal(v).quantize(Decimal('.01'),rounding=ROUND_HALF_UP)*100) for v in values)\nprint(json.dumps(total(json.load(sys.stdin))))\n`;
        if (variant === 'alternative' && language === 'go') solution = `package main\nimport("encoding/json";"os";"time")\nfunc main(){var v map[string]string;if json.NewDecoder(os.Stdin).Decode(&v)!=nil{os.Exit(1)};due,e:=time.Parse("2006-01-02",v["due"]);if e!=nil{os.Exit(1)};now,e:=time.Parse(time.RFC3339,v["now"]);if e!=nil{os.Exit(1)};loc,e:=time.LoadLocation(v["zone"]);if e!=nil{os.Exit(1)};y,m,d:=now.In(loc).Date();today:=time.Date(y,m,d,0,0,0,0,time.UTC);json.NewEncoder(os.Stdout).Encode(due.Before(today))}\n`;
        if (variant === 'partial' && language === 'python') solution = solution.replace('ROUND_HALF_UP))', 'ROUND_HALF_UP)) * (1 if not value.startswith("-") else -1)');
        if (variant === 'partial' && language === 'go') {
          assert.match(solution, /<\s*today/); solution = solution.replace(/<\s*today/, '<= today');
        }
        fs.writeFileSync(path.join(workspace, filename), solution);
      }
      const result = await gradeEntry(language, workspace);
      record(`entry-${language}-${variant}`, result);
      assert.equal(result.pass, ['reference', 'alternative'].includes(variant), `${language}/${variant}`);
    }
  }
  // Prove that submitted commands cannot read operator evidence or write outside.
  const isolatedDir = path.join(work, 'isolation'); fs.mkdirSync(isolatedDir);
  const secret = path.join(work, 'operator-only'); fs.writeFileSync(secret, 'operator-secret');
  const denied = await capture(isolated(isolatedDir, process.execPath, ['-e', `const fs=require('fs');for(const mode of ['read','write']){let denied=false;try{if(mode==='read')fs.readFileSync(${JSON.stringify(secret)});else fs.writeFileSync(${JSON.stringify(secret)},'changed')}catch(e){denied=['EPERM','EACCES'].includes(e.code)}if(!denied)process.exit(1)}console.log('denied')`]));
  assert.equal(denied.code, 0, denied.stderr); assert.equal(fs.readFileSync(secret, 'utf8'), 'operator-secret'); record('isolation', { pass: true });

  const management = await prepareManagement(path.join(work, 'management'));
  try {
    fs.copyFileSync(path.join(root, 'tasks/tier-2-management/tools/reference.py'), path.join(management.workspace, 'work/reference.py'));
    fs.writeFileSync(path.join(management.workspace, 'work/run.py'), `import json,subprocess,sys\nfrom pathlib import Path\nfrom reference import reconcile\ncrm=json.loads(subprocess.check_output(['node','access.mjs','crm']))\nfor name in ['billing','support']: json.loads(subprocess.check_output(['node','access.mjs',name]))\nresult=reconcile('.',crm)\nPath('findings.json').write_text(json.dumps(result))\nPath('REPORT.md').write_text('Reference reconciliation. Model clarity review remains pending.')\nprint('DONE')\n`);
    const execution = await management.run(['-c', 'python3 work/run.py']); assert.equal(execution.code, 0, execution.stderr);
    const result = management.grade(); assert.equal(result.dataChecksPass, true); assert.equal(result.fullPass, null); record('management-reference', result);
    const findings = path.join(management.workspace, 'findings.json'), original = fs.readFileSync(findings);
    const bad = JSON.parse(original); bad.totals.monthly_billing_cents += 1; fs.writeFileSync(findings, JSON.stringify(bad));
    const wrong = management.grade(); assert.equal(wrong.dataChecksPass, false); record('management-wrong-total', wrong); fs.writeFileSync(findings, original);
    fs.appendFileSync(path.join(management.workspace, 'data/support_tickets.csv'), 'changed');
    const changed = management.grade(); assert.equal(changed.dataChecksPass, false); record('management-source-change', changed);
  } finally { management.close(); }

  const app = await deployExecutive(path.join(work, 'executive'), path.join(root, 'tasks/tier-3-executive/reference'));
  try {
    const result = await acceptExecutive(app); record('executive-reference', result); assert.equal(result.appPass, true, JSON.stringify(result.checks.filter(c => !c.pass)));
  } finally { await app.close(); }
  record('summary', { pass: true, checks: receipts.length, modelTrials: 0, publishedScores: false });
  console.log(JSON.stringify({ pass: true, evidence: output, receipts: receipts.length }));
} finally { fs.rmSync(work, { recursive: true, force: true }); }
