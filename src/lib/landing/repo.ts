/**
 * Where the source lives.
 *
 * Its own module, with no `server-only` on it, because both server and client
 * components need it — the credibility strip fetches star counts on the server
 * while the hero and the footer simply link to the repository from the client.
 *
 * It used to live in `repo-stats.ts`, which imports `server-only` for the
 * fetching. The moment the footer became a client component to host the paint
 * run, importing this constant dragged that in with it and the build failed.
 * TypeScript cannot see that — `server-only` is a bundler contract, not a type
 * — and the test suite stubs it, so it compiled and tested clean and broke the
 * page. Splitting the constant out is what makes that impossible rather than
 * merely fixed.
 */
export const REPO_URL = 'https://github.com/aardevaas/Colors-World';
