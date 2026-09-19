import glyph from '../../../public/brand/model-topography-glyph.svg?raw';

// The canonical logo geometry, inlined so its stroke follows the text color.
// The paths are imported, never copied. See public/brand/README.md.
export function Glyph({ className }: { className?: string }) {
  return <span aria-hidden="true" className={`inline-block [&>svg]:size-full ${className ?? ''}`} dangerouslySetInnerHTML={{ __html: glyph }} />;
}
