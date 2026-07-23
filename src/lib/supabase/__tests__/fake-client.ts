import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * A minimal in-memory stand-in for the Supabase query builder, covering only
 * the chain shapes this project's repositories actually use:
 * `.insert().select().single()`, `.select().eq().maybeSingle()`,
 * `.select().order().returns()`, `.update().eq().select().single()`,
 * `.select().textSearch().limit()`, `.select().gte().lt().order().returns()`
 * (range-window queries), `.insert(rows, {count}).` (awaited directly, no
 * terminal call), `.select(col, {count, head}).` (ditto),
 * `.delete().eq()` (awaited directly, no terminal call).
 *
 * This is deliberately not a Postgrest reimplementation — it exists so each
 * repository's own logic (table/column mapping, filtering, error wrapping) is
 * verifiable without a network call, not to simulate Postgres itself. Real
 * full-text search and generated columns cannot be meaningfully faked, so
 * `.textSearch()` falls back to a case-insensitive substring match against
 * the named column, or the whole row's JSON if that column doesn't exist on
 * the fake row (the `colors` fake rows never carry a real `search_vector`,
 * since that's a DB-generated column) — good enough to prove a repository
 * calls the right table with the right query and maps results correctly;
 * actual search relevance is verified live, against the real database.
 */
type Row = Record<string, unknown>;

interface SelectOptions {
  readonly count?: 'exact';
  readonly head?: boolean;
}

interface FakeResponse<T> {
  readonly data: T;
  readonly error: { message: string } | null;
  readonly count: number | null;
}

export function createFakeSupabaseClient(
  seed: Partial<Record<string, Row[]>> = {}
): SupabaseClient {
  const store: Record<string, Row[]> = {
    palettes: [],
    palette_versions: [],
    palette_branches: [],
    colors: [],
    ...seed,
  };
  let idCounter = 0;
  const nextId = (): string => `fake-${++idCounter}`;

  function from(table: string) {
    const filters: Array<(row: Row) => boolean> = [];
    let orderSpec: { column: string; ascending: boolean } | null = null;
    let mode: 'select' | 'insert' | 'update' | 'delete' = 'select';
    let insertPayload: Row[] = [];
    let updatePayload: Row = {};
    let selectOptions: SelectOptions = {};
    let limitValue: number | null = null;

    function matchingRows(): Row[] {
      const rows = store[table] ?? (store[table] = []);
      let result = rows.filter((row) => filters.every((f) => f(row)));
      if (orderSpec !== null) {
        const { column, ascending } = orderSpec;
        result = [...result].sort((a, b) => {
          const [av, bv] = [a[column], b[column]];
          // Numeric columns (spectrum_index, oklch_*) need numeric ordering —
          // string comparison would sort 10 before 2.
          const cmp =
            typeof av === 'number' && typeof bv === 'number'
              ? av - bv
              : String(av).localeCompare(String(bv));
          return ascending ? cmp : -cmp;
        });
      }
      return result;
    }

    function execute(): FakeResponse<Row[]> {
      const rows = store[table] ?? (store[table] = []);

      if (mode === 'insert') {
        const now = new Date().toISOString();
        const inserted = insertPayload.map((payload) => {
          const row: Row = { id: nextId(), created_at: now, updated_at: now, ...payload };
          rows.push(row);
          return row;
        });
        return { data: inserted, error: null, count: inserted.length };
      }

      if (mode === 'update') {
        const matches = rows.filter((row) => filters.every((f) => f(row)));
        for (const row of matches) Object.assign(row, updatePayload);
        return { data: matches, error: null, count: matches.length };
      }

      if (mode === 'delete') {
        const matches = rows.filter((row) => filters.every((f) => f(row)));
        store[table] = rows.filter((row) => !filters.every((f) => f(row)));
        return { data: matches, error: null, count: matches.length };
      }

      const matched = matchingRows();
      const limited = limitValue === null ? matched : matched.slice(0, limitValue);
      const count = selectOptions.count === 'exact' ? matched.length : null;
      const data = selectOptions.head === true ? [] : limited;
      return { data, error: null, count };
    }

    const builder = {
      insert(objOrArray: Row | Row[], options?: SelectOptions) {
        mode = 'insert';
        insertPayload = Array.isArray(objOrArray) ? objOrArray : [objOrArray];
        if (options) selectOptions = options;
        return builder;
      },
      update(obj: Row) {
        mode = 'update';
        updatePayload = obj;
        return builder;
      },
      delete() {
        mode = 'delete';
        return builder;
      },
      select(_columns?: string, options?: SelectOptions) {
        if (options) selectOptions = options;
        return builder;
      },
      eq(column: string, value: unknown) {
        filters.push((row) => row[column] === value);
        return builder;
      },
      is(column: string, value: null) {
        filters.push((row) => (row[column] ?? null) === value);
        return builder;
      },
      gte(column: string, value: unknown) {
        filters.push((row) => (row[column] as number) >= (value as number));
        return builder;
      },
      gt(column: string, value: unknown) {
        filters.push((row) => (row[column] as number) > (value as number));
        return builder;
      },
      lte(column: string, value: unknown) {
        filters.push((row) => (row[column] as number) <= (value as number));
        return builder;
      },
      lt(column: string, value: unknown) {
        filters.push((row) => (row[column] as number) < (value as number));
        return builder;
      },
      textSearch(column: string, query: string) {
        const needle = query.toLowerCase();
        filters.push((row) => {
          const haystack =
            column in row ? String(row[column] ?? '') : JSON.stringify(row);
          return haystack.toLowerCase().includes(needle);
        });
        return builder;
      },
      order(column: string, opts: { ascending: boolean }) {
        orderSpec = { column, ascending: opts.ascending };
        return builder;
      },
      limit(n: number) {
        limitValue = n;
        return builder;
      },
      async returns<T>(): Promise<FakeResponse<T>> {
        const result = execute();
        return { data: result.data as T, error: null, count: result.count };
      },
      async single<T>(): Promise<FakeResponse<T | null>> {
        const result = execute();
        if (result.data.length !== 1) {
          return {
            data: null,
            error: { message: `expected exactly one row, got ${result.data.length}` },
            count: result.count,
          };
        }
        return { data: result.data[0] as T, error: null, count: result.count };
      },
      async maybeSingle<T>(): Promise<FakeResponse<T | null>> {
        const result = execute();
        if (result.data.length > 1) {
          return {
            data: null,
            error: { message: `expected at most one row, got ${result.data.length}` },
            count: result.count,
          };
        }
        return { data: (result.data[0] ?? null) as T | null, error: null, count: result.count };
      },
      // Makes the builder itself awaitable when no terminal method
      // (.single/.maybeSingle/.returns) is called — mirrors real
      // supabase-js, where `.insert(rows, {count})` and
      // `.select(col, {count, head})` are awaited directly.
      then<TResult1 = FakeResponse<Row[]>, TResult2 = never>(
        onFulfilled?: ((value: FakeResponse<Row[]>) => TResult1 | PromiseLike<TResult1>) | null,
        onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
      ): PromiseLike<TResult1 | TResult2> {
        return Promise.resolve(execute()).then(onFulfilled, onRejected);
      },
    };

    return builder;
  }

  return { from } as unknown as SupabaseClient;
}
