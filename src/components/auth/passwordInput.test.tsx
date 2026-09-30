// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ruLocale from '@/locales/ru.json';
import { PasswordInput } from './PasswordInput';

/**
 * Поле пароля с «глазиком».
 *
 * Пользователи перебирали пароли вслепую, не видя, что набирают. Тесты держат
 * три вещи: по умолчанию пароль скрыт, кнопка его открывает и снова прячет,
 * а сама кнопка не отправляет форму (она внутри <form>, и type="submit" по
 * умолчанию превратил бы «показать пароль» в «привязать почту»).
 */

function ru(key: string): string {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], ruLocale);
  if (typeof value !== 'string') throw new Error(`нет строки ${key}`);
  return value;
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => ru(key) }),
}));

afterEach(cleanup);

describe('PasswordInput', () => {
  it('по умолчанию скрывает пароль', () => {
    render(<PasswordInput aria-label="pw" defaultValue="secret" />);
    expect(screen.getByLabelText('pw')).toHaveProperty('type', 'password');
    expect(screen.getByRole('button', { name: 'Показать пароль' })).toBeTruthy();
  });

  it('кнопка показывает и снова прячет пароль', () => {
    render(<PasswordInput aria-label="pw" defaultValue="secret" />);
    const input = screen.getByLabelText('pw');

    fireEvent.click(screen.getByRole('button', { name: 'Показать пароль' }));
    expect(input).toHaveProperty('type', 'text');
    expect(screen.getByRole('button', { name: 'Скрыть пароль' }).getAttribute('aria-pressed')).toBe(
      'true',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Скрыть пароль' }));
    expect(input).toHaveProperty('type', 'password');
  });

  it('кнопка не отправляет форму', () => {
    const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <PasswordInput aria-label="pw" />
      </form>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Показать пароль' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
