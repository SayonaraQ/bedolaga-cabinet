// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ConnectDeviceButton } from './ConnectDeviceButton';

const animation = vi.hoisted(() => ({ paused: false }));
vi.mock('@/hooks/useAnimationLoop', () => ({ useAnimationPause: () => animation.paused }));

beforeEach(() => {
  animation.paused = false;
});
afterEach(cleanup);

it.each([
  { disabled: false, loading: false, inactive: false, paused: 'false' },
  { disabled: true, loading: false, inactive: false, paused: 'true' },
  { disabled: false, loading: true, inactive: false, paused: 'true' },
  { disabled: false, loading: false, inactive: true, paused: 'true' },
])('pauses the contour for %j and preserves click availability', (state) => {
  animation.paused = state.inactive;
  const onClick = vi.fn();
  render(
    <ConnectDeviceButton disabled={state.disabled} loading={state.loading} onClick={onClick}>
      Подключить устройство
    </ConnectDeviceButton>,
  );
  const button = screen.getByRole('button', { name: 'Подключить устройство' });
  expect(button.className).toContain('connect-device-contour');
  expect(button.getAttribute('data-paused')).toBe(state.paused);
  expect(button.hasAttribute('disabled')).toBe(state.disabled);
  expect(button.getAttribute('aria-busy')).toBe(state.loading ? 'true' : null);
  fireEvent.click(button);
  expect(onClick).toHaveBeenCalledTimes(state.disabled ? 0 : 1);
});

it('resumes the same button when the page becomes active', () => {
  animation.paused = true;
  const { rerender } = render(<ConnectDeviceButton>Connect</ConnectDeviceButton>);
  const button = screen.getByRole('button', { name: 'Connect' });
  expect(button.getAttribute('data-paused')).toBe('true');
  animation.paused = false;
  rerender(<ConnectDeviceButton>Connect</ConnectDeviceButton>);
  expect(button.getAttribute('data-paused')).toBe('false');
});
