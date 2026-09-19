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
  onSetting(modelId: string, configurationId: string): void;
}

// One key per model measured in this tier. The name shows or hides the model.
// The arrows step through its measured reasoning settings and nothing else.
// Neither control changes a measurement.
export function ModelStrip({ groups, hidden, active, colors, onToggleModel, onSetting }: ModelStripProps) {
  if (groups.length === 0) return <p className="text-muted">No configurations measured for this tier.</p>;
  return (
    <ul aria-label="Models" className="flex flex-wrap gap-2">
      {groups.map(group => {
        const off = hidden.has(group.modelId);
        const index = Math.max(0, group.records.findIndex(record => record.point.configuration.id === active[group.modelId]));
        const current = group.records[index];
        const step = (by: number) => {
          const next = group.records[(index + by + group.records.length) % group.records.length];
          if (next) onSetting(group.modelId, next.point.configuration.id);
        };
        return (
          <li key={group.modelId} data-model={group.modelId} className={`flex min-h-11 items-center rounded-full bg-face pr-1.5 pl-1 ${off ? 'opacity-45' : ''}`}>
            <button type="button" aria-pressed={!off} onClick={() => onToggleModel(group.modelId)} className="flex min-h-11 items-center gap-2 rounded-full px-3 font-medium">
              <ModelMark color={colors[group.modelId]} /><span className="break-all">{group.displayName}</span>
            </button>
            {group.records.length > 1 ? (
              <span className="flex items-center text-[13px] text-muted">
                <button type="button" aria-label={`${group.displayName}: previous reasoning setting`} onClick={() => step(-1)} className="grid size-11 place-items-center rounded-full hover:bg-bg sm:size-8">‹</button>
                <span className="min-w-14 text-center" aria-live="polite" data-setting>{current?.point.configuration.reasoning.label}</span>
                <button type="button" aria-label={`${group.displayName}: next reasoning setting`} onClick={() => step(1)} className="grid size-11 place-items-center rounded-full hover:bg-bg sm:size-8">›</button>
              </span>
            ) : <span className="pr-3 text-[13px] text-muted" data-setting>{current?.point.configuration.reasoning.label}</span>}
          </li>
        );
      })}
    </ul>
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
