import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { summarize } from '../pilot/accounting.mjs';
import { schedule } from '../pilot/cli.mjs';
import { sha256 } from '../pilot/workspace.mjs';

export function transcriptFacts(transcript) {
  const events = [], parseErrors = [];
  transcript.split('\n').forEach((line, index) => {
    if (!line.trim()) return;
    try { events.push(JSON.parse(line)); } catch { parseErrors.push(index + 1); }
  });
  const completed = events.filter(e => e.type === 'item.completed').map(e => e.item).filter(Boolean);
  const calls = completed.filter(i => i.type === 'mcp_tool_call');
  const native = completed.filter(i => ['command_execution', 'file_change', 'web_search'].includes(i.type));
  const repetitions = []; let previous, count = 0;
  for (const call of calls) {
    let body;
    try { body = JSON.parse(call.result?.content?.find(c => c.type === 'text')?.text ?? 'null'); } catch {}
    const qualifies = call.tool === 'read_file' || ['run_command', 'run_tests'].includes(call.tool) && body?.code !== undefined && body.code !== 0;
    const key = qualifies ? JSON.stringify([call.tool, call.arguments]) : null;
    count = key && key === previous ? count + 1 : 1; previous = key;
    if (key && count === 6) repetitions.push({ tool: call.tool, arguments: call.arguments, itemId: call.id });
  }
  return { parseErrors, calls: calls.length, failedMcpCalls: calls.filter(c => c.error).length,
    nativeCalls: native.length, thrashCandidates: repetitions,
    finalMessages: completed.filter(i => i.type === 'agent_message').map(i => i.text),
    terminalUsage: events.filter(e => e.type === 'turn.completed').at(-1)?.usage ?? null };
}
export function pilotReport(directory, evidenceFile) {
  const planBytes = fs.readFileSync(path.join(directory, 'plan.json')), plan = JSON.parse(planBytes);
  const evidenceBytes = fs.readFileSync(evidenceFile), prices = JSON.parse(evidenceBytes);
  const progress = JSON.parse(fs.readFileSync(path.join(directory, 'results.json')));
  if (progress.planHash && progress.planHash !== sha256(planBytes)) throw new Error('Plan changed after launch');
  const taskBaselines = new Map(), configurations = new Set(), runIds = new Set();
  const attempts = schedule(plan).map((entry, index) => {
    const dir = path.join(directory, String(index + 1).padStart(2, '0'));
    if (!fs.existsSync(path.join(dir, 'receipt.json'))) {
      const started = fs.existsSync(path.join(dir, 'launch.json')) || fs.existsSync(path.join(dir, 'events.jsonl'));
      const stoppedHere = progress.stopped?.attempt === index + 1;
      const recorded = progress.records.find(r => r.index === index + 1);
      return { index: index + 1, model: entry.model.id, ticket: entry.ticket, repetition: entry.repetition,
        status: recorded ? 'evidence_missing' : stoppedHere ? 'runner_error' : started ? 'incomplete' : 'pending', recordedOutcome: recorded ?? null,
        elapsedSeconds: null, apiEquivalentUsd: null, gradingError: recorded ? 'Recorded attempt has no receipt' : stoppedHere ? progress.stopped.message : null,
        evidence: fs.existsSync(dir) ? dir : null };
    }
    const receipt = JSON.parse(fs.readFileSync(path.join(dir, 'receipt.json')));
    const recordFile = path.join(dir, 'result/run.json');
    const record = fs.existsSync(recordFile) ? JSON.parse(fs.readFileSync(recordFile)) : null;
    const launch = JSON.parse(fs.readFileSync(path.join(dir, 'launch.json')));
    const facts = transcriptFacts(receipt.transcript);
    if (typeof receipt.runId !== 'string' || !receipt.runId || runIds.has(receipt.runId)) throw new Error('Missing or duplicate run ID');
    runIds.add(receipt.runId);
    if (record && record.runId !== receipt.runId) throw new Error('Grading record belongs to another run');
    if (receipt.model.id !== entry.model.id || receipt.model.reasoning_setting !== entry.model.effort) throw new Error('Plan and receipt identity differ');
    if (record && (record.taskHash !== receipt.taskHash || record.transcriptHash !== sha256(receipt.transcript))) throw new Error('Receipt integrity mismatch');
    const runnerHash = sha256(JSON.stringify(launch.runnerFiles));
    if (runnerHash !== progress.frozenRunnerHash) throw new Error('Runner differs from frozen trial');
    if (launch.runnerFiles['price-evidence.json'] !== sha256(evidenceBytes)) throw new Error('Price evidence differs from frozen runner');
    if (JSON.stringify(receipt.execution) !== JSON.stringify(launch.execution)) throw new Error('Receipt client differs from launch');
    const config = structuredClone(launch.execution);
    delete config.settings.model;
    configurations.add(JSON.stringify(config));
    if (configurations.size > 1) throw new Error('Trial execution settings differ');
    if (record) {
      const baseline = JSON.stringify({ taskHash: record.taskHash, appFiles: record.appFiles });
      if (taskBaselines.has(entry.ticket) && taskBaselines.get(entry.ticket) !== baseline) throw new Error('Task baseline changed between attempts');
      taskBaselines.set(entry.ticket, baseline);
    }
    const changedFiles = record ? [...new Set([...Object.keys(record.appFiles), ...Object.keys(record.submittedFiles)])]
      .filter(f => record.appFiles[f] !== record.submittedFiles[f]) : [];
    const cleanExecution = facts.parseErrors.length === 0 && facts.nativeCalls === 0 && facts.failedMcpCalls === 0 && facts.terminalUsage !== null;
    return { index: index + 1, ticket: entry.ticket, model: entry.model.id, repetition: entry.repetition,
      status: receipt.status, functionalPass: receipt.status === 'submitted' && record?.grade?.pass === true && cleanExecution,
      elapsedSeconds: receipt.elapsedSeconds, timingBasis: record?.timingBasis ?? receipt.timingSource,
      apiEquivalentUsd: null, costUnavailableReason: 'Per-call context sizes needed to select API price bands are absent from CLI telemetry', usage: receipt.usage, evidence: dir,
      client: receipt.execution, runnerHash, taskHash: receipt.taskHash,
      changedFiles, transcriptFacts: facts, gradingError: record?.gradingError ?? (record ? null : 'No grading record'),
      failedChecks: record?.grade?.checks?.filter(c => !c.pass) ?? [],
      fullRubricStatus: 'pending_evidence_review', comparisonEligible: false };
  });
  const groups = plan.models.map(model => {
    const records = attempts.filter(r => r.model === model.id && r.status !== 'pending');
    const metrics = summarize(records.map(r => ({ status: r.status, grade: { pass: r.functionalPass },
      elapsedSeconds: r.elapsedSeconds, costUsd: r.apiEquivalentUsd, costBasis: 'unavailable',
      timingBasis: r.timingBasis, execution: r.client ?? records.find(x => x.client)?.client })));
    const planned = plan.tickets.length * plan.repetitions;
    const complete = records.length === planned && records.every(r => !['pending', 'incomplete', 'runner_error', 'evidence_missing'].includes(r.status) && !r.gradingError);
    return { model: model.id, planned, ...metrics,
      correctPerHour: complete ? metrics.correctPerHour : null, correctPerDollar: complete ? metrics.correctPerDollar : null }; 
  });
  return { generatedAt: new Date().toISOString(), planHash: sha256(planBytes),
    priceEvidenceHash: sha256(evidenceBytes), priceSource: prices.source, priceDate: prices.date,
    interpretation: 'Pipeline validation only. Requested model IDs; full transcript rubric pending. Cost scores are unavailable: CLI aggregate token counts do not establish per-call API price bands. Subscription use is not treated as zero cost. Canaries excluded.',
    attempts, groups, X: null, TTI: null };
}
export function markdownReport(report) {
  const number = (n, decimals = 2) => n == null ? 'unavailable' : n.toFixed(decimals);
  return `# Subscription pilot results\n\n${report.interpretation}\n\n| Requested model | Started / planned | Functional passes | Seconds | Functional passes / hour | API-equivalent cost |\n|---|---:|---:|---:|---:|---:|\n`
    + report.groups.map(g => `| ${g.model} | ${g.attempts} / ${g.planned} | ${g.successes} | ${number(g.elapsedSeconds)} | ${number(g.correctPerHour)} | ${number(g.costUsd, 4)} USD |`).join('\n')
    + '\n\n| Attempt | Model | Ticket | Repeat | Outcome | Seconds | API-equivalent USD | Changed files |\n|---:|---|---|---:|---|---:|---:|---|\n'
    + report.attempts.map(r => `| ${r.index} | ${r.model} | ${r.ticket} | ${r.repetition} | ${['pending', 'incomplete', 'runner_error', 'evidence_missing'].includes(r.status) ? r.status : r.functionalPass ? 'functional pass' : 'fail or ungraded'} | ${number(r.elapsedSeconds)} | ${number(r.apiEquivalentUsd, 4)} | ${(r.changedFiles ?? []).join(', ')} |`).join('\n')
    + `\n\nPrices: [dated API price source](${report.priceSource}), ${report.priceDate}.\nAll attempts count toward time. Cost remains unavailable without per-call pricing evidence. Rates are withheld until every planned attempt has finished and grading records exist.\nRaw transcripts and grading records remain local. X and TTI are unavailable.\n`;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [directory, evidenceFile, outputPrefix] = process.argv.slice(2);
  const report = pilotReport(directory, evidenceFile);
  fs.writeFileSync(outputPrefix + '.json', JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  fs.writeFileSync(outputPrefix + '.md', markdownReport(report), { mode: 0o600 });
  console.log(JSON.stringify({ attempts: report.attempts.filter(r => r.status !== 'pending').length, groups: report.groups }, null, 2));
}
