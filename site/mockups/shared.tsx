// NOTIONAL DATA. Invented models and numbers for design review only.
// Nothing in site/mockups/ ships. The production build has one input, index.html.
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { oklchToHex } from '../src/data/colors.ts';

export type Tier = 1 | 2 | 3;
export const TIERS: readonly { id: Tier; name: string }[] = [
  { id: 1, name: 'Entry level' }, { id: 2, name: 'Middle management' }, { id: 3, name: 'Senior executive' },
];
export const AXES = [
  { key: 'x', name: 'Trusted workload', unit: 'work units' },
  { key: 'y', name: 'External intelligence', unit: 'ECI' },
  { key: 'z', name: 'Execution efficiency', unit: 'units per √USD·h' },
] as const;

export interface Model { id: string; name: string; maker: string; hue: number; settings: readonly string[]; base: readonly [number, number, number] }
export const MODELS: readonly Model[] = [
  { id: 'alder', name: 'Alder 2', maker: 'Northfield', hue: 255, settings: ['low', 'medium', 'high'], base: [3.0, 160, 3.1] },
  { id: 'basalt', name: 'Basalt 4', maker: 'Quarry Labs', hue: 55, settings: ['medium', 'high', 'max'], base: [8.2, 166, 2.2] },
  { id: 'cirrus', name: 'Cirrus Pro', maker: 'Stratus', hue: 330, settings: ['low', 'high'], base: [7.0, 141, 4.6] },
  { id: 'dune', name: 'Dune 1.5', maker: 'Erg', hue: 150, settings: ['none'], base: [1.6, 147, 6.4] },
  { id: 'esker', name: 'Esker Mini', maker: 'Northfield', hue: 200, settings: ['low', 'medium'], base: [8.6, 131, 7.1] },
];

export interface Point {
  id: string; model: Model; setting: string; order: number; tier: Tier;
  x: number | null; y: number; z: number | null;
  attempts: number; successes: number; elapsedMinutes: number; costUsd: number;
}

// Workload falls as the tier rises. Effort lifts workload, then dips at the top
// setting, and always costs efficiency. One configuration has no tier 3 result.
export const POINTS: readonly Point[] = MODELS.flatMap(model => model.settings.flatMap((setting, order) =>
  TIERS.map(({ id: tier }): Point => {
    const last = model.settings.length > 2 && order === model.settings.length - 1;
    const lift = last ? order * 0.55 - 0.9 : order * 0.8;
    const missing = model.id === 'esker' && tier === 3;
    const x = Math.min(9.6, Math.max(0.4, model.base[0] + lift - (tier - 1) * (0.5 + model.base[0] * 0.22)));
    const z = Math.max(0.3, model.base[2] - order * 0.75 - (tier - 1) * 0.5);
    const successes = Math.round(30 * Math.min(0.98, 0.35 + x / 12));
    return {
      id: `${model.id}:${setting}:${tier}`, model, setting, order, tier,
      x: missing ? null : Number(x.toFixed(1)), y: model.base[1], z: missing ? null : Number(z.toFixed(1)),
      attempts: 30, successes, elapsedMinutes: Math.round((14 + order * 11) * tier * (1 + model.base[0] / 10)),
      costUsd: Number(((0.4 + order * 0.9) * tier * (model.base[1] - 120) / 18).toFixed(2)),
    };
  })));

export function useDark(): boolean {
  const subscribe = useCallback((notify: () => void) => {
    const list = matchMedia('(prefers-color-scheme: dark)');
    list.addEventListener('change', notify);
    return () => list.removeEventListener('change', notify);
  }, []);
  return useSyncExternalStore(subscribe, () => matchMedia('(prefers-color-scheme: dark)').matches);
}

export const modelColor = (model: Model, dark: boolean): string => (dark ? oklchToHex(0.82, 0.09, model.hue) : oklchToHex(0.74, 0.11, model.hue));

export interface MockState {
  tier: Tier; setTier(tier: Tier): void;
  // One measured setting is active per model. A hidden model contributes nothing.
  active: Readonly<Record<string, string>>; setSetting(modelId: string, setting: string): void;
  hidden: ReadonlySet<string>; toggleModel(modelId: string): void;
  focusId: string | null; setFocus(id: string | null): void;
  tierPoints: readonly Point[]; shown: readonly Point[]; plotted: readonly Point[]; focus: Point | null;
  dark: boolean; color(model: Model): string;
}

export function useMockState(): MockState {
  const dark = useDark();
  const [tier, setTierRaw] = useState<Tier>(1);
  const [active, setActive] = useState<Record<string, string>>(() => Object.fromEntries(MODELS.map(model => [model.id, model.settings[Math.min(1, model.settings.length - 1)] ?? ''])));
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [focusId, setFocus] = useState<string | null>(null);
  const tierPoints = useMemo(() => POINTS.filter(point => point.tier === tier), [tier]);
  const shown = useMemo(() => tierPoints.filter(point => !hidden.has(point.model.id)), [tierPoints, hidden]);
  const plotted = useMemo(() => shown.filter(point => point.x !== null && point.z !== null), [shown]);
  const focus = tierPoints.find(point => point.id === focusId) ?? null;
  useEffect(() => { document.documentElement.style.colorScheme = 'light dark'; }, []);
  return {
    tier, setTier: next => { setTierRaw(next); setFocus(current => (current ? current.replace(/:\d$/, `:${next}`) : null)); },
    active, setSetting: (modelId, setting) => { setActive(current => ({ ...current, [modelId]: setting })); setFocus(`${modelId}:${setting}:${tier}`); },
    hidden, toggleModel: modelId => setHidden(current => { const next = new Set(current); if (!next.delete(modelId)) next.add(modelId); return next; }),
    focusId, setFocus, tierPoints, shown, plotted, focus, dark, color: model => modelColor(model, dark),
  };
}

export const activePoint = (state: MockState, model: Model): Point | undefined =>
  state.tierPoints.find(point => point.model.id === model.id && point.setting === state.active[model.id]);

export const fmt = {
  value: (value: number | null, digits = 1) => (value === null ? 'Unavailable' : value.toFixed(digits)),
  minutes: (value: number) => (value >= 60 ? `${Math.floor(value / 60)} h ${value % 60} min` : `${value} min`),
  usd: (value: number) => `$${value.toFixed(2)}`,
};

export function Mark({ color, size = 12 }: { color: string; size?: number }) {
  return <span aria-hidden="true" className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, backgroundColor: color, boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--ink) 55%, transparent)' }} />;
}

export function Glyph({ size = 28 }: { size?: number }) {
  return <img src="/brand/model-topography-glyph-adaptive.svg" alt="" width={size} height={size} />;
}
