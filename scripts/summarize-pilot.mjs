import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { subscriptionTokenCost } from './subscription-cost.mjs';
import { summarize } from '../pilot/accounting.mjs';
import { schedule } from '../pilot/cli.mjs';
import { sessionEvidence } from '../pilot/session-evidence.mjs';
import { root, sha256 } from '../pilot/workspace.mjs';

export { transcriptFacts } from '../grading/transcript-facts.mjs';
import { transcriptFacts } from '../grading/transcript-facts.mjs';
export function pilotReport(directory, evidenceFile, reviewFile) {
  const planBytes = fs.readFileSync(path.join(directory, 'plan.json')), plan = JSON.parse(planBytes);
  const evidenceBytes = fs.readFileSync(evidenceFile), prices = JSON.parse(evidenceBytes);
  const progress = JSON.parse(fs.readFileSync(path.join(directory, 'results.json')));
  const reviewBytes = reviewFile ? fs.readFileSync(reviewFile) : null;
  const review = reviewBytes ? JSON.parse(reviewBytes) : { version: 'tti-review-holds/1', holds: [] };
  assert.equal(review.version, 'tti-review-holds/1', 'Unsupported review holds');
  assert.ok(Array.isArray(review.holds), 'Review holds must be an array');
  const holds = new Map();
  for (const hold of review.holds) {
    assert.ok(Number.isSafeInteger(hold.attempt) && hold.attempt > 0 && !holds.has(hold.attempt), 'Missing or duplicate review attempt');
    assert.ok(typeof hold.reason === 'string' && hold.reason.trim() && hold.reason.length <= 2000, 'Review reason required');
    holds.set(hold.attempt, hold);
  }
  if (progress.planHash && progress.planHash !== sha256(planBytes)) throw new Error('Plan changed after launch');
  const taskBaselines = new Map(), configurations = new Set(), runIds = new Set();
  const attempts = schedule(plan).map((entry, index) => {
    const dir = path.join(directory, String(index + 1).padStart(2, '0'));
    if (!fs.existsSync(path.join(dir, 'receipt.json'))) {
      assert.ok(!holds.has(index + 1), 'Review hold has no receipt');
      const started = fs.existsSync(path.join(dir, 'launch.json')) || fs.existsSync(path.join(dir, 'events.jsonl'));
      const stoppedHere = progress.stopped?.attempt === index + 1;
      const recorded = progress.records.find(r => r.index === index + 1);
      return { index: index + 1, model: entry.model.id, ticket: entry.ticket, repetition: entry.repetition,
        status: recorded ? 'evidence_missing' : stoppedHere ? 'runner_error' : started ? 'incomplete' : progress.stopped ? 'not_run' : 'pending', recordedOutcome: recorded ?? null,
        elapsedSeconds: null, apiEquivalentUsd: null, gradingError: recorded ? 'Recorded attempt has no receipt' : stoppedHere ? progress.stopped.message : null,
        evidence: fs.existsSync(dir) ? dir : null };
    }
    const receiptBytes = fs.readFileSync(path.join(dir, 'receipt.json')), receipt = JSON.parse(receiptBytes);
    const hold = holds.get(index + 1);
    if (hold) {
      assert.equal(hold.receiptHash, sha256(receiptBytes), 'Review hold receipt changed');
      assert.equal(hold.runId, receipt.runId, 'Review hold belongs to another run');
      holds.delete(index + 1);
    }
    const recordFile = path.join(dir, 'result/run.json');
    const record = fs.existsSync(recordFile) ? JSON.parse(fs.readFileSync(recordFile)) : null;
    const launch = JSON.parse(fs.readFileSync(path.join(dir, 'launch.json')));
    const facts = transcriptFacts(receipt.transcript);
    let sourceEvidence, fullSession;
    if (receipt.execution.settings?.fullSessionRecord && !receipt.sourceCaptureError) {
      const full = fs.readFileSync(path.join(dir, 'session.jsonl')); fullSession = full;
      if (sha256(full) !== receipt.sourceTranscriptHash) throw new Error('Full session record changed');
      sourceEvidence = sessionEvidence(full, launch.prompt);
    }
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
    let tokenCost = null, costUnavailableReason = null;
    try { tokenCost = subscriptionTokenCost(fullSession, receipt, prices); } catch (error) { costUnavailableReason = error.message; }
    const changedFiles = record ? [...new Set([...Object.keys(record.appFiles), ...Object.keys(record.submittedFiles)])]
      .filter(f => record.appFiles[f] !== record.submittedFiles[f]) : [];
    const allowsNativeEdits = receipt.execution.settings?.nativeWorkspaceWrites === true;
    const edits = record?.executionEvidence?.nativeEdits;
    const nativeClean = allowsNativeEdits
      ? facts.nativeCalls === facts.nativeEditCalls && Array.isArray(edits) && edits.length === facts.nativeEditCalls && edits.every(e => e.withinWorkspace === true)
        && record.executionEvidence.nativeToolUsed === false
      : facts.nativeCalls === 0;
    const sourceClean = !receipt.execution.settings?.fullSessionRecord || sourceEvidence?.contextMatches && sourceEvidence.rejectedNativePatches.length === 0;
    const cleanExecution = !hold && sourceClean && !receipt.sourceCaptureError && facts.parseErrors.length === 0 && nativeClean && facts.failedMcpCalls === 0 && facts.terminalUsage !== null;
    const executionIssues = [
      !sourceClean && 'Full-session checks require review',
      receipt.sourceCaptureError && 'Full-session capture failed',
      facts.parseErrors.length > 0 && 'Malformed transcript events',
      !nativeClean && 'Native tool evidence violates the declared protocol',
      facts.failedMcpCalls > 0 && 'MCP transport failed',
      hold && `Review hold: ${hold.reason}`,
    ].filter(Boolean);
    return { index: index + 1, ticket: entry.ticket, model: entry.model.id, repetition: entry.repetition,
      status: receipt.status, appGradePass: record?.grade?.pass ?? null, functionalPass: receipt.status === 'submitted' && record?.grade?.pass === true && cleanExecution,
      elapsedSeconds: receipt.elapsedSeconds, timingBasis: record?.timingBasis ?? receipt.timingSource,
      apiEquivalentUsd: tokenCost?.costUsd ?? null, tokenCost, costUnavailableReason, usage: receipt.usage, evidence: dir,
      client: receipt.execution, runnerHash, taskHash: receipt.taskHash,
      changedFiles, transcriptFacts: facts, gradingError: record?.gradingError ?? (record ? null : 'No grading record'),
      failedChecks: record?.grade?.checks?.filter(c => !c.pass) ?? [],
      sourceEvidence, executionIssues, fullRubricStatus: 'pending_evidence_review', comparisonEligible: false };
  });
  assert.equal(holds.size, 0, 'Review hold is outside the planned schedule');
  const completeTrial = progress.completed === true && attempts.every(r => !['pending', 'not_run', 'incomplete', 'runner_error', 'evidence_missing', 'invalid_execution', 'provider_error'].includes(r.status) && !r.gradingError && !r.executionIssues?.length);
  const group = (model, ticket = null) => {
    const records = attempts.filter(r => r.model === model.id && (ticket === null || r.ticket === ticket) && !['pending', 'not_run'].includes(r.status));
    const metrics = summarize(records.map(r => ({ status: r.status, grade: { pass: r.functionalPass },
      elapsedSeconds: r.elapsedSeconds, costUsd: r.apiEquivalentUsd, costBasis: 'api_equivalent_token_estimate',
      timingBasis: r.timingBasis, execution: r.client ?? records.find(x => x.client)?.client })));
    const planned = (ticket === null ? plan.tickets.length : 1) * plan.repetitions;
    const complete = completeTrial && records.length === planned;
    return { model: model.id, ...(ticket === null ? {} : { ticket }), planned, appChecksPassed: records.filter(r => r.appGradePass).length, ...metrics,
      correctPerHour: complete ? metrics.correctPerHour : null, correctPerDollar: complete ? metrics.correctPerDollar : null }; 
  };
  const groups = plan.models.map(model => group(model));
  const ticketGroups = plan.tickets.flatMap(ticket => plan.models.map(model => group(model, ticket)));
  return { stopped: progress.stopped ?? null, completed: progress.completed === true, generatedAt: new Date().toISOString(), planHash: sha256(planBytes),
    reviewHoldsHash: reviewBytes ? sha256(reviewBytes) : null,
    analysisFiles: Object.fromEntries(['scripts/summarize-pilot.mjs', 'scripts/subscription-cost.mjs', 'pilot/accounting.mjs', 'pilot/session-evidence.mjs', 'pilot/cli.mjs', 'pilot/workspace.mjs']
      .map(file => [file, sha256(fs.readFileSync(path.join(root, file)))])),
    priceEvidenceHash: sha256(evidenceBytes), priceSource: prices.source, priceDate: prices.date,
    interpretation: 'Pipeline validation only. Requested model IDs; full transcript rubric pending. Source checks use the recorded analysis files; original receipts remain unchanged. Token-cost estimates require complete per-request records reconciled to the terminal totals and dated prices. Missing evidence leaves cost unavailable. Estimates are not subscription charges. Canaries excluded.',
    executionReviewRequired: attempts.some(r => r.executionIssues?.length), attempts, ticketGroups, groups, X: null, TTI: null };
}
export function markdownReport(report) {
  const number = (n, decimals = 2) => n == null ? 'unavailable' : n.toFixed(decimals);
  return `# Subscription pilot results\n\n${report.interpretation}\n${report.executionReviewRequired ? '\nExecution evidence requires review. Cohort throughput and cost-efficiency rates are withheld.\n' : ''}${report.stopped ? `\nTrial stopped at attempt ${report.stopped.attempt}: ${report.stopped.message}. Unstarted slots will not be resumed in this trial.\n` : ''}\n| Ticket | Requested model | Started / planned | App checks passed | Seconds | Valid candidate apps / hour | API-equivalent cost |\n|---|---|---:|---:|---:|---:|---:|\n`
    + report.ticketGroups.map(g => `| ${g.ticket} | ${g.model} | ${g.attempts} / ${g.planned} | ${g.appChecksPassed} | ${number(g.elapsedSeconds)} | ${number(g.correctPerHour)} | ${number(g.costUsd, 4)} USD |`).join('\n')
    + '\n\nAcross the full task mix:\n\n| Requested model | Started / planned | App checks passed | Seconds | Valid candidate apps / hour | API-equivalent cost |\n|---|---:|---:|---:|---:|---:|\n'
    + report.groups.map(g => `| ${g.model} | ${g.attempts} / ${g.planned} | ${g.appChecksPassed} | ${number(g.elapsedSeconds)} | ${number(g.correctPerHour)} | ${number(g.costUsd, 4)} USD |`).join('\n')
    + '\n\n| Attempt | Model | Ticket | Repeat | Outcome | Seconds | API-equivalent USD | Changed files |\n|---:|---|---|---:|---|---:|---:|---|\n'
    + report.attempts.map(r => `| ${r.index} | ${r.model} | ${r.ticket} | ${r.repetition} | ${r.status !== 'submitted' ? r.status : r.executionIssues?.length ? 'execution review required' : r.functionalPass ? 'functional pass' : r.gradingError ? 'ungraded' : 'task failure'} | ${number(r.elapsedSeconds)} | ${number(r.apiEquivalentUsd, 4)} | ${(r.changedFiles ?? []).join(', ')} |`).join('\n')
    + `\n\nPrices: [dated API price source](${report.priceSource}), ${report.priceDate}.\nAll attempts count toward time. Token costs use per-call pricing evidence when complete; actual subscription charges remain unmeasured. Rates are withheld until every planned attempt has finished and grading records exist.\nRaw transcripts and grading records remain local. X and TTI are unavailable.\n`;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [directory, evidenceFile, outputPrefix, reviewFile] = process.argv.slice(2);
  const report = pilotReport(directory, evidenceFile, reviewFile);
  fs.writeFileSync(outputPrefix + '.json', JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  fs.writeFileSync(outputPrefix + '.md', markdownReport(report), { mode: 0o600 });
  console.log(JSON.stringify({ attempts: report.attempts.filter(r => !['pending', 'not_run'].includes(r.status)).length, groups: report.groups }, null, 2));
}
