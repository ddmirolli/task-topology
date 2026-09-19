// Model colors come from model identity alone. The hue is a hash of the model ID,
// so a color never depends on row order, filters, tier, or which other models load.
// Output is hex because the renderer may hand the value to a 3D library.

export type ColorMode = 'light' | 'dark';

// Pinned hues for measured models keep near-identical hashes apart.
const PINNED_HUES: Readonly<Record<string, number>> = {
  'gpt-5.6-luna': 255,
  'gpt-5.6-terra': 55,
};

// Pastel in both modes. Light mode is deeper so a mark stays legible on white.
// A pastel cannot reach 3:1 against white alone, so every mark also gets a
// monochrome outline and a text label.
const TONE: Record<ColorMode, { lightness: number; chroma: number }> = {
  light: { lightness: 0.74, chroma: 0.11 },
  dark: { lightness: 0.82, chroma: 0.09 },
};

export function hueOf(modelId: string): number {
  const pinned = PINNED_HUES[modelId];
  if (pinned !== undefined) return pinned;
  let hash = 2166136261;
  for (let index = 0; index < modelId.length; index += 1) hash = Math.imul(hash ^ modelId.charCodeAt(index), 16777619);
  return (hash >>> 0) % 360;
}

export function oklchToHex(lightness: number, chroma: number, hue: number): string {
  const angle = (hue * Math.PI) / 180, a = chroma * Math.cos(angle), b = chroma * Math.sin(angle);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return '#' + linear.map(value => {
    const clamped = Math.min(1, Math.max(0, value));
    const encoded = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * clamped ** (1 / 2.4) - 0.055;
    return Math.round(encoded * 255).toString(16).padStart(2, '0');
  }).join('');
}

export function modelColor(modelId: string, mode: ColorMode): string {
  const tone = TONE[mode];
  return oklchToHex(tone.lightness, tone.chroma, hueOf(modelId));
}

export function modelColors(modelIds: Iterable<string>, mode: ColorMode): Record<string, string> {
  const colors: Record<string, string> = {};
  for (const id of modelIds) colors[id] = modelColor(id, mode);
  return colors;
}
