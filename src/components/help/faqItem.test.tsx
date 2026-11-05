// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import { FaqItem } from './FaqItem';
import { copyToClipboard } from '../../utils/clipboard';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../utils/clipboard', () => ({ copyToClipboard: vi.fn(async () => undefined) }));
afterEach(cleanup);

const GUIDE = {
  id: 9,
  title: 'Что делать, если VPN не работает?',
  order: 5,
  category: 'trouble',
  content:
    '<p>Сначала проверьте локации.</p><h3>Ничего не открывается</h3><ol><li>Обновите подписку</li></ol>' +
    '<h3>Подключено, но интернета нет</h3><p>Отключите VPN</p>' +
    `<p>Откройте <a href="${window.location.origin}/subscriptions" target="_blank">«Подписка»</a></p>`,
};

function Where() {
  return <span data-testid="where">{useLocation().pathname}</span>;
}

function mount(open = true) {
  const onToggle = vi.fn();
  render(
    <MemoryRouter initialEntries={['/info/topic/trouble']}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <FaqItem page={GUIDE} open={open} onToggle={onToggle} />
              <Where />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
  return onToggle;
}

it('shows one branch at a time and switches with the chips', () => {
  mount();
  expect(screen.getByText('Сначала проверьте локации.')).toBeTruthy();
  expect(screen.getByText('Обновите подписку')).toBeTruthy();
  expect(screen.queryByText('Отключите VPN')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Подключено, но интернета нет' }));
  expect(screen.getByText('Отключите VPN')).toBeTruthy();
  expect(screen.queryByText('Обновите подписку')).toBeNull();
  expect(
    screen
      .getByRole('button', { name: 'Подключено, но интернета нет' })
      .getAttribute('aria-pressed'),
  ).toBe('true');
});

it('copies a link to the answer', async () => {
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'help.faq.copyLink' }));
  await waitFor(() =>
    expect(copyToClipboard).toHaveBeenCalledWith(`${window.location.origin}/info/faq/9`),
  );
  expect(await screen.findByText('help.faq.copied')).toBeTruthy();
});

it('opens same-origin links inside the app', () => {
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Подключено, но интернета нет' }));
  fireEvent.click(screen.getByRole('link', { name: '«Подписка»' }));
  expect(screen.getByTestId('where').textContent).toBe('/subscriptions');
});

it('collapsed item shows only the question and reports toggles', () => {
  const onToggle = mount(false);
  expect(screen.queryByText('Сначала проверьте локации.')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Что делать, если VPN не работает/ }));
  expect(onToggle).toHaveBeenCalled();
});
