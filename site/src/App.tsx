import { useCallback, useEffect, useMemo, useState } from 'react';
import { visiblePoints, type Tier, type TopographyEvents, type TopographyViewState } from '../../core/topography.ts';
import { groupByModel, LayerControl, ModelStrip, ReasoningSlider, settingAt, TierTabs } from './components/Controls.tsx';
import { Reading } from './components/DetailsPanel.tsx';
import { DataDialog, MethodologyDialog } from './components/Dialogs.tsx';
import { Glyph } from './components/Glyph.tsx';
import { ResultsTable } from './components/ResultsTable.tsx';
import { TopographyHost } from './components/TopographyHost.tsx';
import { INTRO } from './content/intro.ts';
import { modelColors } from './data/colors.ts';
import { TIER_NAMES } from './format.ts';
import { useColorMode, useDiagnosticData, useMediaQuery } from './hooks.ts';
import { RENDERER_THEME } from './theme.ts';

export function App() {
  const { data, retry } = useDiagnosticData();
  const mode = useColorMode();
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  // Page state the renderer reads. The renderer never owns any of it.
  const [tier, setTier] = useState<Tier>(1);
  const [comparisonChoice, setComparisonChoice] = useState<string | null>(null);
  const [hiddenModels, setHiddenModels] = useState<ReadonlySet<string>>(new Set());
  const [reasoningStop, setReasoningStop] = useState<number | null>(null);
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);
  const [pinnedPointId, setPinnedPointId] = useState<string | null>(null);
  const [showSurface, setShowSurface] = useState(true);
  const [showReasoningPaths, setShowReasoningPaths] = useState(true);
  const [dialog, setDialog] = useState<'methodology' | 'data' | null>(null);

  const records = data.status === 'ready' ? data.records : [];
  const comparisons = useMemo(() => [...new Set(records.map(record => record.point.comparisonKey))].sort(), [records]);
  const comparisonKey = comparisonChoice !== null && comparisons.includes(comparisonChoice) ? comparisonChoice : comparisons.at(-1) ?? '';
  const tierRecords = useMemo(() => records.filter(record => record.point.comparisonKey === comparisonKey && record.point.tier === tier), [records, comparisonKey, tier]);
  const groups = useMemo(() => groupByModel(tierRecords), [tierRecords]);

  // One measured configuration is in use per model. The reasoning slider picks it:
  // each stop maps onto the model's own measured settings, in recorded order.
  const stops = Math.max(1, ...groups.map(group => group.records.length));
  const stop = Math.min(reasoningStop ?? Math.floor((stops - 1) / 2), stops - 1);
  const active = useMemo(() => Object.fromEntries(groups.map(group =>
    [group.modelId, group.records[settingAt(group.records.length, stop, stops)]?.point.configuration.id ?? ''])), [groups, stop, stops]);

  // The surface draws through the configuration in use for every model shown.
  const selectedIds = useMemo(() => groups.filter(group => !hiddenModels.has(group.modelId)).map(group => active[group.modelId] ?? '').sort(), [groups, hiddenModels, active]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // Colors cover every loaded model, so a filter or tier change cannot move one.
  const colors = useMemo(() => modelColors(new Set(records.map(record => record.point.configuration.modelId)), mode), [records, mode]);

  const find = (pointId: string | null) => tierRecords.find(record => record.point.id === pointId) ?? null;
  const pinnedRecord = find(pinnedPointId), hoveredRecord = find(hoveredPointId);
  const focusedPointId = (hoveredRecord ?? pinnedRecord)?.point.id ?? null;
  // The reading is never empty while the tier has data. It falls back to the first configuration shown.
  const readingRecord = hoveredRecord ?? pinnedRecord ?? tierRecords.find(record => selectedSet.has(record.point.configuration.id)) ?? tierRecords[0] ?? null;

  const viewState = useMemo<TopographyViewState | null>(() => data.status !== 'ready' ? null : {
    tier, comparisonKey, points: records.map(record => record.point), selectedConfigurationIds: selectedIds,
    focusedPointId, showSurface, showReasoningPaths, reducedMotion, modelColors: colors, theme: RENDERER_THEME[mode],
  }, [data.status, tier, comparisonKey, records, selectedIds, focusedPointId, showSurface, showReasoningPaths, reducedMotion, colors, mode]);
  const plottedCount = useMemo(() => (viewState ? visiblePoints(viewState).length : 0), [viewState]);

  // onFocus is transient hover or keyboard focus. onSelect pins the point's reading.
  const events = useMemo<TopographyEvents>(() => ({ onFocus: setHoveredPointId, onSelect: setPinnedPointId }), []);
  const pin = useCallback((pointId: string) => setPinnedPointId(current => (current === pointId ? null : pointId)), []);
  useEffect(() => {
    if (!pinnedPointId || dialog) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setPinnedPointId(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pinnedPointId, dialog]);
  const toggleModel = useCallback((modelId: string) => setHiddenModels(current => {
    const next = new Set(current);
    if (!next.delete(modelId)) next.add(modelId);
    return next;
  }), []);
  const dataset = data.status === 'ready' ? data.dataset : null;
  const navLink = 'inline-flex min-h-11 items-center text-muted hover:text-text';

  return (
    <div className="mx-auto min-h-dvh max-w-[1240px] px-5 pb-16 sm:px-8">
      <header className="flex items-center justify-between py-3 sm:py-4">
        <div className="flex items-center gap-2.5">
          <Glyph className="size-[30px]" />
          <h1 className="text-[17px] font-semibold tracking-[-0.01em]">Model Topography</h1>
        </div>
        <nav aria-label="Reference" className="flex gap-6">
          <button type="button" className={navLink} onClick={() => setDialog('methodology')}>Method</button>
          <button type="button" className={navLink} onClick={() => setDialog('data')}>Data</button>
        </nav>
      </header>

      {data.status === 'ready' && data.synthetic && (
        <p role="alert" className="mb-4 rounded-full bg-text px-5 py-2 text-center font-medium text-bg">Synthetic development fixture. These are invented numbers, not model results.</p>
      )}

      <main>
        {INTRO && <p className="max-w-[68ch] pt-2 pb-8 text-[19px] leading-[1.5] text-muted" data-intro>{INTRO}</p>}

        <TierTabs tier={tier} onChange={next => { setTier(next); setPinnedPointId(null); setHoveredPointId(null); }} />
        <section aria-labelledby="map-title" className="grid overflow-hidden rounded-[20px] bg-face lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <h2 id="map-title" className="sr-only">{TIER_NAMES[tier]} map</h2>
            <TopographyHost state={viewState} events={events} plottedCount={plottedCount} dataStatus={data.status} onRetry={retry} />
          </div>
          <aside aria-label="Reading" className="overflow-y-auto border-line p-6 max-lg:border-t sm:p-7 lg:h-0 lg:min-h-full lg:border-l">
            {readingRecord
              ? <Reading record={readingRecord} color={colors[readingRecord.point.configuration.modelId]} />
              : <p className="text-muted">{data.status === 'ready' ? 'No configurations measured for this tier.' : data.status === 'loading' ? 'Loading measurements' : 'Measurements could not be loaded.'}</p>}
          </aside>
        </section>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <ModelStrip groups={groups} hidden={hiddenModels} active={active} colors={colors} onToggleModel={toggleModel} />
          <div className="flex flex-wrap items-center gap-3">
            <ReasoningSlider stops={stops} stop={stop} onChange={setReasoningStop} />
            <p className="text-[13px] text-muted" data-plotted-count>{plottedCount} of {tierRecords.length} plotted</p>
            {comparisons.length > 1 && (
              <select aria-label="Comparison" value={comparisonKey} onChange={event => { setComparisonChoice(event.target.value); setPinnedPointId(null); }} className="min-h-11 rounded-full bg-face px-4">
                {comparisons.map(key => <option key={key}>{key}</option>)}
              </select>
            )}
            <LayerControl showSurface={showSurface} showReasoningPaths={showReasoningPaths} onSurface={setShowSurface} onPaths={setShowReasoningPaths} />
          </div>
        </div>

        <div className="mt-14">
          {data.status === 'ready'
            ? <ResultsTable records={tierRecords} selected={selectedSet} colors={colors} focusedPointId={focusedPointId} pinnedPointId={pinnedRecord?.point.id ?? null} onPin={pin} onHover={setHoveredPointId}
              note={dataset ? `Diagnostic cohort, ${dataset.date}. App checks only, transcript grading pending. Not a ranking.` : null} />
            : <p className="rounded-[20px] bg-face px-4 py-10 text-center text-muted" role="status">{data.status === 'loading' ? 'Loading measurements' : 'Measurements could not be loaded.'}</p>}
        </div>
      </main>

      <MethodologyDialog open={dialog === 'methodology'} onClose={() => setDialog(null)} />
      <DataDialog open={dialog === 'data'} onClose={() => setDialog(null)} />
    </div>
  );
}
