import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { TopographyEvents, TopographyViewState } from '../../../core/topography.ts';
import { createTopographyAdapter, type AdapterStatus, type TopographyAdapter } from '../topography/adapter.ts';
import { rendererFactory } from '../topography/renderer.ts';

export const TOPOGRAPHY_HOST_ID = 'topography-host';

interface Props {
  // Null until measurements load. The host element mounts regardless.
  state: TopographyViewState | null;
  events: TopographyEvents;
  plottedCount: number;
  dataStatus: 'loading' | 'failed' | 'ready';
  onRetry(): void;
}

// The host div mounts once and never unmounts while the page lives. Filters,
// tiers, and themes reach the renderer as update() calls. The renderer owns
// every child of the host. The empty state is a sibling, never a child.
export function TopographyHost({ state, events, plottedCount, dataStatus, onRetry }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const adapter = useRef<TopographyAdapter | null>(null);
  const [status, setStatus] = useState<AdapterStatus>(rendererFactory ? 'loading' : 'absent');

  useEffect(() => () => { adapter.current?.dispose(); adapter.current = null; }, []);

  useEffect(() => {
    if (!state || !host.current) return;
    if (!adapter.current) {
      adapter.current = createTopographyAdapter(rendererFactory, setStatus);
      adapter.current.mount(host.current, state, events);
    } else adapter.current.update(state);
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps -- events travel through setEvents below

  useEffect(() => { adapter.current?.setEvents(events); }, [events]);

  let message: { title: string; body: ReactNode } | null = null;
  if (dataStatus === 'loading') message = { title: 'Loading measurements', body: null };
  else if (dataStatus === 'failed') message = {
    title: 'Measurements could not be loaded',
    body: <button type="button" onClick={onRetry} className="mt-3 min-h-11 rounded border border-line-strong px-4 text-sm font-medium hover:bg-panel">Retry</button>,
  };
  else if (status === 'failed') message = { title: 'The 3D map could not start', body: 'Measurements remain available in the results table.' };
  else if (plottedCount === 0) message = {
    title: status === 'absent' ? 'The 3D map is not built yet' : 'Nothing to plot',
    body: 'No selected configuration has validated X, Y and Z coordinates for this tier. Supported measurements are in the results table.',
  };
  else if (status === 'absent') message = { title: 'The 3D map is not built yet', body: `${plottedCount} configurations have complete coordinates. They are listed in the results table.` };
  else if (status === 'loading') message = { title: 'Loading the 3D map', body: null };

  return (
    <div className="topography-frame relative w-full overflow-hidden rounded border border-line bg-bg">
      <div id={TOPOGRAPHY_HOST_ID} ref={host} data-renderer-status={status} className="absolute inset-0 isolate" />
      {message && (
        <div role="status" className="absolute inset-0 flex flex-col items-center justify-center bg-bg px-6 text-center">
          <p className="text-base font-medium">{message.title}</p>
          {message.body && <div className="mt-1 max-w-md text-sm text-muted">{message.body}</div>}
        </div>
      )}
    </div>
  );
}
