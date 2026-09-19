export type Tier = 1 | 2 | 3;
export type AxisMeasurement =
  | { status: 'validated'; value: number; unit: string; evidenceUrl: string; methodVersion: string }
  | { status: 'unavailable'; reason: string };

export interface ModelConfiguration {
  id: string;
  modelId: string;
  displayName: string;
  vendor: string;
  client: string;
  clientVersion: string;
  profileHash: string;
  reasoning: { label: string; providerValue: string | null; order: number | null };
}

export interface TopographyPoint {
  id: string;
  configuration: ModelConfiguration;
  tier: Tier;
  comparisonKey: string;
  taskSetVersion: string;
  axes: { x: AxisMeasurement; y: AxisMeasurement; z: AxisMeasurement };
  elapsedSeconds: number | null;
  costUsd: number | null;
  costBasis: string | null;
  attemptCount: number;
  successCount: number | null;
  evidenceUrl: string;
}

export interface TopographyViewState {
  tier: Tier;
  comparisonKey: string;
  points: readonly TopographyPoint[];
  selectedConfigurationIds: readonly string[];
  focusedPointId: string | null;
  showSurface: boolean;
  showReasoningPaths: boolean;
  reducedMotion: boolean;
  modelColors: Readonly<Record<string, string>>;
  theme: { background: string; foreground: string; grid: string; accent: string };
}

export interface TopographyEvents {
  onFocus(pointId: string | null): void;
  onSelect(pointId: string): void;
}

// Fable owns the host and controls. Astra implements this renderer afterward.
export interface TopographyRenderer {
  mount(host: HTMLElement, state: TopographyViewState, events: TopographyEvents): void;
  update(state: TopographyViewState): void;
  dispose(): void;
}

// Missing coordinates are omitted, never positioned at zero. Input authenticity
// and schema validation belong to the publishing service, not the renderer.
export function visiblePoints(state: TopographyViewState): TopographyPoint[] {
  const selected = new Set(state.selectedConfigurationIds);
  return state.points.filter(point => point.tier === state.tier && point.comparisonKey === state.comparisonKey
    && selected.has(point.configuration.id)
    && [point.axes.x, point.axes.y, point.axes.z].every(axis => axis.status === 'validated' && Number.isFinite(axis.value) && axis.value >= 0));
}
