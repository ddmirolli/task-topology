import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

// The public data files stay at the site root because benchmark/site-data.test.mjs
// checks them there. This plugin serves them in development and copies the exact
// bytes into the build, so the recorded hashes stay verifiable.
const publishedFiles: Record<string, string> = {
  'results.json': 'application/json',
  'intelligence.json': 'application/json',
  'epoch-source.csv': 'text/csv',
  'brand/favicon/favicon.ico': 'image/x-icon',
  'brand/model-topography-glyph-adaptive.svg': 'image/svg+xml',
};

function publishedData(): Plugin {
  return {
    name: 'mtb-published-data',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const name = (request.url ?? '').split('?')[0]?.slice(1) ?? '';
        const type = publishedFiles[name];
        if (!type) return next();
        response.setHeader('Content-Type', type);
        response.end(fs.readFileSync(path.join(root, name)));
      });
    },
    generateBundle() {
      for (const name of Object.keys(publishedFiles))
        this.emitFile({ type: 'asset', fileName: name, source: fs.readFileSync(path.join(root, name)) });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), publishedData()],
  publicDir: false,
  // core/topography.ts and the canonical glyph live one level above site/.
  server: { fs: { allow: [path.resolve(root, '..')] } },
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: false },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
