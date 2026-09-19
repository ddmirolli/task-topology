import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { ColorMode } from './data/colors.ts';
import { buildRecords, type ConfigurationRecord } from './data/records.ts';
import { parseDiagnosticDataset, type DiagnosticDataset } from './data/schema.ts';
import { readPreference, writePreference, type ThemePreference } from './theme.ts';

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback((notify: () => void) => {
    const list = matchMedia(query);
    list.addEventListener('change', notify);
    return () => list.removeEventListener('change', notify);
  }, [query]);
  return useSyncExternalStore(subscribe, () => matchMedia(query).matches);
}

// The system theme applies until a visitor chooses one. The choice persists.
export function useTheme(): { mode: ColorMode; preference: ThemePreference; setPreference(next: ThemePreference): void } {
  const [preference, setStored] = useState<ThemePreference>(readPreference);
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  const mode: ColorMode = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
  useEffect(() => { document.documentElement.dataset.theme = mode; }, [mode]);
  const setPreference = useCallback((next: ThemePreference) => { writePreference(next); setStored(next); }, []);
  return { mode, preference, setPreference };
}

export type DataState =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; dataset: DiagnosticDataset | null; records: readonly ConfigurationRecord[]; synthetic: boolean };

// Development only. `?fixture=synthetic` loads labeled synthetic points so the
// renderer can be built before validated coordinates exist. The branch and the
// fixture module are removed from production builds.
async function loadSyntheticFixture(): Promise<readonly ConfigurationRecord[] | null> {
  if (!import.meta.env.DEV) return null;
  if (new URLSearchParams(location.search).get('fixture') !== 'synthetic') return null;
  return (await import('./dev/synthetic-fixture.ts')).syntheticRecords;
}

export function useDiagnosticData(): { data: DataState; retry(): void } {
  const [data, setData] = useState<DataState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData({ status: 'loading' });
    (async () => {
      const synthetic = await loadSyntheticFixture();
      if (synthetic) return setData({ status: 'ready', dataset: null, records: synthetic, synthetic: true });
      const response = await fetch('/results.json', { signal: controller.signal });
      if (!response.ok) throw new Error(`results.json returned ${response.status}`);
      const dataset = parseDiagnosticDataset(await response.json());
      setData({ status: 'ready', dataset, records: buildRecords(dataset), synthetic: false });
    })().catch(error => {
      if (controller.signal.aborted) return;
      console.error('Measurements failed to load', error);
      setData({ status: 'failed' });
    });
    return () => controller.abort();
  }, [attempt]);
  return { data, retry: useCallback(() => setAttempt(count => count + 1), []) };
}
