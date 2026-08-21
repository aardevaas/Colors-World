import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // See test/stubs/server-only.ts for why this alias exists.
      'server-only': fileURLToPath(
        new URL('./test/stubs/server-only.ts', import.meta.url)
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    /*
     * Well above the 5s default, because several tests here are legitimately
     * slow rather than hanging.
     *
     * The color engine is exercised exhaustively — whole sweeps of the hue
     * wheel, every step of every generated scale checked against a gamut — and
     * those take seconds by design. They sat just under 5s individually, so as
     * the suite grew and they began running under real parallel load they
     * started tripping the default intermittently, a different test each run.
     * That is the worst failure a suite can have: it teaches you to re-run
     * rather than to look.
     *
     * Raised rather than making each sweep coarser, because the exhaustiveness
     * is the point of those tests. A hang still fails, just at 30s.
     */
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      exclude: ['src/lib/**/index.ts', 'src/lib/**/types.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
