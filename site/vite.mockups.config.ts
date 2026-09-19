// Builds the design mockups for screenshot review only. Output goes outside the
// repository. The production config, vite.config.ts, never includes them.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import base from './vite.config.ts';
import { mergeConfig } from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));
export default mergeConfig(base, { base: '/', build: { outDir: '/tmp/mtb-mockups-dist', emptyOutDir: true, rollupOptions: { input: path.join(root, 'mockups/index.html') } } });
