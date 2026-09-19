import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { visiblePoints, type Tier, type TopographyEvents, type TopographyViewState } from '../../core/topography.ts';
import { LayerControl, ModelControl, TierControl } from './components/Controls.tsx';
import { PointDetails } from './components/DetailsPanel.tsx';
import { IntelligenceDialog, MethodologyDialog } from './components/Dialogs.tsx';
import { Glyph } from './components/Glyph.tsx';
import { ResultsTable } from './components/ResultsTable.tsx';
import { TopographyHost } from './components/TopographyHost.tsx';
import { modelColors } from './data/colors.ts';
import { TIER_NAMES } from './format.ts';
import { useDiagnosticData, useMediaQuery, useTheme } from './hooks.ts';
import { RENDERER_THEME } from './theme.ts';

const headerButton = 'inline-flex min-h-11 items-center gap-1.5 rounded border border-line-strong px-3 text-sm hover:bg-panel sm:min-h-9';

export function App() {
  const { data, retry } = useDiagnosticData();
  const { mode, setPreference } = useTheme();
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const desktop = useMediaQuery('(min-width: 1024px)');

  // Page state the renderer reads. The renderer never owns any of it.
  const [tier, setTier] = useState<Tier>(1);
  const [comparisonChoice, setComparisonChoice] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string> | null>(null);
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);
  const [pinnedPointId, setPinnedPointId] = useState<string | null>(null);
  const [showSurface, setShowSurface] = useState(true);
  const [showReasoningPaths, setShowReasoningPaths] = useState(true);
  const [dialog, setDialog] = useState<'methodology' | 'intelligence' | null>(null);

  const records = data.status === 'ready' ? data.records : [];
  const comparisons = useMemo(() => [...new Set(records.map(record => record.point.comparisonKey))].sort(), [records]);
  const comparisonKey = comparisonChoice !== null && comparisons.includes(comparisonChoice) ? comparisonChoice : comparisons.at(-1) ?? '';
  const compared = useMemo(() => records.filter(record => record.point.comparisonKey === comparisonKey), [records, comparisonKey]);
  const tierRecords = useMemo(() => compared.filter(record => record.point.tier === tier), [compared, tier]);
  const tierCounts = useMemo(() => {
    const counts: Record<Tier, number> = { 1: 0, 2: 0, 3: 0 };
    for (const record of compared) counts[record.point.tier] += 1;
    return counts;
  }, [compared]);

  // Every measured configuration starts selected. A visitor's choice then holds across tiers.
  const selectedIds = useMemo(() => selected ?? new Set(records.map(record => record.point.configuration.id)), [selected, records]);
  const toggle = useCallback((ids: readonly string[], include: boolean) => {
    setSelected(current => {
      const next = new Set(current ?? records.map(record => record.point.configuration.id));
      for (const id of ids) { if (include) next.add(id); else next.delete(id); }
      return next;
    });
  }, [records]);

  // Colors cover every loaded model, so a filter or tier change cannot move one.
  const colors = useMemo(() => modelColors(new Set(records.map(record => record.point.configuration.modelId)), mode), [records, mode]);

  const pinnedRecord = tierRecords.find(record => record.point.id === pinnedPointId) ?? null;
  const hoveredRecord = tierRecords.find(record => record.point.id === hoveredPointId) ?? null;
  const focusedRecord = hoveredRecord ?? pinnedRecord;
  const focusedPointId = focusedRecord?.point.id ?? null;

  const viewState = useMemo<TopographyViewState | null>(() => data.status !== 'ready' ? null : {
    tier, comparisonKey, points: records.map(record => record.point), selectedConfigurationIds: [...selectedIds].sort(),
    focusedPointId, showSurface, showReasoningPaths, reducedMotion, modelColors: colors, theme: RENDERER_THEME[mode],
  }, [data.status, tier, comparisonKey, records, selectedIds, focusedPointId, showSurface, showReasoningPaths, reducedMotion, colors, mode]);
  const plottedCount = useMemo(() => (viewState ? visiblePoints(viewState).length : 0), [viewState]);

  // onFocus is transient hover or keyboard focus. onSelect pins the point's details.
  const events = useMemo<TopographyEvents>(() => ({ onFocus: setHoveredPointId, onSelect: setPinnedPointId }), []);

  const closeButton = useRef<HTMLButtonElement>(null);
  const pin = useCallback((pointId: string) => setPinnedPointId(current => (current === pointId ? null : pointId)), []);
  const unpin = useCallback(() => {
    const trigger = pinnedPointId && document.querySelector<HTMLElement>(`[data-point-trigger="${CSS.escape(pinnedPointId)}"]`);
    setPinnedPointId(null);
    if (trigger) trigger.focus();
  }, [pinnedPointId]);
  useEffect(() => { if (pinnedRecord && !desktop) closeButton.current?.focus(); }, [pinnedRecord, desktop]);
  useEffect(() => {
    if (!pinnedRecord || dialog) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') unpin(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pinnedRecord, dialog, unpin]);

  const dataset = data.status === 'ready' ? data.dataset : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-2 px-4 py-2 lg:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Glyph className="size-8 shrink-0 sm:size-9" />
            <h1 className="text-[15px] font-semibold whitespace-nowrap sm:text-base">Model Topography</h1>
          </div>
          <nav aria-label="Reference" className="flex items-center gap-2">
            <button type="button" className={headerButton} onClick={() => setDialog('methodology')}>Methodology</button>
            <button type="button" className={`${headerButton} max-sm:hidden`} onClick={() => setDialog('intelligence')}>ECI snapshot</button>
            <button type="button" className={headerButton} aria-pressed={mode === 'dark'} onClick={() => setPreference(mode === 'dark' ? 'light' : 'dark')}>
              <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4"><circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M8 1.75a6.25 6.25 0 0 1 0 12.5z" fill="currentColor" /></svg>
              <span className="max-sm:sr-only">Dark theme</span>
            </button>
          </nav>
        </div>
      </header>

      {data.status === 'ready' && data.synthetic && (
        <p role="alert" className="border-b border-line-strong bg-text px-4 py-2 text-center text-sm font-medium text-invert">Synthetic development fixture. These are invented numbers, not model results.</p>
      )}

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-4 lg:px-6">
        <div className="grid gap-4 lg:grid-cols-[248px_minmax(0,1fr)_320px] lg:grid-rows-[auto_1fr]">
          <div className="lg:col-start-1 lg:row-start-1">
            <TierControl tier={tier} counts={tierCounts} onChange={next => { setTier(next); setPinnedPointId(null); setHoveredPointId(null); }} />
          </div>

          <section aria-labelledby="map-title" className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 id="map-title" className="text-lg font-semibold">{TIER_NAMES[tier]} map</h2>
              <p className="text-xs text-muted" data-plotted-count>{plottedCount} of {tierRecords.length} configurations plotted</p>
            </div>
            <TopographyHost state={viewState} events={events} plottedCount={plottedCount} dataStatus={data.status} onRetry={retry} />
            <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
              <div className="flex gap-1.5"><dt className="font-semibold text-text">X</dt><dd>Trusted workload</dd></div>
              <div className="flex gap-1.5"><dt className="font-semibold text-text">Y</dt><dd>External intelligence, Epoch ECI</dd></div>
              <div className="flex gap-1.5"><dt className="font-semibold text-text">Z</dt><dd>Execution efficiency</dd></div>
            </dl>
          </section>

          <div className="space-y-5 lg:col-start-1 lg:row-start-2">
            {comparisons.length > 1 && (
              <label className="block text-sm font-semibold">Comparison
                <select value={comparisonKey} onChange={event => { setComparisonChoice(event.target.value); setPinnedPointId(null); }}
                  className="mt-2 block min-h-11 w-full rounded border border-line-strong bg-bg px-2 font-normal lg:min-h-9">
                  {comparisons.map(key => <option key={key}>{key}</option>)}
                </select>
              </label>
            )}
            <ModelControl records={tierRecords} selected={selectedIds} colors={colors} onToggle={toggle} />
            <LayerControl showSurface={showSurface} showReasoningPaths={showReasoningPaths} onSurface={setShowSurface} onPaths={setShowReasoningPaths} />
          </div>

          <aside aria-labelledby="details-title" className="hidden overflow-y-auto rounded border border-line p-4 lg:col-start-3 lg:row-span-2 lg:row-start-1 lg:block lg:h-0 lg:min-h-full">
            <h2 id="details-title" className="mb-3 text-sm font-semibold">Details</h2>
            {desktop && focusedRecord
              ? <PointDetails record={focusedRecord} color={colors[focusedRecord.point.configuration.modelId]} />
              : <p className="text-sm text-muted">{tierRecords.length > 0 ? 'Select a model in the results table to read its measurements, configuration and evidence.' : 'No configurations measured for this tier.'}</p>}
          </aside>
        </div>

        <div className="mt-8">
          {data.status === 'ready'
            ? <ResultsTable records={tierRecords} selected={selectedIds} colors={colors} focusedPointId={focusedPointId} pinnedPointId={pinnedRecord?.point.id ?? null} onPin={pin} onHover={setHoveredPointId}
              note={dataset ? `Diagnostic cohort, ${dataset.date}. App checks only, transcript grading pending. Not a ranking.` : null} />
            : <p className="rounded border border-line px-4 py-8 text-center text-sm text-muted" role="status">{data.status === 'loading' ? 'Loading measurements' : 'Measurements could not be loaded.'}</p>}
        </div>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-x-5 gap-y-1 px-4 py-3 text-xs text-muted lg:px-6">
          <span>Data</span>
          <a className="inline-flex min-h-11 items-center underline underline-offset-2 sm:min-h-0" href="/results.json">results.json</a>
          <a className="inline-flex min-h-11 items-center underline underline-offset-2 sm:min-h-0" href="/intelligence.json">intelligence.json</a>
          <a className="inline-flex min-h-11 items-center underline underline-offset-2 sm:min-h-0" href="/epoch-source.csv">epoch-source.csv</a>
          <button type="button" className="inline-flex min-h-11 items-center underline underline-offset-2 sm:hidden" onClick={() => setDialog('intelligence')}>ECI snapshot</button>
          <a className="inline-flex min-h-11 items-center underline underline-offset-2 sm:ml-auto sm:min-h-0" href="https://github.com/ddmirolli/model-topography" target="_blank" rel="noreferrer">Source ↗</a>
        </div>
      </footer>

      {!desktop && pinnedRecord && (
        <div role="dialog" aria-label="Details" data-details-sheet className="fixed inset-x-0 bottom-0 z-10 max-h-[75dvh] overflow-y-auto rounded-t-lg border-t border-line-strong bg-bg p-4 shadow-[0_-8px_24px_rgb(0_0_0/0.18)]">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Details</h2>
            <button ref={closeButton} type="button" onClick={unpin} className="min-h-11 rounded border border-line-strong px-4 text-sm hover:bg-panel">Close</button>
          </div>
          <PointDetails record={pinnedRecord} color={colors[pinnedRecord.point.configuration.modelId]} />
        </div>
      )}

      <MethodologyDialog open={dialog === 'methodology'} onClose={() => setDialog(null)} />
      <IntelligenceDialog open={dialog === 'intelligence'} onClose={() => setDialog(null)} />
    </div>
  );
}
