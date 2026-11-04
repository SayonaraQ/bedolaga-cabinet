// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Support from './Support';
import { useAuthStore } from '../store/auth';
import type { SupportConfig, User } from '../types';

// Экран поддержки ведёт к заявке, а не к личке в Telegram: люди жали «Написать»,
// потому что «Новый тикет» не читался как «связаться». Тесты держат порядок
// (заявка первой, Telegram — запасной строкой под ней) и состояние «уже есть
// открытая заявка», на котором бэк отвечает 409 на попытку создать вторую.

const state = vi.hoisted(() => ({
  config: { tickets_enabled: true, support_type: 'tickets' } as Record<string, unknown>,
  tickets: [] as Record<string, unknown>[],
  getTicket: vi.fn(),
  markRead: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
vi.mock('../api/info', () => ({
  infoApi: { getSupportConfig: async () => state.config },
}));
vi.mock('@/platform', () => ({
  usePlatform: () => ({
    haptic: { impact: vi.fn() },
    openLink: vi.fn(),
    openTelegramLink: vi.fn(),
  }),
}));
vi.mock('../api/ticketNotifications', () => ({
  ticketNotificationsApi: { markTicketAsRead: state.markRead },
}));
vi.mock('../api/tickets', () => ({
  ticketsApi: {
    getTickets: async () => ({ items: state.tickets }),
    getTicket: state.getTicket,
    uploadMedia: vi.fn(),
    createTicket: vi.fn(),
    addMessage: vi.fn(),
  },
}));

const BOTH: Partial<SupportConfig> = {
  tickets_enabled: true,
  support_type: 'both',
  support_username: '@support',
  support_url: 'https://t.me/support',
  contact_is_telegram: true,
};

function ticket(id: number, status: string, title = `Ticket ${id}`) {
  return {
    id,
    title,
    status,
    priority: 'normal',
    created_at: '2026-11-01T10:00:00Z',
    updated_at: '2026-11-02T10:00:00Z',
    closed_at: null,
    messages_count: 2,
    last_message: {
      id: 10 + id,
      message_text: `Last reply for ${id}`,
      is_from_admin: true,
      has_media: false,
      media_type: null,
      media_file_id: null,
      media_caption: null,
      created_at: '2026-11-02T10:00:00Z',
    },
  };
}

function renderSupport() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <Support />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  state.config = { tickets_enabled: true, support_type: 'tickets' };
  state.tickets = [];
  state.getTicket.mockImplementation(async (id: number) => ({
    ...ticket(id, 'answered'),
    is_reply_blocked: false,
    messages: [],
  }));
  state.markRead.mockResolvedValue({ success: true, marked_count: 1 });
  useAuthStore.setState({ user: { id: 1, telegram_id: 42 } as unknown as User });
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

it('puts the request button above the Telegram contact', async () => {
  state.config = { ...BOTH };
  renderSupport();

  const create = await screen.findByRole('button', { name: 'support.newTicket' });
  const telegram = await screen.findByRole('button', { name: /support\.telegramTitle/ });

  expect(create.compareDocumentPosition(telegram) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(telegram.textContent).toContain('@support');
  expect(telegram.textContent).toContain('support.telegramHint');
  // Прежняя карточка «Связаться с поддержкой → Написать» не должна вернуться.
  expect(screen.queryByRole('button', { name: 'support.writeButton' })).toBeNull();
});

it('explains where the answer arrives inside the request card', async () => {
  renderSupport();

  expect(await screen.findByText('support.hero.title')).toBeTruthy();
  expect(screen.getByText('support.hero.text')).toBeTruthy();
});

it('promises an email instead of the bot to users without Telegram', async () => {
  useAuthStore.setState({ user: { id: 1, telegram_id: null } as unknown as User });
  renderSupport();

  expect(await screen.findByText('support.hero.textEmail')).toBeTruthy();
  expect(screen.queryByText('support.hero.text')).toBeNull();
});

it('shows no Telegram row when tickets are the only channel', async () => {
  renderSupport();

  await screen.findByRole('button', { name: 'support.newTicket' });
  expect(screen.queryByRole('button', { name: /support\.telegramTitle/ })).toBeNull();
  expect(screen.queryByText('support.subtitle')).toBeNull();
});

it.each(['open', 'answered'])(
  'offers the %s request instead of a second create button',
  async (status) => {
    state.tickets = [ticket(7, status, 'Не подключается на iPhone'), ticket(3, 'closed')];
    renderSupport();

    const open = await screen.findByRole('button', { name: 'support.hero.openTicket' });
    expect(screen.getByText('support.hero.activeTitle')).toBeTruthy();
    expect(screen.getByText('Last reply for 7')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'support.newTicket' })).toBeNull();

    fireEvent.click(open);
    await waitFor(() => expect(state.getTicket).toHaveBeenCalledWith(7));
  },
);

it.each(['pending', 'closed'])('lets a %s ticket coexist with a new request', async (status) => {
  state.tickets = [ticket(5, status)];
  renderSupport();

  expect(await screen.findByRole('button', { name: 'support.newTicket' })).toBeTruthy();
  expect(screen.queryByText('support.hero.activeTitle')).toBeNull();
});

// Без этого колокольчик и точка на вкладке горели, пока человек не откроет
// колокольчик, хотя ответ он уже прочитал здесь, в переписке.
it('marks the reply as read once the conversation is opened', async () => {
  state.tickets = [ticket(7, 'answered', 'Не подключается на iPhone')];
  renderSupport();

  expect(state.markRead).not.toHaveBeenCalled();
  fireEvent.click(await screen.findByRole('button', { name: 'support.hero.openTicket' }));

  await waitFor(() => expect(state.markRead).toHaveBeenCalledWith(7));
});

it('scrolls the form into view when the request button is pressed', async () => {
  renderSupport();

  fireEvent.click(await screen.findByRole('button', { name: 'support.newTicket' }));

  expect(await screen.findByText('support.createTicket')).toBeTruthy();
  await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
});
