import type { AxisMeasurement, ModelConfiguration, Tier, TopographyPoint } from '../../../core/topography.ts';
import type { DiagnosticDataset } from './schema.ts';

export interface TaskMeasurement {
  taskId: string;
  taskName: string;
  attempts: number;
  appChecksPassed: number;
  elapsedSeconds: number | null;
  apiEquivalentUsd: number | null;
  reviewHolds: number;
}

// One measured configuration in one tier. `point` is the shared renderer contract.
// The remaining fields are diagnostic measurements the contract has no place for.
export interface ConfigurationRecord {
  point: TopographyPoint;
  appChecksPassed: number;
  reviewHolds: number;
  tasks: readonly TaskMeasurement[];
  datasetStatus: string;
  datasetDate: string;
}

// Field values the public dataset does not record. The shared types require a
// string, so the page stores an empty one and displays it as not recorded.
export const NOT_RECORDED = '';

// `mtb-public-diagnostic/1` holds entry-level tickets only and has no tier field.
const DIAGNOSTIC_TIER: Tier = 1;

const unavailable = (reason: string): AxisMeasurement => ({ status: 'unavailable', reason });
export const AXIS_REASONS = {
  x: 'Workload calibration is not validated. No X is published.',
  y: 'No verified Epoch ECI identity match for this configuration.',
  z: 'The efficiency formula is an unvalidated candidate. No Z is published.',
} as const;

// "Codex CLI 0.155.1" carries the client and its version in one field.
export function splitClient(label: string): { client: string; clientVersion: string } {
  const match = /^(.*\S)\s+v?(\d+(?:\.\d+)+\S*)$/.exec(label.trim());
  return match?.[1] && match[2] ? { client: match[1], clientVersion: match[2] } : { client: label.trim(), clientVersion: NOT_RECORDED };
}

const total = (values: readonly (number | null)[]): number | null =>
  values.some(value => value === null) ? null : values.reduce<number>((sum, value) => sum + (value ?? 0), 0);

export function comparisonKeyOf(dataset: DiagnosticDataset): string {
  return `${dataset.version}:${dataset.date}`;
}

export function buildRecords(dataset: DiagnosticDataset): ConfigurationRecord[] {
  const comparisonKey = comparisonKeyOf(dataset);
  const groups = new Map<string, { configuration: ModelConfiguration; tasks: TaskMeasurement[] }>();
  for (const row of dataset.rows) {
    const id = [row.model, row.client, row.effort].join('|');
    let group = groups.get(id);
    if (!group) {
      group = {
        configuration: {
          id, modelId: row.model, displayName: row.model, vendor: NOT_RECORDED, ...splitClient(row.client), profileHash: NOT_RECORDED,
          // The dataset records the effort label only. Provider value and order are not published.
          reasoning: { label: row.effort, providerValue: null, order: null },
        },
        tasks: [],
      };
      groups.set(id, group);
    }
    group.tasks.push({
      taskId: row.ticket, taskName: dataset.tasks[row.ticket] ?? row.ticket, attempts: row.attempts, appChecksPassed: row.appChecksPassed,
      elapsedSeconds: row.elapsedSeconds, apiEquivalentUsd: row.apiEquivalentUsd, reviewHolds: row.reviewHolds,
    });
  }
  return [...groups.values()].map(({ configuration, tasks }) => {
    const costUsd = total(tasks.map(task => task.apiEquivalentUsd));
    return {
      point: {
        id: `${configuration.id}#tier-${DIAGNOSTIC_TIER}#${comparisonKey}`,
        configuration, tier: DIAGNOSTIC_TIER, comparisonKey, taskSetVersion: NOT_RECORDED,
        axes: { x: unavailable(AXIS_REASONS.x), y: unavailable(AXIS_REASONS.y), z: unavailable(AXIS_REASONS.z) },
        elapsedSeconds: total(tasks.map(task => task.elapsedSeconds)),
        costUsd, costBasis: costUsd === null ? null : dataset.costBasis,
        attemptCount: tasks.reduce((sum, task) => sum + task.attempts, 0),
        // App checks are not adjudicated successes. Transcript grading is pending.
        successCount: null,
        evidenceUrl: dataset.evidenceUrl,
      },
      appChecksPassed: tasks.reduce((sum, task) => sum + task.appChecksPassed, 0),
      reviewHolds: tasks.reduce((sum, task) => sum + task.reviewHolds, 0),
      tasks, datasetStatus: dataset.status, datasetDate: dataset.date,
    };
  });
}
