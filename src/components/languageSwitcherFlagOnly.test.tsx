// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import LanguageSwitcher from './LanguageSwitcher';

/**
 * В шапке телефона рядом с переключателем стоят палитра, тема и колокольчик.
 * С кодом «RU» и стрелкой кнопка языка была вдвое шире соседей, и все три
 * не помещались (11.11.2026). Теперь на кнопке только флаг.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'ru', changeLanguage: () => Promise.resolve() },
  }),
}));
vi.mock('@/api/info', () => ({
  infoApi: {
    getLanguages: async () => ({
      languages: [
        { code: 'ru', name: 'Русский', flag: '🇷🇺' },
        { code: 'en', name: 'English', flag: '🇬🇧' },
      ],
    }),
  },
}));

afterEach(cleanup);

function renderSwitcher() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <LanguageSwitcher />
    </QueryClientProvider>,
  );
}

it('на кнопке только флаг — без кода языка и стрелки, квадрат как у соседей', async () => {
  renderSwitcher();

  const button = await screen.findByRole('button', { name: 'common.changeLanguage' });
  expect(button.textContent).toBe('🇷🇺');
  expect(button.querySelector('svg')).toBeNull();
  expect(button.className).toContain('p-2');
  expect(button.className).toContain('rounded-linear-lg');
  expect(button.getAttribute('title')).toBe('Русский');
});

it('в открытом списке языки по-прежнему с названиями', async () => {
  renderSwitcher();

  fireEvent.click(await screen.findByRole('button', { name: 'common.changeLanguage' }));
  expect(screen.getByText('English')).toBeTruthy();
  expect(screen.getByText('Русский')).toBeTruthy();
});
