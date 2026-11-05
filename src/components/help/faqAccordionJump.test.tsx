// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { FaqPage } from '../../api/info';
import { FaqItem } from './FaqItem';

/**
 * В теме открыт один вопрос. Тап по вопросу ниже открытого сворачивает
 * верхний, всё над пальцем сжимается, а прокрутка остаётся прежней — на
 * телефоне под пальцем оказывался блок «Не нашли ответ?», а открытый ответ
 * уезжал выше экрана. Ожидание: заголовок, по которому тапнули, остаётся на
 * том же месте экрана.
 */

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const page = (id: number, title: string, content: string): FaqPage => ({
  id,
  title,
  content,
  order: id,
  category: 'trouble',
});
const LONG = page(9, 'Что делать, если VPN не работает?', '<p>Длинная пошаговая проверка</p>');
const BELOW = page(16, 'Я купил подписку, но она не работает', '<p>Ответ</p>');

function Topic({ initialOpen }: { initialOpen: number | null }) {
  const [openId, setOpenId] = useState<number | null>(initialOpen);
  return (
    <MemoryRouter>
      {[LONG, BELOW].map((item) => (
        <FaqItem
          key={item.id}
          page={item}
          open={openId === item.id}
          onToggle={() => setOpenId((prev) => (prev === item.id ? null : item.id))}
        />
      ))}
    </MemoryRouter>
  );
}

const scrollBy = vi.fn();
let headerTop: (header: Element) => number;

beforeEach(() => {
  window.scrollBy = scrollBy as unknown as typeof window.scrollBy;
  // jsdom не считает раскладку: положение заголовка задаёт сам тест.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const top = headerTop(this);
    return {
      top,
      bottom: top + 52,
      left: 0,
      right: 390,
      width: 390,
      height: 52,
      x: 0,
      y: top,
      toJSON() {},
    };
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  scrollBy.mockReset();
});

const longOpen = () =>
  document.querySelector('#faq-9 > button')?.getAttribute('aria-expanded') === 'true';

it('держит под пальцем вопрос, когда сворачивается длинный ответ над ним', () => {
  // Пока ответ № 9 открыт, заголовок № 16 на 345 px; свернулся — на 1007 px выше.
  headerTop = (el) => (el.closest('#faq-16') ? (longOpen() ? 345 : -662) : 0);
  render(<Topic initialOpen={9} />);

  fireEvent.click(screen.getByRole('button', { name: BELOW.title }));

  expect(screen.getByRole('button', { name: BELOW.title }).getAttribute('aria-expanded')).toBe(
    'true',
  );
  expect(scrollBy).toHaveBeenCalledTimes(1);
  expect(scrollBy).toHaveBeenCalledWith({ top: -1007, behavior: 'instant' });
});

it('не крутит страницу, если заголовок остался на месте', () => {
  headerTop = () => 120;
  render(<Topic initialOpen={null} />);

  fireEvent.click(screen.getByRole('button', { name: BELOW.title }));
  fireEvent.click(screen.getByRole('button', { name: BELOW.title }));

  expect(scrollBy).not.toHaveBeenCalled();
});
