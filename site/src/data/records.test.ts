import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { visiblePoints } from '../../../core/topography.ts';
import { hueOf, modelColor, modelColors } from './colors.ts';
import { buildRecords, comparisonKeyOf, splitClient } from './records.ts';
import { parseDiagnosticDataset, parseIntelligenceSnapshot } from './schema.ts';

const read = (name: string): unknown => JSON.parse(fs.readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8'));
const dataset = parseDiagnosticDataset(read('results.json'));
const records = buildRecords(dataset);

describe('diagnostic records', () => {
  it('groups task rows into one point per measured configuration', () => {
    expect(records.map(record => record.point.configuration.modelId).sort()).toEqual(['gpt-5.6-luna', 'gpt-5.6-terra']);
    expect(records.reduce((sum, record) => sum + record.point.attemptCount, 0)).toBe(18);
    expect(records.reduce((sum, record) => sum + record.appChecksPassed, 0)).toBe(17);
    expect(records.reduce((sum, record) => sum + record.reviewHolds, 0)).toBe(2);
  });

  it('publishes no coordinate and no adjudicated success count', () => {
    for (const { point } of records) {
      expect([point.axes.x.status, point.axes.y.status, point.axes.z.status]).toEqual(['unavailable', 'unavailable', 'unavailable']);
      expect(point.successCount).toBeNull();
    }
    const plotted = visiblePoints({
      tier: 1, comparisonKey: comparisonKeyOf(dataset), points: records.map(record => record.point),
      selectedConfigurationIds: records.map(record => record.point.configuration.id), focusedPointId: null, showSurface: true,
      showReasoningPaths: true, reducedMotion: false, modelColors: {}, theme: { background: '', foreground: '', grid: '', accent: '' },
    });
    expect(plotted).toEqual([]);
  });

  it('sums elapsed time and cost without changing the source values', () => {
    const luna = records.find(record => record.point.configuration.modelId === 'gpt-5.6-luna');
    const rows = dataset.rows.filter(row => row.model === 'gpt-5.6-luna');
    expect(luna?.point.elapsedSeconds).toBeCloseTo(rows.reduce((sum, row) => sum + (row.elapsedSeconds ?? 0), 0), 9);
    expect(luna?.point.costUsd).toBeCloseTo(rows.reduce((sum, row) => sum + (row.apiEquivalentUsd ?? 0), 0), 12);
    expect(luna?.point.costBasis).toBe('api_equivalent_token_estimate');
  });

  it('keeps a missing measurement unavailable in the total', () => {
    const [first, ...rest] = dataset.rows;
    if (!first) throw new Error('fixture is empty');
    const gap = buildRecords({ ...dataset, rows: [{ ...first, apiEquivalentUsd: null }, ...rest] });
    const record = gap.find(entry => entry.point.configuration.modelId === first.model);
    expect(record?.point.costUsd).toBeNull();
    expect(record?.point.costBasis).toBeNull();
  });

  it('rejects a dataset that carries a published score', () => {
    expect(() => parseDiagnosticDataset({ ...(read('results.json') as object), X: 4 })).toThrow();
  });

  it('splits the client label from its version', () => {
    expect(splitClient('Codex CLI 0.155.1')).toEqual({ client: 'Codex CLI', clientVersion: '0.155.1' });
    expect(splitClient('Custom harness')).toEqual({ client: 'Custom harness', clientVersion: '' });
  });
});

describe('intelligence snapshot', () => {
  it('parses every observation and stays unmapped', () => {
    const snapshot = parseIntelligenceSnapshot(read('intelligence.json'));
    expect(snapshot.observations).toHaveLength(266);
    expect(snapshot.identityMapping).toBe('unmapped');
  });
});

describe('model colors', () => {
  it('depends on model identity only', () => {
    expect(modelColors(['b', 'a', 'gpt-5.6-luna'], 'light')['a']).toBe(modelColors(['a'], 'light')['a']);
    expect(hueOf('gpt-5.6-luna')).not.toBe(hueOf('gpt-5.6-terra'));
  });

  it('returns distinct hex values for light and dark modes', () => {
    const light = modelColor('gpt-5.6-luna', 'light'), dark = modelColor('gpt-5.6-luna', 'dark');
    expect(light).toMatch(/^#[0-9a-f]{6}$/);
    expect(dark).toMatch(/^#[0-9a-f]{6}$/);
    expect(light).not.toBe(dark);
  });
});
