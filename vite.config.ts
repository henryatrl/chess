import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig(({ mode }) => ({
  base: './',
  // The catalogue and notices are imported as text so both builds work offline.
  publicDir: false,
  plugins: mode === 'standalone' ? [viteSingleFile()] : [],
  build: { outDir: mode === 'standalone' ? 'dist-offline' : 'dist' },
}));
