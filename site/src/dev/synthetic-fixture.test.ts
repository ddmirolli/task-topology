import { describe, expect, it } from 'vitest';
import { visiblePoints, type Tier } from '../../../core/topography.ts';
import { SYNTHETIC_MARKER, syntheticRecords } from './synthetic-fixture.ts';

const plotted = (tier: Tier) => visiblePoints({
  tier, comparisonKey: `${SYNTHETIC_MARKER}/1`, points: syntheticRecords.map(record => record.point),
  selectedConfigurationIds: syntheticRecords.map(record => record.point.configuration.id), focusedPointId: null, showSurface: true,
  showReasoningPaths: true, reducedMotion: false, modelColors: {}, theme: { background: '', foreground: '', grid: '', accent: '' },
});

describe('synthetic development fixture', () => {
  it('labels every point as synthetic', () => {
    for (const { point, datasetStatus } of syntheticRecords) {
      expect(point.comparisonKey).toContain(SYNTHETIC_MARKER);
      expect(point.configuration.modelId).toMatch(/^synthetic-/);
      expect(datasetStatus).toBe('synthetic');
    }
  });

  it('gives the renderer plottable points in every tier and one gap', () => {
    expect(plotted(1)).toHaveLength(9);
    expect(plotted(2)).toHaveLength(9);
    expect(plotted(3)).toHaveLength(8);
  });
});
