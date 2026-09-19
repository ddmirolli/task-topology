export const UNAVAILABLE = 'Unavailable';
export const NOT_RECORDED_LABEL = 'Not recorded';

export function seconds(value: number | null): string {
  if (value === null) return UNAVAILABLE;
  if (value < 60) return `${value.toFixed(1)} s`;
  const minutes = Math.floor(value / 60), rest = Math.round(value - minutes * 60);
  return rest === 60 ? `${minutes + 1} min 0 s` : `${minutes} min ${rest} s`;
}

export function usd(value: number | null): string {
  return value === null ? UNAVAILABLE : `$${value.toFixed(4)}`;
}

export const recorded = (value: string | null): string => (value === null || value === '' ? NOT_RECORDED_LABEL : value);

export const TIER_NAMES = { 1: 'Entry level', 2: 'Middle management', 3: 'Senior executive' } as const;

export const COST_BASIS_LABELS: Readonly<Record<string, string>> = {
  api_equivalent_token_estimate: 'API-equivalent token estimate',
};
export const costBasisLabel = (basis: string | null): string => (basis === null ? UNAVAILABLE : COST_BASIS_LABELS[basis] ?? basis);
