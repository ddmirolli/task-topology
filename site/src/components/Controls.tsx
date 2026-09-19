import type { Tier } from '../../../core/topography.ts';
import type { ConfigurationRecord } from '../data/records.ts';
import { TIER_NAMES } from '../format.ts';
import { ModelMark } from './ModelMark.tsx';

const TIERS: readonly Tier[] = [1, 2, 3];

export function TierControl({ tier, counts, onChange }: { tier: Tier; counts: Readonly<Record<Tier, number>>; onChange(tier: Tier): void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">Tier</legend>
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded border border-line-strong bg-line-strong lg:grid-cols-1">
        {TIERS.map(value => (
          <label key={value} className={`flex min-h-11 items-center justify-between gap-2 px-3 py-2 text-sm has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-accent ${tier === value ? 'bg-text font-medium text-invert' : 'bg-bg hover:bg-panel'}`}>
            <input type="radio" name="tier" value={value} checked={tier === value} onChange={() => onChange(value)} className="sr-only" />
            <span>{TIER_NAMES[value]}</span>
            <span className={`text-xs tabular-nums ${tier === value ? '' : 'text-muted'}`} aria-label={`${counts[value]} measured configurations`}>{counts[value]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

interface ModelGroup { modelId: string; displayName: string; records: ConfigurationRecord[] }

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

interface ModelControlProps {
  records: readonly ConfigurationRecord[];
  selected: ReadonlySet<string>;
  colors: Readonly<Record<string, string>>;
  onToggle(configurationIds: readonly string[], include: boolean): void;
}

// Lists only configurations measured in the current tier and comparison.
// Selection decides what the map draws. It never changes a measurement.
export function ModelControl({ records, selected, colors, onToggle }: ModelControlProps) {
  const groups = groupByModel(records);
  const all = records.map(record => record.point.configuration.id);
  return (
    <div role="group" aria-labelledby="model-control-title">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 id="model-control-title" className="text-sm font-semibold">Models</h2>
        {all.length > 0 && (
          <div className="flex gap-1 text-xs">
            <button type="button" onClick={() => onToggle(all, true)} className="min-h-11 rounded px-3 underline underline-offset-2 hover:bg-panel lg:min-h-8 lg:px-2">All</button>
            <button type="button" onClick={() => onToggle(all, false)} className="min-h-11 rounded px-3 underline underline-offset-2 hover:bg-panel lg:min-h-8 lg:px-2">None</button>
          </div>
        )}
      </div>
      {groups.length === 0 && <p className="text-sm text-muted">No configurations measured for this tier.</p>}
      <ul className="space-y-3">
        {groups.map(group => {
          const ids = group.records.map(record => record.point.configuration.id);
          const included = ids.filter(id => selected.has(id)).length;
          return (
            <li key={group.modelId} data-model={group.modelId}>
              <label className="flex min-h-11 items-center gap-2 text-sm font-medium lg:min-h-8">
                <input type="checkbox" className="size-4 accent-(--mtb-accent)" checked={included === ids.length}
                  ref={node => { if (node) node.indeterminate = included > 0 && included < ids.length; }}
                  onChange={event => onToggle(ids, event.target.checked)} />
                <ModelMark color={colors[group.modelId]} />
                <span className="break-all">{group.displayName}</span>
              </label>
              <ul className="ml-6 flex flex-wrap gap-1.5" aria-label={`${group.displayName} reasoning settings`}>
                {group.records.map(record => {
                  const { id, reasoning } = record.point.configuration, on = selected.has(id);
                  return (
                    <li key={id}>
                      <label className={`flex min-h-11 items-center gap-1.5 rounded border px-2.5 text-xs has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent lg:min-h-7 ${on ? 'border-text' : 'border-line text-muted'}`}>
                        <input type="checkbox" className="sr-only" checked={on} onChange={event => onToggle([id], event.target.checked)} />
                        <span aria-hidden="true" className={`size-1.5 rounded-full ${on ? 'bg-text' : 'border border-line-strong'}`} />
                        {reasoning.label}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface LayerProps { showSurface: boolean; showReasoningPaths: boolean; onSurface(value: boolean): void; onPaths(value: boolean): void }

export function LayerControl({ showSurface, showReasoningPaths, onSurface, onPaths }: LayerProps) {
  const row = 'flex min-h-11 items-center gap-2 text-sm lg:min-h-8';
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-semibold">Map layers</legend>
      <label className={row}><input type="checkbox" className="size-4 accent-(--mtb-accent)" checked={showSurface} onChange={event => onSurface(event.target.checked)} />Connecting surface</label>
      <label className={row}><input type="checkbox" className="size-4 accent-(--mtb-accent)" checked={showReasoningPaths} onChange={event => onPaths(event.target.checked)} />Reasoning paths</label>
    </fieldset>
  );
}
