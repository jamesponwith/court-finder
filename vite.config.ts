import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Sub-path deploys (e.g. GitHub Pages project sites) set BASE_PATH,
  // e.g. BASE_PATH=/court-finder/ npm run build.
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
