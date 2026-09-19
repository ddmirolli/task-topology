import type { AxisName } from '../../core/topography.ts';

// The chart's letters. Data and code use axis names. Letters exist only here.
// Dan ruling, 2026-09-19: intelligence is the vertical axis. Workload and
// efficiency span the floor. The renderer draws `z` upward.
export const CHART_AXES = [
  { letter: 'x', axis: 'workload', name: 'Trusted workload' },
  { letter: 'y', axis: 'efficiency', name: 'Execution efficiency' },
  { letter: 'z', axis: 'intelligence', name: 'External intelligence' },
] as const satisfies readonly { letter: string; axis: AxisName; name: string }[];
