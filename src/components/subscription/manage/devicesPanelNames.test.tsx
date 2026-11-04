// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { DevicesPanel } from './DevicesPanel';
import type { Subscription } from '@/types';

// В «Мои устройства» — то же название, что в слотах на главной: «POCO F8 Ultra»,
// а не код «25102PCBEG», по которому человек свой телефон не узнаёт.

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));
vi.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ isDark: true }) }));
vi.mock('@/platform', () => ({ useHaptic: () => ({ notification: () => {} }) }));
vi.mock('@/platform/hooks/useNativeDialog', () => ({
  useDestructiveConfirm: () => async () => true,
}));
vi.mock('@/api/subscription', () => ({
  subscriptionApi: {
    getDevices: async () => ({
      total: 2,
      device_limit: 3,
      devices: [
        {
          hwid: 'a',
          platform: 'Android',
          device_model: '25102PCBEG',
          device_name: 'POCO F8 Ultra',
        },
        { hwid: 'b', platform: 'Android', device_model: 'Pixel 8', device_name: null },
      ],
    }),
  },
}));
afterEach(cleanup);

it('names devices by marketing name and falls back to the model', async () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <DevicesPanel subscription={{ id: 7 } as Subscription} subscriptionId={7} />
    </QueryClientProvider>,
  );

  expect(await screen.findByText('POCO F8 Ultra')).toBeTruthy();
  expect(screen.queryByText('25102PCBEG')).toBeNull();
  expect(screen.getByText('Pixel 8')).toBeTruthy();
});
