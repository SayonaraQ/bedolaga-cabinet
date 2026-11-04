// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MobileBottomNav } from './MobileBottomNav';

// Ответ поддержки виден на вкладке «Поддержка», а не только в колокольчике:
// колокольчик в шапке замечают хуже, чем вкладку, в которую и так ходят.

const unread = vi.hoisted(() => ({ count: 0 }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
vi.mock('@/platform', () => ({
  usePlatform: () => ({ haptic: { impact: vi.fn() } }),
}));
vi.mock('@/hooks/useSupportUnreadCount', () => ({
  useSupportUnreadCount: () => unread.count,
}));

const ITEMS = [
  { key: 'dashboard', path: '/' },
  { key: 'support', path: '/support' },
] as const;

function renderNav() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <MobileBottomNav items={ITEMS} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  unread.count = 0;
});
afterEach(cleanup);

it('marks the support tab when a reply is unread', () => {
  unread.count = 2;
  renderNav();

  const support = screen.getByRole('link', { name: /navShort\.support/ });
  expect(support.textContent).toContain('nav.supportUnread');
  const home = screen.getByRole('link', { name: /navShort\.dashboard/ });
  expect(home.textContent).not.toContain('nav.supportUnread');
});

it('leaves the support tab plain when everything is read', () => {
  renderNav();

  const support = screen.getByRole('link', { name: /navShort\.support/ });
  expect(support.textContent).not.toContain('nav.supportUnread');
});
