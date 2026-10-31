import { defineConfig } from 'vitest/config';

/** The live checks under scripts/ — network-dependent, run on a schedule by
 *  .github/workflows/sky-parity.yml (all of them) and comparisons.yml (the
 *  two comparison reports, named by path), never by `npm test`. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/**/*.live.ts'],
    // A check's fetches are tried twice on a timeout of up to 30 s each
    // (scripts/liveFetch.ts), and one test can make several in a row, so
    // the test's own limit sits well above two of them: hitting it would
    // report Vitest's timeout in place of the fetch's, and cut the retry
    // off before it could answer.
    testTimeout: 180_000,
  },
});
