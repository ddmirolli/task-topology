export type Tier = 1 | 2 | 3;

// Axes have names, not letters. A chart decides which name it draws on which
// letter. A routing client reads the names and never sees a letter.
export const AXIS_NAMES = ['workload', 'efficiency', 'intelligence'] as const;
export type AxisName = (typeof AXIS_NAMES)[number];

export type AxisMeasurement =
  | { status: 'validated'; value: number; unit: string; evidenceUrl: string; methodVersion: string }
  | { status: 'unavailable'; reason: string };

// A model's identity in an open external registry, such as models.dev. MTB adopts
// the registry's provider and model IDs and does not mint its own, so a client can
// match a result to the providers its user has access to.
export interface ModelIdentity { scheme: string; provider: string; model: string }

export interface ModelConfiguration {
  id: string;
  // The exact model string the run requested from its client.
  modelId: string;
  displayName: string;
  // Null until the requested ID is verified against the registry. Never guessed.
  identity: ModelIdentity | null;
  // How the run reached the model: 'api', 'subscription', 'local', or another declared
  // value. It matches ExecutionProfile.accessMethod. Null when not recorded.
  accessMethod: string | null;
  client: string;
  clientVersion: string | null;
  profileHash: string | null;
  reasoning: { label: string; providerValue: string | null; order: number | null };
}

export interface TopographyPoint {
  id: string;
  configuration: ModelConfiguration;
  tier: Tier;
  comparisonKey: string;
  taskSetVersion: string | null;
  axes: Record<AxisName, AxisMeasurement>;
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

export const isComplete = (point: Pick<TopographyPoint, 'axes'>): boolean =>
  AXIS_NAMES.every(name => { const axis = point.axes[name]; return axis?.status === 'validated' && Number.isFinite(axis.value) && axis.value >= 0; });

// Missing coordinates are omitted, never positioned at zero. Input authenticity
// and schema validation belong to the publishing service, not the renderer.
export function visiblePoints(state: TopographyViewState): TopographyPoint[] {
  const selected = new Set(state.selectedConfigurationIds);
  return state.points.filter(point => point.tier === state.tier && point.comparisonKey === state.comparisonKey
    && selected.has(point.configuration.id) && isComplete(point));
}
