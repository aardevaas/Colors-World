import type { GeneratedSwatch } from './generate-color';

/**
 * Drives the Library grid's two feed modes. A `useReducer`, not scattered
 * `useState`s, because — same rule that shaped the dock's reducer — several
 * fields here change together and one field's meaning is conditional on
 * another: `loadedCount` only means something in 'shuffle' mode, and
 * `vibeSwatches`/`vibeLabel`/`vibeStatus` only mean something in 'vibe' mode.
 * A raw `useState` per field would make "reshuffle while a vibe search is
 * still loading" a set of independent updates that could land inconsistently;
 * routing every transition through one reducer keeps them atomic.
 */
export type LibraryFeedMode = 'shuffle' | 'vibe';
export type VibeStatus = 'idle' | 'loading' | 'error';

export interface LibraryFeedState {
  readonly mode: LibraryFeedMode;
  /** Feistel seed for the current shuffle (see discovery-feed.ts). */
  readonly seed: number;
  /** How many shuffle-mode positions have been "opened" so far — the only
   *  thing @tanstack/react-virtual needs to size the shuffle-mode grid. */
  readonly loadedCount: number;
  readonly vibeQuery: string;
  readonly vibeSwatches: readonly GeneratedSwatch[];
  readonly vibeLabel: string | null;
  readonly vibeStatus: VibeStatus;
}

export type LibraryFeedAction =
  | { readonly type: 'loadMore'; readonly amount: number }
  | { readonly type: 'reshuffle'; readonly seed: number }
  | { readonly type: 'vibeSearchStart'; readonly query: string }
  | {
      readonly type: 'vibeSearchSuccess';
      readonly swatches: readonly GeneratedSwatch[];
      readonly label: string;
    }
  | { readonly type: 'vibeSearchError' }
  | { readonly type: 'clearVibe' };

export function createInitialFeedState(seed: number, initialBatch: number): LibraryFeedState {
  return {
    mode: 'shuffle',
    seed,
    loadedCount: initialBatch,
    vibeQuery: '',
    vibeSwatches: [],
    vibeLabel: null,
    vibeStatus: 'idle',
  };
}

export function libraryFeedReducer(
  state: LibraryFeedState,
  action: LibraryFeedAction
): LibraryFeedState {
  switch (action.type) {
    case 'loadMore':
      // Vibe mode's result set is already whatever the search returned in
      // full — there is no "more" to page in, unlike the open-ended shuffle.
      if (state.mode !== 'shuffle') return state;
      return { ...state, loadedCount: state.loadedCount + action.amount };

    case 'reshuffle':
      return {
        ...state,
        mode: 'shuffle',
        seed: action.seed,
        loadedCount: state.loadedCount,
        vibeQuery: '',
        vibeSwatches: [],
        vibeLabel: null,
        vibeStatus: 'idle',
      };

    case 'vibeSearchStart':
      return { ...state, mode: 'vibe', vibeQuery: action.query, vibeStatus: 'loading' };

    case 'vibeSearchSuccess':
      // A response arriving after the user already left vibe mode (reshuffled
      // or cleared mid-flight) shouldn't yank them back into it.
      if (state.mode !== 'vibe') return state;
      return {
        ...state,
        vibeSwatches: action.swatches,
        vibeLabel: action.label,
        vibeStatus: 'idle',
      };

    case 'vibeSearchError':
      if (state.mode !== 'vibe') return state;
      return { ...state, vibeSwatches: [], vibeLabel: null, vibeStatus: 'error' };

    case 'clearVibe':
      return {
        ...state,
        mode: 'shuffle',
        vibeQuery: '',
        vibeSwatches: [],
        vibeLabel: null,
        vibeStatus: 'idle',
      };

    default:
      return state;
  }
}
