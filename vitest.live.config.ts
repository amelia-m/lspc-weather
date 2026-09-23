import { defineConfig } from 'vitest/config';

/** The live checks under scripts/ — network-dependent, run on a schedule by
 *  .github/workflows/sky-parity.yml, never by `npm test`. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/**/*.live.ts'],
    testTimeout: 60_000,
  },
});
