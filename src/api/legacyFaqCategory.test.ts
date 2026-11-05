import { beforeEach, expect, it, vi } from 'vitest';
import { legacyFaqApi, type LegacyFaqPage } from './infoPages';

const put = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({ default: { put } }));

const page: LegacyFaqPage = {
  id: 9,
  language: 'ru',
  title: 'Что делать, если VPN не работает?',
  content: '<p>a</p>',
  display_order: 5,
  is_active: true,
  is_enabled: true,
  category: 'trouble',
};

beforeEach(() => {
  put.mockReset();
  put.mockResolvedValue({ data: page });
});

it('sends the topic with the rest of the question', async () => {
  await legacyFaqApi.updatePage(page);
  expect(put).toHaveBeenCalledWith('/cabinet/admin/info-pages/legacy-faq/9', {
    title: page.title,
    content: page.content,
    display_order: 5,
    is_active: true,
    category: 'trouble',
  });
});
