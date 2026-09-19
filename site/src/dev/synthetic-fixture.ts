// SYNTHETIC DEVELOPMENT FIXTURE. These are invented numbers, not model results.
// Loaded only by `npm run dev` with `?fixture=synthetic`. Production builds drop
// this module, and scripts/audit-dist.mjs fails the build output if it appears.
import type { AxisMeasurement, Tier } from '../../../core/topography.ts';
import type { ConfigurationRecord } from '../data/records.ts';

export const SYNTHETIC_MARKER = 'mtb-synthetic-fixture';
const COMPARISON = `${SYNTHETIC_MARKER}/1`;
const axis = (value: number, unit: string): AxisMeasurement =>
  ({ status: 'validated', value, unit, evidenceUrl: 'about:blank', methodVersion: SYNTHETIC_MARKER });

const MODELS = [
  { modelId: 'synthetic-alpha', y: 148, efforts: ['low', 'medium', 'high'] },
  { modelId: 'synthetic-beta', y: 156, efforts: ['medium', 'high', 'extra high'] },
  { modelId: 'synthetic-gamma', y: 139, efforts: ['none'] },
  { modelId: 'synthetic-delta', y: 161, efforts: ['low', 'high'] },
] as const;
const TIERS: readonly Tier[] = [1, 2, 3];

export const syntheticRecords: readonly ConfigurationRecord[] = MODELS.flatMap((model, modelIndex) =>
  model.efforts.flatMap((effort, order) => TIERS.map((tier): ConfigurationRecord => {
    const id = `${model.modelId}|Synthetic client 0.0.0|${effort}`;
    // Rises, then falls at the highest effort, so paths show a peak.
    const bend = order === 2 ? -0.6 : order;
    // One deliberate gap: a configuration with an unavailable axis.
    const missing = modelIndex === 2 && tier === 3;
    return {
      point: {
        id: `${id}#tier-${tier}#${COMPARISON}`,
        configuration: {
          id, modelId: model.modelId, displayName: `Synthetic ${model.modelId.slice(10)}`, identity: { scheme: SYNTHETIC_MARKER, provider: 'synthetic', model: model.modelId },
          accessMethod: 'local', client: 'Synthetic client', clientVersion: '0.0.0', profileHash: '0'.repeat(64), reasoning: { label: effort, providerValue: effort, order },
        },
        tier, comparisonKey: COMPARISON, taskSetVersion: SYNTHETIC_MARKER,
        axes: {
          workload: missing ? { status: 'unavailable', reason: 'Synthetic gap' } : axis(Math.max(0.5, 9 - tier * 2.2 + modelIndex + bend), 'synthetic work units'),
          intelligence: axis(model.y, 'synthetic index'),
          efficiency: axis(Math.max(0.2, 6 - modelIndex * 1.1 - order * 0.9 + (3 - tier) * 0.7), 'synthetic efficiency'),
        },
        elapsedSeconds: 240 * tier * (order + 1), costUsd: 0.05 * tier * (order + 1) * (modelIndex + 1),
        costBasis: 'synthetic', attemptCount: 9, successCount: Math.max(0, 9 - tier - modelIndex), evidenceUrl: 'about:blank',
      },
      appChecksPassed: Math.max(0, 9 - tier - modelIndex), reviewHolds: 0, tasks: [],
      datasetStatus: 'synthetic', datasetDate: 'synthetic',
    };
  })));
