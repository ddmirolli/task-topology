import type { Tier } from '../../../core/topography.ts';
import type { ConfigurationRecord } from '../data/records.ts';
import { TIER_NAMES } from '../format.ts';
import { ModelMark } from './ModelMark.tsx';

const TIERS: readonly Tier[] = [1, 2, 3];

// Index tabs on the top edge of the map panel. The selected tab joins the panel.
export function TierTabs({ tier, onChange }: { tier: Tier; onChange(tier: Tier): void }) {
  return (
    <fieldset className="flex items-end gap-1 pl-5 max-sm:pl-2">
      <legend className="sr-only">Tier</legend>
      {TIERS.map(value => (
        <label key={value} className={`flex min-h-11 items-center rounded-t-xl px-5 leading-tight has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-text max-sm:px-3 max-sm:text-[13px] ${tier === value ? 'bg-face font-semibold' : 'text-muted hover:text-text'}`}>
          <input type="radio" name="tier" value={value} checked={tier === value} onChange={() => onChange(value)} className="sr-only" />
          {TIER_NAMES[value]}
        </label>
      ))}
    </fieldset>
  );
}

export interface ModelGroup { modelId: string; displayName: string; records: ConfigurationRecord[] }

export function groupByModel(records: readonly ConfigurationRecord[]): ModelGroup[] {
  const groups = new Map<string, ModelGroup>();
  for (const record of records) {
    const { modelId, displayName } = record.point.configuration;
    const group = groups.get(modelId) ?? { modelId, displayName, records: [] };
    group.records.push(record);
    groups.set(modelId, group);
  }
  // Settings keep their recorded order. An unordered setting sorts last, by label.
  for (const group of groups.values()) group.records.sort((a, b) => {
    const left = a.point.configuration.reasoning, right = b.point.configuration.reasoning;
    return (left.order ?? Infinity) - (right.order ?? Infinity) || left.label.localeCompare(right.label);
  });
  return [...groups.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
}

interface ModelStripProps {
  groups: readonly ModelGroup[];
  hidden: ReadonlySet<string>;
  // The measured configuration in use for each model.
  active: Readonly<Record<string, string>>;
  colors: Readonly<Record<string, string>>;
  onToggleModel(modelId: string): void;
}

// One key per model measured in this tier. It shows or hides the model and names
// the reasoning setting in use. It never changes a measurement.
export function ModelStrip({ groups, hidden, active, colors, onToggleModel }: ModelStripProps) {
  if (groups.length === 0) return <p className="text-muted">No configurations measured for this tier.</p>;
  return (
    <ul aria-label="Models" className="flex flex-wrap gap-2">
      {groups.map(group => {
        const off = hidden.has(group.modelId);
        const current = group.records.find(record => record.point.configuration.id === active[group.modelId]);
        return (
          <li key={group.modelId} data-model={group.modelId}>
            <button type="button" aria-pressed={!off} onClick={() => onToggleModel(group.modelId)} className={`flex min-h-11 items-center gap-2 rounded-full bg-face px-4 font-medium ${off ? 'opacity-45' : ''}`}>
              <ModelMark color={colors[group.modelId]} /><span className="break-all">{group.displayName}</span>
              <span className="text-[13px] font-normal text-muted" data-setting>{current?.point.configuration.reasoning.label}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// Which measured setting a model uses at a slider stop. Stops spread evenly over
// the model's own settings, in recorded order. Nothing is estimated between them.
export function settingAt(count: number, stop: number, stops: number): number {
  return count <= 1 || stops <= 1 ? 0 : Math.round((stop / (stops - 1)) * (count - 1));
}

// One slider for every model. It appears only when some model has more than one
// measured setting. Provider labels share no scale, so the ends are relative.
export function ReasoningSlider({ stops, stop, onChange }: { stops: number; stop: number; onChange(stop: number): void }) {
  if (stops <= 1) return null;
  return (
    <label className="flex min-h-11 items-center gap-3 rounded-full bg-face px-4">
      <span className="font-medium">Reasoning</span>
      <span className="text-[13px] text-muted">Lowest measured</span>
      <input type="range" min={0} max={stops - 1} step={1} value={stop} onChange={event => onChange(Number(event.target.value))}
        aria-valuetext={stop === 0 ? 'Lowest measured setting' : stop === stops - 1 ? 'Highest measured setting' : `Step ${stop + 1} of ${stops}`}
        className="h-11 w-36 accent-(--mtb-text) sm:w-44" />
      <span className="text-[13px] text-muted">Highest</span>
    </label>
  );
}

interface LayerProps { showSurface: boolean; showReasoningPaths: boolean; onSurface(value: boolean): void; onPaths(value: boolean): void }

// Rarely used, so it stays closed until asked for.
export function LayerControl({ showSurface, showReasoningPaths, onSurface, onPaths }: LayerProps) {
  const row = 'flex min-h-11 items-center gap-2 sm:min-h-8';
  return (
    <details className="relative">
      <summary className="flex min-h-11 list-none items-center rounded-full bg-face px-4 text-muted hover:text-text [&::-webkit-details-marker]:hidden">Layers</summary>
      <fieldset className="absolute right-0 z-10 mt-2 w-56 rounded-xl bg-face p-3 shadow-[0_8px_24px_rgb(0_0_0/0.18)]">
        <legend className="sr-only">Map layers</legend>
        <label className={row}><input type="checkbox" className="size-4 accent-(--mtb-text)" checked={showSurface} onChange={event => onSurface(event.target.checked)} />Connecting surface</label>
        <label className={row}><input type="checkbox" className="size-4 accent-(--mtb-text)" checked={showReasoningPaths} onChange={event => onPaths(event.target.checked)} />Reasoning paths</label>
      </fieldset>
    </details>
  );
}
