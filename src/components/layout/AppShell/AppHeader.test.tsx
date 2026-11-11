// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DEFAULT_ENABLED_THEMES } from '@/types/theme';
import { STORAGE_KEYS } from '@/config/constants';
import { safeLocal } from '@/utils/safeStorage';
import { AppHeader } from './AppHeader';

const backend = vi.hoisted(() => ({
  enabled: { dark: true, light: true, seasonal: false, seasonalDefault: true },
  impact: vi.fn(),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/hooks/useTelegramSDK', () => ({ getTelegramColorScheme: () => null }));
vi.mock('@/hooks/useUserAvatar', () => ({ useUserAvatar: () => ({ src: null }) }));
vi.mock('@/store/auth', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ user: null, logout: vi.fn(), isAdmin: false }),
}));
vi.mock('@/platform', () => ({
  usePlatform: () => ({ platform: 'web', haptic: { impact: backend.impact } }),
  useHaptic: () => ({ impact: backend.impact }),
}));
vi.mock('@/api/themeColors', () => ({
  themeColorsApi: { getEnabledThemes: () => Promise.resolve(backend.enabled) },
}));
vi.mock('@/api/branding', () => ({
  brandingApi: {
    getBranding: () => Promise.resolve({ name: 'Null Core' }),
    getLogoUrl: () => null,
  },
  getCachedBranding: () => ({ name: 'Null Core' }),
  setCachedBranding: () => {},
  preloadLogo: () => Promise.resolve(),
  isLogoPreloaded: () => false,
}));
vi.mock('@/components/LanguageSwitcher', () => ({ default: () => null }));
vi.mock('@/components/TicketNotificationBell', () => ({ default: () => null }));
vi.mock('./LogoutButton', () => ({ LogoutButton: () => null }));

let client: QueryClient;
beforeEach(() => {
  localStorage.clear();
  backend.enabled = { ...DEFAULT_ENABLED_THEMES };
  backend.impact.mockClear();
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});
afterEach(() => {
  cleanup();
  client.clear();
  vi.unstubAllGlobals();
});
function renderHeader() {
  safeLocal.setJson(STORAGE_KEYS.ENABLED_THEMES, backend.enabled);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AppHeader
          mobileMenuOpen={false}
          setMobileMenuOpen={vi.fn()}
          onCommandPaletteOpen={vi.fn()}
          headerHeight="64px"
          isFullscreen={false}
          safeAreaInset={{ top: 0, bottom: 0, left: 0, right: 0 }}
          contentSafeAreaInset={{ top: 0, bottom: 0, left: 0, right: 0 }}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

it('hides the palette button when seasonal is unavailable', async () => {
  renderHeader();
  await screen.findByTitle('theme.light');
  expect(screen.queryByRole('button', { name: 'theme.seasonal' })).toBeNull();
});
it('shows its pressed state, glint, season title and toggles with haptic feedback', async () => {
  backend.enabled.seasonal = true;
  renderHeader();
  const button = screen.getByRole('button', { name: 'theme.seasonal' });
  expect(button.getAttribute('aria-pressed')).toBe('true');
  expect(button.title).toMatch(/theme\.seasons\.(winter|spring|summer|autumn)/);
  expect(button.querySelector('span')?.style.backgroundColor).toBe('var(--nc-glint)');
  fireEvent.click(button);
  await waitFor(() => expect(button.getAttribute('aria-pressed')).toBe('false'));
  expect(button.querySelector('span')).toBeNull();
  expect(safeLocal.getItem(STORAGE_KEYS.SEASONAL)).toBe('off');
  expect(backend.impact).toHaveBeenCalledWith('light');
  // С палитрой, темой, колокольчиком и флагом имя до 385 px упиралось в палитру.
  expect(screen.getByText('Null Core').className).toContain('min-[385px]:inline');
});
