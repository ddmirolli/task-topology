import type { TopographyRenderer } from '../../../core/topography.ts';

export type RendererFactory = () => Promise<TopographyRenderer>;

// The single registration point for the 3D renderer. It is null until Astra's
// renderer exists, and the page then shows its empty state in the host.
// To register one, load it lazily so the table never waits for the 3D bundle:
//   export const rendererFactory: RendererFactory | null =
//     () => import('./three-renderer.ts').then(module => module.createRenderer());
export const rendererFactory: RendererFactory | null = null;
