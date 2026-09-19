import type { TopographyEvents, TopographyRenderer, TopographyViewState } from '../../../core/topography.ts';
import type { RendererFactory } from './renderer.ts';

// absent: no renderer is registered. failed: load, mount, or update threw.
export type AdapterStatus = 'absent' | 'loading' | 'mounted' | 'failed';

export interface TopographyAdapter {
  mount(host: HTMLElement, state: TopographyViewState, events: TopographyEvents): void;
  update(state: TopographyViewState): void;
  setEvents(events: TopographyEvents): void;
  dispose(): void;
}

// The only module that touches a TopographyRenderer. It mounts once per host,
// forwards every later state through update(), and disposes once. State sent
// while the renderer loads is kept, and the newest one is used at mount.
// A renderer fault never reaches the page. The table stays usable.
export function createTopographyAdapter(factory: RendererFactory | null, onStatus: (status: AdapterStatus) => void): TopographyAdapter {
  let renderer: TopographyRenderer | null = null;
  let latest: TopographyViewState | null = null;
  let handlers: TopographyEvents | null = null;
  let disposed = false;
  let started = false;

  // The renderer holds this object for its whole life. The page can replace
  // its handlers without a remount.
  const events: TopographyEvents = {
    onFocus: pointId => { if (!disposed) handlers?.onFocus(pointId); },
    onSelect: pointId => { if (!disposed) handlers?.onSelect(pointId); },
  };

  const fail = (error: unknown) => {
    console.error('Topography renderer failed', error);
    try { renderer?.dispose(); } catch { /* The renderer is already broken. */ }
    renderer = null;
    onStatus('failed');
  };

  return {
    mount(host, state, nextEvents) {
      if (started || disposed) return;
      started = true; latest = state; handlers = nextEvents;
      if (!factory) { onStatus('absent'); return; }
      onStatus('loading');
      factory().then(loaded => {
        if (disposed) { loaded.dispose(); return; }
        if (!latest) return;
        loaded.mount(host, latest, events);
        renderer = loaded;
        onStatus('mounted');
      }).catch(fail);
    },
    update(state) {
      latest = state;
      if (!renderer || disposed) return;
      try { renderer.update(state); } catch (error) { fail(error); }
    },
    setEvents(nextEvents) { handlers = nextEvents; },
    dispose() {
      if (disposed) return;
      disposed = true;
      try { renderer?.dispose(); } catch (error) { console.error('Topography renderer dispose failed', error); }
      renderer = null;
    },
  };
}
