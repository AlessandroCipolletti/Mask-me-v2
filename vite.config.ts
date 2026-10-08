import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  build: {
    outDir: mode === 'debug' ? 'dist-debug' : 'dist',
    sourcemap: mode === 'debug',
  },
}));
