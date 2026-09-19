import type { TopographyViewState } from '../../core/topography.ts';
import type { ColorMode } from './data/colors.ts';

// Monochrome interface palette handed to the renderer through `state.theme`.
// The same values back the CSS variables in styles.css. Keep the two in step.
export const RENDERER_THEME: Record<ColorMode, TopographyViewState['theme']> = {
  light: { background: '#ffffff', foreground: '#171717', grid: '#d4d4d4', accent: '#000000' },
  dark: { background: '#0a0a0a', foreground: '#ededed', grid: '#333333', accent: '#ffffff' },
};

export type ThemePreference = ColorMode | 'system';
const STORAGE_KEY = 'mtb-theme';

export function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch { return 'system'; }
}

export function writePreference(preference: ThemePreference): void {
  try {
    if (preference === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, preference);
  } catch { /* Storage can be blocked. The choice then lasts for this visit. */ }
}
