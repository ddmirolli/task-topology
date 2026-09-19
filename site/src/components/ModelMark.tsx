// A model's color mark. The inset ring keeps the mark visible where a pastel
// fill is close to the background, and the label beside it carries the identity.
export function ModelMark({ color, className }: { color: string | undefined; className?: string }) {
  return <span aria-hidden="true" style={{ backgroundColor: color, boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--mtb-text) 55%, transparent)' }} className={`inline-block size-3 shrink-0 rounded-full ${className ?? ''}`} />;
}
