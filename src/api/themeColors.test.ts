import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ENABLED_THEMES } from '@/types/theme';
import { themeColorsApi } from './themeColors';

const client = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn() }));
vi.mock('./client', () => ({ default: client }));
beforeEach(() => vi.clearAllMocks());

describe('enabled themes compatibility', () => {
  it('normalizes old GET responses to seasonal unavailable', async () => {
    client.get.mockResolvedValue({ data: { dark: false, light: true } });
    expect(await themeColorsApi.getEnabledThemes()).toEqual({
      ...DEFAULT_ENABLED_THEMES,
      dark: false,
    });
  });
  it('normalizes old PATCH responses and sends only the requested flag', async () => {
    client.patch.mockResolvedValue({ data: { dark: true, light: true } });
    expect(await themeColorsApi.updateEnabledThemes({ seasonal: true })).toEqual(
      DEFAULT_ENABLED_THEMES,
    );
    expect(client.patch).toHaveBeenCalledWith('/cabinet/branding/themes', { seasonal: true });
  });
  it('retains new flags and defaults missing or malformed fields', async () => {
    client.get.mockResolvedValue({
      data: { dark: true, light: false, seasonal: true, seasonalDefault: false },
    });
    expect(await themeColorsApi.getEnabledThemes()).toEqual({
      dark: true,
      light: false,
      seasonal: true,
      seasonalDefault: false,
    });
    client.get.mockResolvedValue({ data: { seasonal: 'true', seasonalDefault: null } });
    expect(await themeColorsApi.getEnabledThemes()).toEqual(DEFAULT_ENABLED_THEMES);
  });
});
