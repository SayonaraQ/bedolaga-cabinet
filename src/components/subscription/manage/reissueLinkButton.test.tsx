// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * Форк-сторож. В 1.79 апстрим вынес перевыпуск из страницы подписки в
 * ReissueLinkButton и подтверждал его через useDestructiveConfirm — то есть
 * window.confirm в браузере, ровно то, от чего нас уводил RevokeSubscriptionSheet.
 * Кнопка теперь общая для полного и простого вида, поэтому барьер живёт в ней.
 *
 * Если очередной мерж вернёт апстримную кнопку, эти тесты упадут: нажатие
 * должно открывать панель с чекбоксом, а не звать системный диалог.
 */

import ruLocale from '@/locales/ru.json';

function resolveRu(key: string): string | undefined {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], ruLocale);
  return typeof value === 'string' ? value : undefined;
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      // Плюралы в ru.json лежат как key_one/_few/_many — для проверки хватает _many.
      const plural = options?.count !== undefined ? resolveRu(`${key}_many`) : undefined;
      const template = resolveRu(key) ?? plural ?? (options?.defaultValue as string) ?? key;
      return template.replace(/{{(\w+)}}/g, (_m, name) => String(options?.[name] ?? ''));
    },
    i18n: { language: 'ru', changeLanguage: () => Promise.resolve() },
  }),
}));

const revokeMock = vi.hoisted(() => ({ fn: vi.fn(() => Promise.resolve({})) }));
const nativeConfirmMock = vi.hoisted(() => ({ fn: vi.fn(() => Promise.resolve(true)) }));

vi.mock('@/api/subscription', () => ({
  subscriptionApi: { revokeSubscription: revokeMock.fn },
}));

vi.mock('@/platform', () => ({
  useHaptic: () => ({ notification: () => {}, impact: () => {}, selection: () => {} }),
}));

vi.mock('@/platform/hooks/useNativeDialog', () => ({
  useDestructiveConfirm: () => nativeConfirmMock.fn,
}));

vi.mock('@/utils/subscriptionHelpers', () => ({
  getErrorMessage: (e: unknown) => String(e),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ isDark: true }),
}));

import type { Subscription } from '@/types';
import { ReissueLinkButton } from './ReissueLinkButton';

const subscription = {
  is_active: true,
  is_limited: false,
  is_trial: false,
} as Subscription;

function renderButton(connectedDevices?: number) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ReissueLinkButton
        subscription={subscription}
        subscriptionId={42}
        connectedDevices={connectedDevices}
      />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  revokeMock.fn.mockClear();
  nativeConfirmMock.fn.mockClear();
  localStorage.clear();
});

describe('ReissueLinkButton (форк)', () => {
  it('нажатие открывает панель в странице, а не системный диалог', () => {
    renderButton(3);
    fireEvent.click(screen.getByRole('button', { name: /Перевыпустить/i }));

    expect(nativeConfirmMock.fn).not.toHaveBeenCalled();
    expect(revokeMock.fn).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox')).toBeTruthy();
  });

  it('без отметки чекбокса перевыпуск не запускается', () => {
    renderButton(3);
    fireEvent.click(screen.getByRole('button', { name: /Перевыпустить/i }));

    const confirm = screen.getByRole('button', {
      name: resolveRu('subscription.revoke.confirmBtn'),
    });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(confirm);
    expect(revokeMock.fn).not.toHaveBeenCalled();
  });

  it('после отметки перевыпуск уходит ровно один раз и заводит паузу', async () => {
    renderButton(3);
    fireEvent.click(screen.getByRole('button', { name: /Перевыпустить/i }));
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(
      screen.getByRole('button', { name: resolveRu('subscription.revoke.confirmBtn') }),
    );

    await waitFor(() => expect(revokeMock.fn).toHaveBeenCalledTimes(1));
    expect(revokeMock.fn).toHaveBeenCalledWith(42);
    expect(nativeConfirmMock.fn).not.toHaveBeenCalled();
    await waitFor(() => expect(localStorage.getItem('revoke_ts_42')).not.toBeNull());
  });

  it('число устройств попадает в текст последствий', () => {
    renderButton(3);
    fireEvent.click(screen.getByRole('button', { name: /Перевыпустить/i }));
    expect(screen.getByText(/Отключатся все 3/)).toBeTruthy();
    const anyDevices = resolveRu('subscription.revoke.consequenceDevicesAny') ?? '';
    expect(anyDevices).not.toBe('');
    expect(screen.queryByText(anyDevices)).toBeNull();
  });
});
