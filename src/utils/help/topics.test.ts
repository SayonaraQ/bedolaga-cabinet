import { describe, expect, it } from 'vitest';
import type { FaqPage } from '../../api/info';
import { groupFaqByTopic, HELP_TOPICS, pickFaq } from './topics';

const page = (id: number, category?: string | null): FaqPage => ({
  id,
  title: `Q${id}`,
  content: `<p>A${id}</p>`,
  order: id,
  category,
});

describe('groupFaqByTopic', () => {
  it('keeps API order inside a topic and follows the tile order', () => {
    const { topics } = groupFaqByTopic([
      page(1, 'connect'),
      page(9, 'trouble'),
      page(2, 'connect'),
      page(54, 'billing'),
    ]);
    expect(topics.map((t) => t.key)).toEqual(['trouble', 'connect', 'billing']);
    expect(topics[1].pages.map((p) => p.id)).toEqual([1, 2]);
  });

  it('puts pages without a known topic into «other» and pulls support out', () => {
    const { topics, support } = groupFaqByTopic([
      page(1),
      page(2, null),
      page(3, 'mystery'),
      page(15, 'support'),
      page(21, 'support'),
    ]);
    expect(topics).toEqual([{ key: 'other', pages: [page(1), page(2, null), page(3, 'mystery')] }]);
    expect(support.map((p) => p.id)).toEqual([15, 21]);
  });

  it('has «trouble» first and accented, «other» last', () => {
    expect(HELP_TOPICS[0]).toEqual({ key: 'trouble', accent: true });
    expect(HELP_TOPICS[HELP_TOPICS.length - 1].key).toBe('other');
  });
});

describe('pickFaq', () => {
  it('returns pages in the order of ids and skips missing ones', () => {
    expect(pickFaq([page(7), page(9), page(13)], [9, 999, 7]).map((p) => p.id)).toEqual([9, 7]);
  });
});
