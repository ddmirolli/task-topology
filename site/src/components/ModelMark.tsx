// A model's color mark. The ring keeps the mark visible where a pastel fill is
// close to the background, and the label beside it carries the identity.
export function ModelMark({ color, className }: { color: string | undefined; className?: string }) {
  return <span aria-hidden="true" style={{ backgroundColor: color }} className={`inline-block size-3 shrink-0 rounded-full ring-1 ring-line-strong ${className ?? ''}`} />;
}
