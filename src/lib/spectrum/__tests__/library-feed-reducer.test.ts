import { describe, expect, it } from 'vitest';
import {
  createInitialFeedState,
  libraryFeedReducer,
  type LibraryFeedState,
} from '../library-feed-reducer';
import type { GeneratedSwatch } from '../generate-color';

function swatch(index: number): GeneratedSwatch {
  return { index, hex: '#abcdef', oklch: { l: 0.5, c: 0.1, h: 200 } };
}

describe('createInitialFeedState', () => {
  it('starts in shuffle mode with the given seed and batch size', () => {
    const state = createInitialFeedState(42, 60);
    expect(state).toEqual<LibraryFeedState>({
      mode: 'shuffle',
      seed: 42,
      loadedCount: 60,
      vibeQuery: '',
      vibeSwatches: [],
      vibeLabel: null,
      vibeStatus: 'idle',
    });
  });
});

describe('libraryFeedReducer', () => {
  it('loadMore grows loadedCount in shuffle mode', () => {
    const state = createInitialFeedState(1, 60);
    const next = libraryFeedReducer(state, { type: 'loadMore', amount: 30 });
    expect(next.loadedCount).toBe(90);
  });

  it('loadMore is a no-op while in vibe mode', () => {
    const started = libraryFeedReducer(createInitialFeedState(1, 60), {
      type: 'vibeSearchStart',
      query: 'ocean at dusk',
    });
    const next = libraryFeedReducer(started, { type: 'loadMore', amount: 30 });
    expect(next).toBe(started);
  });

  it('reshuffle resets to shuffle mode with a new seed and clears vibe state', () => {
    const vibeState: LibraryFeedState = {
      ...createInitialFeedState(1, 60),
      mode: 'vibe',
      vibeQuery: 'ocean at dusk',
      vibeSwatches: [swatch(5)],
      vibeLabel: 'deep teal',
      vibeStatus: 'idle',
    };
    const next = libraryFeedReducer(vibeState, { type: 'reshuffle', seed: 999 });
    expect(next.mode).toBe('shuffle');
    expect(next.seed).toBe(999);
    expect(next.vibeQuery).toBe('');
    expect(next.vibeSwatches).toEqual([]);
    expect(next.vibeLabel).toBeNull();
  });

  it('vibeSearchStart switches mode to vibe and sets loading', () => {
    const next = libraryFeedReducer(createInitialFeedState(1, 60), {
      type: 'vibeSearchStart',
      query: 'a stormy sky',
    });
    expect(next.mode).toBe('vibe');
    expect(next.vibeStatus).toBe('loading');
    expect(next.vibeQuery).toBe('a stormy sky');
  });

  it('vibeSearchSuccess populates results when still in vibe mode', () => {
    const loading = libraryFeedReducer(createInitialFeedState(1, 60), {
      type: 'vibeSearchStart',
      query: 'a stormy sky',
    });
    const next = libraryFeedReducer(loading, {
      type: 'vibeSearchSuccess',
      swatches: [swatch(10), swatch(20)],
      label: 'storm grey',
    });
    expect(next.vibeStatus).toBe('idle');
    expect(next.vibeSwatches).toHaveLength(2);
    expect(next.vibeLabel).toBe('storm grey');
  });

  it('ignores a stale vibeSearchSuccess after the user left vibe mode', () => {
    const loading = libraryFeedReducer(createInitialFeedState(1, 60), {
      type: 'vibeSearchStart',
      query: 'a stormy sky',
    });
    const reshuffled = libraryFeedReducer(loading, { type: 'reshuffle', seed: 2 });
    const staleResponse = libraryFeedReducer(reshuffled, {
      type: 'vibeSearchSuccess',
      swatches: [swatch(10)],
      label: 'storm grey',
    });
    expect(staleResponse).toBe(reshuffled);
  });

  it('vibeSearchError clears results and sets an error status', () => {
    const loading = libraryFeedReducer(createInitialFeedState(1, 60), {
      type: 'vibeSearchStart',
      query: 'a stormy sky',
    });
    const next = libraryFeedReducer(loading, { type: 'vibeSearchError' });
    expect(next.vibeStatus).toBe('error');
    expect(next.vibeSwatches).toEqual([]);
  });

  it('clearVibe returns to shuffle mode without touching the loaded shuffle count', () => {
    const withVibe: LibraryFeedState = {
      ...createInitialFeedState(1, 60),
      mode: 'vibe',
      vibeQuery: 'ocean at dusk',
      vibeSwatches: [swatch(5)],
      vibeLabel: 'deep teal',
      vibeStatus: 'idle',
    };
    const next = libraryFeedReducer(withVibe, { type: 'clearVibe' });
    expect(next.mode).toBe('shuffle');
    expect(next.loadedCount).toBe(60);
    expect(next.vibeSwatches).toEqual([]);
  });
});
