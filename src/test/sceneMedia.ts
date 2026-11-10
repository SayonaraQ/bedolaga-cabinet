import { vi } from 'vitest';

/** Reactive matchMedia stub for background scene tests. */
export function mockSceneMedia() {
  const queries = new Map<string, { matches: boolean; events: EventTarget }>();
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => {
      let state = queries.get(query);
      if (!state) {
        state = {
          matches: query === '(max-width: 767px)' && window.innerWidth < 768,
          events: new EventTarget(),
        };
        queries.set(query, state);
      }
      const current = state;
      return {
        get matches() {
          return current.matches;
        },
        media: query,
        addEventListener: current.events.addEventListener.bind(current.events),
        removeEventListener: current.events.removeEventListener.bind(current.events),
      };
    }),
  );
  return (query: string, matches: boolean) => {
    const state = queries.get(query);
    if (!state) throw new Error(`No listener for ${query}`);
    state.matches = matches;
    state.events.dispatchEvent(new Event('change'));
  };
}
