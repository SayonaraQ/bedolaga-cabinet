// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';

/**
 * Перевыпуск сбрасывает HWID всех устройств и обнуляет старую ссылку — отменить
 * его нельзя. До этой правки веб подтверждал его через window.confirm, куда
 * useDestructiveConfirm падает на не-Telegram платформах, и пользователи жали OK
 * рефлексом, не читая текст.
 *
 * Тесты держат ровно тот контракт, который это чинит: в вебе нажатие на кнопку
 * НЕ запускает перевыпуск, а открывает панель; панель не даёт подтвердить, пока
 * человек явно не отметит, что понимает последствия. Разметку не проверяем.
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
      // Настоящая ru.json, а не выдуманные строки: забытый перевод иначе
      // остаётся незамеченным — компонент рисует ключ, тест сверяется с ним же.
      const template = resolveRu(key) ?? (options?.defaultValue as string) ?? key;
      return template.replace(/{{(\w+)}}/g, (_m, name) => String(options?.[name] ?? ''));
    },
    i18n: { language: 'ru', changeLanguage: () => Promise.resolve() },
  }),
}));

const platformMock = vi.hoisted(() => ({ current: 'web' as 'web' | 'telegram' }));
const nativeConfirmMock = vi.hoisted(() => ({ fn: vi.fn(() => Promise.resolve(true)) }));

vi.mock('../../../platform', () => ({
  usePlatform: () => ({ platform: platformMock.current }),
}));

vi.mock('../../../platform/hooks/useNativeDialog', () => ({
  useDestructiveConfirm: () => nativeConfirmMock.fn,
}));

import { RevokeSubscriptionSheet } from './RevokeSubscriptionSheet';

interface Harness {
  onConfirm: Mock<() => void>;
  onOpen: Mock<() => void>;
  onClose: Mock<() => void>;
}

function renderSheet(open: boolean): Harness {
  const harness: Harness = {
    onConfirm: vi.fn<() => void>(),
    onOpen: vi.fn<() => void>(),
    onClose: vi.fn<() => void>(),
  };
  render(
    <RevokeSubscriptionSheet
      open={open}
      onOpen={harness.onOpen}
      onClose={harness.onClose}
      onConfirm={harness.onConfirm}
      isPending={false}
      cooldownSeconds={0}
      connectedDevices={7}
      textSecondary="rgba(255,255,255,0.4)"
    />,
  );
  return harness;
}

/** jest-dom в проекте не подключён — состояние кнопки читаем с самого элемента. */
function confirmButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: 'Перевыпустить' }) as HTMLButtonElement;
}

afterEach(() => {
  cleanup();
  platformMock.current = 'web';
  nativeConfirmMock.fn.mockClear();
  nativeConfirmMock.fn.mockResolvedValue(true);
});

describe('RevokeSubscriptionSheet', () => {
  it('в вебе нажатие на кнопку открывает панель, а не перевыпускает', () => {
    const harness = renderSheet(false);

    fireEvent.click(screen.getByRole('button', { name: /Перевыпустить подписку/ }));

    expect(harness.onOpen).toHaveBeenCalledTimes(1);
    expect(harness.onConfirm).not.toHaveBeenCalled();
    expect(nativeConfirmMock.fn).not.toHaveBeenCalled();
  });

  it('подтверждение заблокировано, пока последствия не подтверждены явно', () => {
    renderSheet(true);

    expect(confirmButton().disabled).toBe(true);
  });

  it('отметка чекбокса разблокирует подтверждение и запускает перевыпуск', () => {
    const harness = renderSheet(true);

    fireEvent.click(screen.getByRole('checkbox'));

    const confirm = confirmButton();
    expect(confirm.disabled).toBe(false);

    fireEvent.click(confirm);
    expect(harness.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('снятие чекбокса снова блокирует подтверждение', () => {
    renderSheet(true);
    const checkbox = screen.getByRole('checkbox');

    fireEvent.click(checkbox);
    fireEvent.click(checkbox);

    expect(confirmButton().disabled).toBe(true);
  });

  it('в Telegram остаётся нативный диалог, панель не открывается', async () => {
    platformMock.current = 'telegram';
    const harness = renderSheet(false);

    fireEvent.click(screen.getByRole('button', { name: /Перевыпустить подписку/ }));
    await vi.waitFor(() => expect(harness.onConfirm).toHaveBeenCalledTimes(1));

    expect(nativeConfirmMock.fn).toHaveBeenCalledTimes(1);
    expect(harness.onOpen).not.toHaveBeenCalled();
  });

  it('отказ в нативном диалоге ничего не перевыпускает', async () => {
    platformMock.current = 'telegram';
    nativeConfirmMock.fn.mockResolvedValue(false);
    const harness = renderSheet(false);

    fireEvent.click(screen.getByRole('button', { name: /Перевыпустить подписку/ }));
    await vi.waitFor(() => expect(nativeConfirmMock.fn).toHaveBeenCalledTimes(1));

    expect(harness.onConfirm).not.toHaveBeenCalled();
  });
});
