/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base is set for GitHub Pages project-site hosting at /lspc-weather/.
// Override with BASE_PATH env when deploying elsewhere (e.g. '/').
export default defineConfig({
  base: process.env.BASE_PATH ?? '/lspc-weather/',
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
