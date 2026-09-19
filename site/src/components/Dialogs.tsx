import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { parseIntelligenceSnapshot, type IntelligenceSnapshot } from '../data/schema.ts';

function Dialog({ open, onClose, title, children }: { open: boolean; onClose(): void; title: string; children: ReactNode }) {
  const node = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = node.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog ref={node} onClose={onClose} onClick={event => { if (event.target === node.current) onClose(); }} aria-labelledby="dialog-title"
      className="m-auto max-h-[min(90dvh,760px)] w-[min(92vw,720px)] rounded border border-line-strong bg-bg p-0 text-text">
      {open && (
        <div className="flex max-h-[min(90dvh,760px)] flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3">
            <h2 id="dialog-title" className="text-lg font-semibold">{title}</h2>
            <button type="button" onClick={onClose} className="min-h-11 rounded border border-line-strong px-3 text-sm hover:bg-panel">Close</button>
          </div>
          <div className="overflow-y-auto px-5 py-4 text-sm">{children}</div>
        </div>
      )}
    </dialog>
  );
}

const term = 'mt-4 font-semibold first:mt-0';
const definition = 'mt-1 text-muted';

export function MethodologyDialog({ open, onClose }: { open: boolean; onClose(): void }) {
  return (
    <Dialog open={open} onClose={onClose} title="Methodology and caveats">
      <dl>
        <dt className={term}>Tiers</dt>
        <dd className={definition}>One benchmark has three tiers: entry level, middle management and senior executive. Every compared configuration gets the same tasks, starting state, tools, limits and grading within a tier.</dd>
        <dt className={term}>X, trusted workload</dt>
        <dd className={definition}>The amount of coherent work a configuration completes in one session without help, at a 90 percent success bar. The workload scale is not calibrated yet, so no X is published.</dd>
        <dt className={term}>Y, external intelligence</dt>
        <dd className={definition}>The Epoch Capabilities Index for the same model. A snapshot is imported, but no tested configuration has a verified identity match yet. Names are never fuzzy matched.</dd>
        <dt className={term}>Z, execution efficiency</dt>
        <dd className={definition}>Correct work against cost and elapsed time. The current geometric-mean formula is an unvalidated candidate, so no Z is published.</dd>
        <dt className={term}>Current data</dt>
        <dd className={definition}>The table holds a diagnostic cohort. It records app-check outcomes, elapsed time and cost estimates. An app that passes its checks has not passed full grading. These results do not rank models.</dd>
        <dt className={term}>Cost</dt>
        <dd className={definition}>Costs are API-equivalent token estimates at dated prices. They are not subscription charges. A missing cost stays unavailable.</dd>
        <dt className={term}>Missing values</dt>
        <dd className={definition}>A missing coordinate is never drawn at zero. A configuration without all three validated coordinates stays out of the map and keeps its measurements in the table.</dd>
        <dt className={term}>Selection</dt>
        <dd className={definition}>Choosing models or reasoning settings changes what the map draws. It never recalculates or rescales a score.</dd>
        <dt className={term}>Connecting surface</dt>
        <dd className={definition}>The surface between points is visual interpolation. It does not claim performance for an untested model or setting.</dd>
        <dt className={term}>Reasoning settings</dt>
        <dd className={definition}>Each setting is a separately measured configuration. Provider labels have no shared scale, and scores can rise or fall as effort grows.</dd>
      </dl>
      <p className="mt-5 border-t border-line pt-4">
        <a className="font-medium underline underline-offset-2" href="https://github.com/ddmirolli/model-topography/blob/main/SPEC.md" target="_blank" rel="noreferrer">Full specification ↗</a>
      </p>
    </Dialog>
  );
}

type SnapshotState = { status: 'idle' | 'loading' | 'failed' } | { status: 'ready'; snapshot: IntelligenceSnapshot };

export function IntelligenceDialog({ open, onClose }: { open: boolean; onClose(): void }) {
  const [state, setState] = useState<SnapshotState>({ status: 'idle' });
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (!open || state.status === 'ready' || state.status === 'loading') return;
    setState({ status: 'loading' });
    fetch('/intelligence.json')
      .then(response => { if (!response.ok) throw new Error(String(response.status)); return response.json(); })
      .then(json => setState({ status: 'ready', snapshot: parseIntelligenceSnapshot(json) }))
      .catch(error => { console.error('Intelligence snapshot failed to load', error); setState({ status: 'failed' }); });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps -- loads once per open
  const snapshot = state.status === 'ready' ? state.snapshot : null;
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (snapshot?.observations ?? []).filter(row => !needle || `${row.displayName} ${row.organization ?? ''}`.toLowerCase().includes(needle));
  }, [snapshot, query]);

  return (
    <Dialog open={open} onClose={onClose} title="Epoch Capabilities Index snapshot">
      {state.status === 'loading' && <p role="status">Loading the snapshot</p>}
      {state.status === 'failed' && <p role="alert">The snapshot could not be loaded.</p>}
      {snapshot && (
        <>
          <p className="text-muted">
            Source data for the Y axis, fetched {snapshot.fetchedAt.slice(0, 10)}. These scores belong to Epoch model names.
            None is linked to a tested configuration yet, so no Y coordinate is published.
          </p>
          <p className="mt-2 text-muted">
            {snapshot.attribution}{' '}
            <a className="underline underline-offset-2" href={snapshot.methodologyUrl} target="_blank" rel="noreferrer">Method ↗</a>{' '}
            <a className="underline underline-offset-2" href={snapshot.licenseUrl} target="_blank" rel="noreferrer">CC BY 4.0 ↗</a>
          </p>
          <label className="mt-4 block font-medium">Filter by model or organization
            <input type="search" value={query} onChange={event => setQuery(event.target.value)}
              className="mt-1 block min-h-11 w-full rounded border border-line-strong bg-bg px-3 font-normal" />
          </label>
          <p className="mt-2 text-xs text-muted" role="status">{matches.length} of {snapshot.observations.length} models</p>
          <table className="mt-2 w-full text-left tabular-nums">
            <thead className="text-muted">
              <tr className="border-b border-line"><th scope="col" className="py-2 font-medium">Epoch model name</th><th scope="col" className="hidden py-2 font-medium sm:table-cell">Organization</th><th scope="col" className="py-2 text-right font-medium">ECI</th><th scope="col" className="py-2 text-right font-medium">Interval</th></tr>
            </thead>
            <tbody>
              {matches.map(row => (
                <tr key={row.sourceModel} className="border-b border-line">
                  <th scope="row" className="py-2 pr-2 font-medium">{row.displayName}</th>
                  <td className="hidden py-2 pr-2 sm:table-cell">{row.organization ?? 'Not recorded'}</td>
                  <td className="py-2 text-right">{row.score.toFixed(1)}</td>
                  <td className="py-2 text-right text-muted">{row.low === null || row.high === null ? 'Unavailable' : `${row.low.toFixed(1)} to ${row.high.toFixed(1)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Dialog>
  );
}
