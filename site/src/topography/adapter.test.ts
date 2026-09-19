import { describe, expect, it, vi } from 'vitest';
import type { TopographyEvents, TopographyRenderer, TopographyViewState } from '../../../core/topography.ts';
import { createTopographyAdapter, type AdapterStatus } from './adapter.ts';

const state = (tier: 1 | 2 | 3): TopographyViewState => ({
  tier, comparisonKey: 'k', points: [], selectedConfigurationIds: [], focusedPointId: null, showSurface: true,
  showReasoningPaths: true, reducedMotion: false, modelColors: {}, theme: { background: '#fff', foreground: '#000', grid: '#ccc', accent: '#000' },
});
const host = {} as HTMLElement;
const noEvents: TopographyEvents = { onFocus() {}, onSelect() {} };
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

function fake() {
  const calls: string[] = [];
  let events: TopographyEvents | null = null;
  const renderer: TopographyRenderer = {
    mount(_host, mounted, given) { calls.push(`mount:${mounted.tier}`); events = given; },
    update(next) { calls.push(`update:${next.tier}`); },
    dispose() { calls.push('dispose'); },
  };
  return { renderer, calls, events: () => events };
}

describe('topography adapter', () => {
  it('reports absent when no renderer is registered', () => {
    const statuses: AdapterStatus[] = [];
    const adapter = createTopographyAdapter(null, status => statuses.push(status));
    adapter.mount(host, state(1), noEvents);
    adapter.update(state(2));
    adapter.dispose();
    expect(statuses).toEqual(['absent']);
  });

  it('mounts once with the newest state, then updates and disposes once', async () => {
    const { renderer, calls } = fake();
    const statuses: AdapterStatus[] = [];
    const adapter = createTopographyAdapter(async () => renderer, status => statuses.push(status));
    adapter.mount(host, state(1), noEvents);
    adapter.update(state(2));
    await flush();
    adapter.mount(host, state(1), noEvents);
    adapter.update(state(3));
    adapter.dispose();
    adapter.dispose();
    expect(calls).toEqual(['mount:2', 'update:3', 'dispose']);
    expect(statuses).toEqual(['loading', 'mounted']);
  });

  it('disposes a renderer that finishes loading after disposal', async () => {
    const { renderer, calls } = fake();
    const adapter = createTopographyAdapter(async () => renderer, () => {});
    adapter.mount(host, state(1), noEvents);
    adapter.dispose();
    await flush();
    expect(calls).toEqual(['dispose']);
  });

  it('routes renderer events to the current handlers', async () => {
    const { renderer, events } = fake();
    const adapter = createTopographyAdapter(async () => renderer, () => {});
    const first = vi.fn(), second = vi.fn();
    adapter.mount(host, state(1), { onFocus: first, onSelect() {} });
    await flush();
    adapter.setEvents({ onFocus: second, onSelect() {} });
    events()?.onFocus('p');
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('p');
  });

  it('contains a renderer fault', async () => {
    const statuses: AdapterStatus[] = [];
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const adapter = createTopographyAdapter(async () => { throw new Error('no WebGL'); }, status => statuses.push(status));
    adapter.mount(host, state(1), noEvents);
    await flush();
    expect(statuses).toEqual(['loading', 'failed']);
    error.mockRestore();
  });
});
