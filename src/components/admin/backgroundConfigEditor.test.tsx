// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ruLocale from '@/locales/ru.json';
import { DEFAULT_ANIMATION_CONFIG, type AnimationConfig } from '@/components/ui/backgrounds/types';
import { BackgroundConfigEditor } from './BackgroundConfigEditor';

/** Строка из ru.json, обязанная существовать: забытый перевод валит тест. */
function ru(key: string): string {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], ruLocale);
  if (typeof value !== 'string') throw new Error(`ru.json: нет строки ${key}`);
  return value;
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => ru(key) }),
}));
const theme = vi.hoisted(() => ({ isLight: false }));
vi.mock('@/hooks/useTheme', () => ({ useTheme: () => theme }));
// Предпросмотр грузит сцены лениво; здесь важны только вкладки и onChange.
vi.mock('@/components/backgrounds/BackgroundPreview', () => ({
  BackgroundPreview: ({ type, theme: t }: { type: string; theme?: string }) => (
    <div data-testid="preview" data-type={type} data-theme={t ?? ''} />
  ),
}));

const stardust: AnimationConfig = { ...DEFAULT_ANIMATION_CONFIG, type: 'stardust', settings: {} };

beforeEach(() => {
  theme.isLight = false;
});
afterEach(cleanup);

function setup(config: AnimationConfig = stardust, withLightTheme = true) {
  const onChange = vi.fn();
  const view = render(
    <BackgroundConfigEditor value={config} onChange={onChange} withLightTheme={withLightTheme} />,
  );
  return { onChange, ...view };
}

describe('BackgroundConfigEditor light theme tab', () => {
  it('has no theme tabs for landing backgrounds', () => {
    setup(stardust, false);
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('opens on the admin theme and previews the dark tab in the dark theme', () => {
    setup();
    expect(screen.getByRole('tab', { name: ru('admin.backgrounds.darkTheme') })).toHaveProperty(
      'ariaSelected',
      'true',
    );
    expect(screen.getByTestId('preview').dataset.theme).toBe('dark');
  });

  it('shows "same as dark" switched on and a light preview of the main scene', () => {
    setup();
    fireEvent.click(screen.getByRole('tab', { name: ru('admin.backgrounds.lightTheme') }));
    expect(screen.getByText(ru('admin.backgrounds.sameAsDark'))).toBeTruthy();
    const preview = screen.getByTestId('preview');
    expect(preview.dataset.type).toBe('stardust');
    expect(preview.dataset.theme).toBe('light');
    expect(screen.queryByText(ru('admin.backgrounds.halo'))).toBeNull();
  });

  it('turning inheritance off starts the light background from the current one', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole('tab', { name: ru('admin.backgrounds.lightTheme') }));
    const toggle = screen
      .getByText(ru('admin.backgrounds.sameAsDark'))
      .closest('div')
      ?.parentElement?.querySelector('button');
    if (!toggle) throw new Error('toggle not found');
    fireEvent.click(toggle);
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'stardust',
        light: expect.objectContaining({ inherit: false, type: 'stardust' }),
      }),
    );
  });

  it('picking a type on the light tab changes only the light background', () => {
    const custom: AnimationConfig = {
      ...stardust,
      light: { inherit: false, type: 'stardust', settings: {}, opacity: 1, blur: 0 },
    };
    const { onChange } = setup(custom);
    fireEvent.click(screen.getByRole('tab', { name: ru('admin.backgrounds.lightTheme') }));
    fireEvent.click(screen.getByText(ru('admin.backgrounds.halo')));
    const next = onChange.mock.lastCall?.[0] as AnimationConfig;
    expect(next.type).toBe('stardust');
    expect(next.light).toMatchObject({ inherit: false, type: 'halo' });
  });
});
