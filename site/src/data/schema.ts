// Runtime validation for the public data files. TypeScript types alone do not
// check a fetched file, so every field the page reads is verified here.

export interface DiagnosticRow {
  ticket: string;
  model: string;
  attempts: number;
  appChecksPassed: number;
  elapsedSeconds: number | null;
  apiEquivalentUsd: number | null;
  reviewHolds: number;
  client: string;
  effort: string;
}

export interface DiagnosticDataset {
  version: string;
  date: string;
  status: string;
  sourceReportHash: string;
  evidenceUrl: string;
  costBasis: string;
  tasks: Readonly<Record<string, string>>;
  rows: readonly DiagnosticRow[];
}

export interface IntelligenceObservation {
  sourceModel: string;
  displayName: string;
  organization: string | null;
  score: number;
  low: number | null;
  high: number | null;
  modelDate: string | null;
}

export interface IntelligenceSnapshot {
  source: string;
  metric: string;
  sourceUrl: string;
  methodologyUrl: string;
  licenseUrl: string;
  attribution: string;
  fetchedAt: string;
  identityMapping: string;
  observations: readonly IntelligenceObservation[];
}

type Json = Record<string, unknown>;

function object(value: unknown, name: string): Json {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value as Json;
}
function text(source: Json, key: string): string {
  const value = source[key];
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${key} must be a non-empty string`);
  return value;
}
function count(source: Json, key: string): number {
  const value = source[key];
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error(`${key} must be a non-negative integer`);
  return value;
}
function measure(source: Json, key: string): number | null {
  const value = source[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error(`${key} must be a non-negative number or null`);
  return value;
}
function optionalText(source: Json, key: string): string | null {
  const value = source[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function parseDiagnosticDataset(input: unknown): DiagnosticDataset {
  const source = object(input, 'results');
  // A published X or composite would need its own validated method. This page
  // only understands the diagnostic dataset, where both stay null.
  if (source.X !== null || source.MTB !== null) throw new Error('Unexpected published score in a diagnostic dataset');
  const tasks: Record<string, string> = {};
  for (const [id, name] of Object.entries(object(source.tasks, 'tasks'))) {
    if (typeof name !== 'string') throw new Error('Task names must be strings');
    tasks[id] = name;
  }
  if (!Array.isArray(source.rows)) throw new Error('rows must be an array');
  const rows = source.rows.map((entry, index) => {
    const row = object(entry, `rows[${index}]`);
    const parsed: DiagnosticRow = {
      ticket: text(row, 'ticket'), model: text(row, 'model'), attempts: count(row, 'attempts'),
      appChecksPassed: count(row, 'appChecksPassed'), elapsedSeconds: measure(row, 'elapsedSeconds'),
      apiEquivalentUsd: measure(row, 'apiEquivalentUsd'), reviewHolds: count(row, 'reviewHolds'),
      client: text(row, 'client'), effort: text(row, 'effort'),
    };
    if (parsed.appChecksPassed > parsed.attempts) throw new Error('appChecksPassed exceeds attempts');
    if (!(parsed.ticket in tasks)) throw new Error(`Unknown task ${parsed.ticket}`);
    return parsed;
  });
  return {
    version: text(source, 'version'), date: text(source, 'date'), status: text(source, 'status'),
    sourceReportHash: text(source, 'sourceReportHash'), evidenceUrl: text(source, 'evidenceUrl'),
    costBasis: text(source, 'costBasis'), tasks, rows,
  };
}

export function parseIntelligenceSnapshot(input: unknown): IntelligenceSnapshot {
  const source = object(input, 'intelligence');
  if (!Array.isArray(source.observations)) throw new Error('observations must be an array');
  const observations = source.observations.map((entry, index) => {
    const row = object(entry, `observations[${index}]`);
    const score = measure(row, 'score');
    if (score === null) throw new Error('score is required');
    return {
      sourceModel: text(row, 'sourceModel'), displayName: text(row, 'displayName'), organization: optionalText(row, 'organization'),
      score, low: measure(row, 'low'), high: measure(row, 'high'), modelDate: optionalText(row, 'modelDate'),
    };
  });
  return {
    source: text(source, 'source'), metric: text(source, 'metric'), sourceUrl: text(source, 'sourceUrl'),
    methodologyUrl: text(source, 'methodologyUrl'), licenseUrl: text(source, 'licenseUrl'),
    attribution: text(source, 'attribution'), fetchedAt: text(source, 'fetchedAt'),
    identityMapping: text(source, 'identityMapping'), observations,
  };
}
