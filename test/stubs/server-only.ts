// Stub for the `server-only` package under Vitest.
//
// `server-only`'s real implementation throws unconditionally — it depends on
// a bundler (webpack/Turbopack, via Next.js) swapping in a no-op when the
// importing module is resolved for a server context. Vitest runs in plain
// Node with no such swap, so without this alias every test that imports
// server-only code fails immediately, regardless of what it actually tests.
// See vitest.config.ts.
export {};
