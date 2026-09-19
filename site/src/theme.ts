import type { TopographyViewState } from '../../core/topography.ts';
import type { ColorMode } from './data/colors.ts';

// Monochrome interface palette handed to the renderer through `state.theme`.
// `background` is the map panel's face color, because the host sits on it.
// The same values back the CSS variables in styles.css. Keep the two in step.
export const RENDERER_THEME: Record<ColorMode, TopographyViewState['theme']> = {
  light: { background: '#e7e7e7', foreground: '#111111', grid: '#bdbdbd', accent: '#000000' },
  dark: { background: '#1b1b1b', foreground: '#f1f1f1', grid: '#3d3d3d', accent: '#ffffff' },
};
