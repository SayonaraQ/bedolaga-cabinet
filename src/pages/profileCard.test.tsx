// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformProvider } from '@/platform/PlatformProvider';
import { useAuthStore } from '@/store/auth';
import type { User } from '@/types';
import type { NotificationSettings, NotificationSettingsUpdate } from '@/api/notifications';
import enLocale from '@/locales/en.json';
import { UI } from '@/config/constants';
import Profile from './Profile';

function translate(key: string, options?: Record<string, unknown>): string {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], enLocale);
  return (typeof value === 'string' ? value : key).replace(/{{(\w+)}}/g, (_, name) =>
    String(options?.[name] ?? ''),
  );
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: translate, i18n: { language: 'en' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
vi.mock('@/utils/uiLocale', () => ({ uiLocale: () => 'en-US' }));

const api = vi.hoisted(() => ({
  getMyAvatar: vi.fn(),
  resendVerification: vi.fn(),
  requestEmailChange: vi.fn(),
  verifyEmailChange: vi.fn(),
  getMe: vi.fn(),
  getEmailAuthEnabled: vi.fn(),
  getSettings: vi.fn(),
  updateSettings: vi.fn(),
  getReferralInfo: vi.fn(),
  getReferralTerms: vi.fn(),
  copy: vi.fn(),
}));

vi.mock('@/api/auth', () => ({ authApi: api }));
vi.mock('@/api/branding', () => ({ brandingApi: api }));
vi.mock('@/api/notifications', () => ({ notificationsApi: api }));
vi.mock('@/api/referral', () => ({ referralApi: api }));
vi.mock('@/utils/clipboard', () => ({ copyToClipboard: api.copy }));

const user: User = {
  id: 1,
  telegram_id: 123,
  username: 'alex',
  first_name: 'Alex',
  last_name: 'Example',
  email: 'alex@example.com',
  email_verified: true,
  balance_kopeks: 0,
  balance_rubles: 0,
  referral_code: 'alex-ref',
  language: 'en',
  created_at: '2026-01-01T12:00:00Z',
  auth_type: 'telegram',
};

let settings: NotificationSettings;
const clients: QueryClient[] = [];

async function renderPage(overrides: Partial<User> = {}) {
  useAuthStore.setState({ user: { ...user, ...overrides } });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  clients.push(client);
  const result = render(
    <QueryClientProvider client={client}>
      <PlatformProvider>
        <MemoryRouter initialEntries={['/profile']}>
          <Routes>
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/accounts" element={<div>Accounts destination</div>} />
          </Routes>
        </MemoryRouter>
      </PlatformProvider>
    </QueryClientProvider>,
  );
  await waitFor(() => expect(client.isFetching()).toBe(0));
  return { ...result, client };
}

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  for (const mock of Object.values(api)) mock.mockReset();
  settings = {
    subscription_expiry_enabled: true,
    subscription_expiry_days: 3,
    traffic_warning_enabled: true,
    traffic_warning_percent: 80,
    balance_low_enabled: false,
    balance_low_threshold: 100,
    news_enabled: true,
    promo_offers_enabled: false,
  };
  api.getMyAvatar.mockResolvedValue({ photo_url: null });
  api.getEmailAuthEnabled.mockResolvedValue({ enabled: true, verification_enabled: true });
  api.getSettings.mockImplementation(async () => ({ ...settings }));
  api.updateSettings.mockImplementation(async (update: NotificationSettingsUpdate) => {
    settings = { ...settings, ...update };
    return settings;
  });
  api.resendVerification.mockResolvedValue({ message: 'sent' });
  api.requestEmailChange.mockResolvedValue({ expires_in_minutes: 10 });
  api.verifyEmailChange.mockResolvedValue({ message: 'changed' });
  api.getMe.mockResolvedValue({ ...user, email: 'new@example.com' });
  api.copy.mockResolvedValue(undefined);
  // Even an enabled referral programme must not add its widget to Profile.
  api.getReferralInfo.mockResolvedValue({ referral_code: 'alex-ref' });
  api.getReferralTerms.mockResolvedValue({ is_enabled: true });
});

afterEach(() => {
  cleanup();
  for (const client of clients.splice(0)) client.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Profile business card', () => {
  it('removes referral links, sharing and referral queries', async () => {
    const { container, client } = await renderPage();
    expect(screen.queryByText(enLocale.referral.yourLink)).toBeNull();
    expect(screen.queryByRole('button', { name: /share|copy link/i })).toBeNull();
    expect(container.querySelector('a[href*="referral"], input[value*="?ref="]')).toBeNull();
    expect(api.getReferralInfo).not.toHaveBeenCalled();
    expect(api.getReferralTerms).not.toHaveBeenCalled();
    expect(client.getQueryCache().findAll({ queryKey: ['referral-info'] })).toHaveLength(0);
  });

  it('shows the name, username, registration date and a copyable Telegram ID', async () => {
    await renderPage();
    expect(screen.getByText('Alex Example')).toBeTruthy();
    expect(screen.getAllByText('@alex')).toHaveLength(2);
    expect(screen.getByText('Member since January 1, 2026')).toBeTruthy();
    expect(screen.getByText('ID 123')).toBeTruthy();
    const copy = screen.getByRole('button', { name: 'Copy ID' });
    vi.useFakeTimers();
    fireEvent.click(copy);
    expect(api.copy).toHaveBeenCalledWith('123');
    expect(screen.getByRole('button', { name: 'ID copied' })).toBe(copy);
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByRole('button', { name: 'Copy ID' })).toBe(copy);
  });

  it('hides the Telegram row and ID chip for users without Telegram', async () => {
    await renderPage({ telegram_id: null, username: null, created_at: '' });
    expect(screen.queryByText('Telegram')).toBeNull();
    expect(screen.queryByText('Connected')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copy ID' })).toBeNull();
    expect(screen.queryByText(/Member since/)).toBeNull();
    expect(screen.getAllByText(user.email as string)).toHaveLength(2);
    expect(api.getMyAvatar).not.toHaveBeenCalled();
  });

  it('uses the avatar hook and falls back to a Unicode initial after an image error', async () => {
    api.getMyAvatar.mockResolvedValue({ photo_url: 'https://example.com/avatar.jpg' });
    await renderPage({ first_name: '𐐨lex', last_name: null });
    const avatar = screen.getByRole('img', { name: enLocale.common.avatar });
    expect(avatar.getAttribute('src')).toBe('https://example.com/avatar.jpg');
    fireEvent.error(avatar);
    expect(screen.queryByRole('img', { name: enLocale.common.avatar })).toBeNull();
    expect(screen.getByText('𐐀')).toBeTruthy();
  });

  it('links an absent email through the accounts page', async () => {
    await renderPage({ email: null, email_verified: false });
    expect(screen.getByText('Not linked')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Link' }));
    expect(screen.getByText('Accounts destination')).toBeTruthy();
  });

  it('expands and collapses verification details and preserves the resend cooldown', async () => {
    await renderPage({ email_verified: false });
    expect(screen.queryByRole('button', { name: 'Resend Verification Email' })).toBeNull();
    const confirm = screen.getByRole('button', { name: 'Confirm' });
    expect(confirm.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(confirm);
    expect(confirm.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText(enLocale.profile.verificationRequired)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Resend Verification Email' }));
    await waitFor(() => expect(api.resendVerification).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(enLocale.profile.verificationResent)).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: /Resend in \d+ sec/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(confirm);
    expect(screen.queryByText(enLocale.profile.verificationRequired)).toBeNull();
  });

  it('shows the verified pill and opens email changes', async () => {
    await renderPage();
    expect(screen.getByText('Verified').className).toContain('uppercase');
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(screen.getByPlaceholderText('new@email.com')).toBeTruthy();
  });

  it('hides the email row when email sign-in is disabled', async () => {
    api.getEmailAuthEnabled.mockResolvedValue({ enabled: false });
    await renderPage();
    expect(screen.queryByText('Email', { exact: true })).toBeNull();
    expect(screen.queryByText('Verified')).toBeNull();
    expect(screen.getByText('Telegram')).toBeTruthy();
  });

  it('does not offer confirmation when email verification is disabled', async () => {
    api.getEmailAuthEnabled.mockResolvedValue({ enabled: true, verification_enabled: false });
    await renderPage({ email_verified: false });
    expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull();
    expect(screen.queryByText('Verified')).toBeNull();
  });

  it('updates expiry through chips and marks the saved value as selected', async () => {
    await renderPage();
    const group = screen.getByRole('group', { name: 'Days before expiry' });
    expect(within(group).getByRole('button', { name: '3' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    const seven = within(group).getByRole('button', { name: '7' });
    expect(seven.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(seven);
    await waitFor(() =>
      expect(api.updateSettings.mock.calls[0]?.[0]).toEqual({ subscription_expiry_days: 7 }),
    );
    await waitFor(() => expect(seven.getAttribute('aria-pressed')).toBe('true'));
    expect(within(group).getByRole('button', { name: '3' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('keeps traffic chips, balance thresholds and notification switches connected to the API', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: '90%' }));
    await waitFor(() =>
      expect(api.updateSettings.mock.calls[0]?.[0]).toEqual({ traffic_warning_percent: 90 }),
    );
    fireEvent.click(screen.getByRole('switch', { name: 'Low Balance' }));
    const threshold = await screen.findByRole('spinbutton', { name: 'Threshold' });
    expect(api.updateSettings.mock.calls[1]?.[0]).toEqual({ balance_low_enabled: true });
    fireEvent.change(threshold, { target: { value: '250' } });
    await waitFor(() =>
      expect(api.updateSettings.mock.calls[2]?.[0]).toEqual({ balance_low_threshold: 250 }),
    );
  });

  it('shows unavailable notification settings after a failed query', async () => {
    api.getSettings.mockRejectedValue(new Error('Unavailable'));
    await renderPage();
    expect(screen.getByText(enLocale.profile.notifications.unavailable)).toBeTruthy();
  });

  it('opens accounts from the connected accounts row', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Connected Accounts/ }));
    expect(screen.getByText('Accounts destination')).toBeTruthy();
  });
});

describe('Profile inline email changes', () => {
  it('preserves focus, validation, code verification, cooldowns and the user refresh', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    const email = screen.getByPlaceholderText('new@email.com');
    await waitFor(() => expect(document.activeElement).toBe(email));
    fireEvent.change(email, { target: { value: user.email } });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    expect(screen.getByText(enLocale.profile.changeEmail.sameEmail)).toBeTruthy();
    expect(api.requestEmailChange).not.toHaveBeenCalled();
    fireEvent.change(email, { target: { value: '  new@example.com  ' } });
    fireEvent.keyDown(email, { key: 'Enter' });
    const code = await screen.findByPlaceholderText('000000');
    expect(api.requestEmailChange.mock.calls[0][0]).toBe('new@example.com');
    await waitFor(() => expect(document.activeElement).toBe(code));
    expect(
      (screen.getByRole('button', { name: /Resend in \d+ sec/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.change(code, { target: { value: '1x23456' } });
    fireEvent.keyDown(code, { key: 'Enter' });
    expect(await screen.findByText(enLocale.profile.changeEmail.success)).toBeTruthy();
    expect(api.verifyEmailChange.mock.calls[0][0]).toBe('123456');
    expect(api.getMe).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(useAuthStore.getState().user?.email).toBe('new@example.com'));
    await waitFor(
      () => expect(screen.queryByText(enLocale.profile.changeEmail.success)).toBeNull(),
      {
        timeout: 4000,
      },
    );
  });

  it('keeps direct replacement of an unverified email working', async () => {
    api.requestEmailChange.mockResolvedValue({ expires_in_minutes: 0 });
    await renderPage({ email_verified: false });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    fireEvent.click(screen.getByRole('button', { name: 'Change email' }));
    fireEvent.change(screen.getByPlaceholderText('new@email.com'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByText(enLocale.profile.changeEmail.success)).toBeTruthy();
    expect(api.verifyEmailChange).not.toHaveBeenCalled();
    await waitFor(() => expect(useAuthStore.getState().user?.email).toBe('new@example.com'));
  });

  it('maps email change errors and allows cancellation', async () => {
    api.requestEmailChange.mockRejectedValue({
      isAxiosError: true,
      response: { data: { detail: 'email already in use' } },
    });
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    fireEvent.change(screen.getByPlaceholderText('new@email.com'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByText(enLocale.profile.changeEmail.emailAlreadyUsed)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByPlaceholderText('new@email.com')).toBeNull());
  });

  it('allows resending the change code after its cooldown', async () => {
    await renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    fireEvent.change(screen.getByPlaceholderText('new@email.com'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    await screen.findByPlaceholderText('000000');
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + UI.RESEND_COOLDOWN_SEC * 1000);
    fireEvent.click(await screen.findByRole('button', { name: 'Resend code' }));
    await waitFor(() =>
      expect(api.requestEmailChange.mock.calls.map(([email]) => email)).toEqual([
        'new@example.com',
        'new@example.com',
      ]),
    );
  });
});
