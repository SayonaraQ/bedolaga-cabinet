// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InfoVisibility } from '../api/info';

/**
 * Подвал экрана входа ссылается на публичные документы. Документ, выключенный
 * в админке (режим «только бот»), бэк по публичной ручке отдаёт 404, и ссылка
 * вела на «Документ пока недоступен». Ожидание: выключенного документа в
 * подвале нет; если видимость не пришла — подвал прежний, со всеми ссылками.
 */

const { getVisibility } = vi.hoisted(() => ({
  getVisibility: vi.fn<() => Promise<InfoVisibility>>(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
  }),
}));

vi.mock('../api/info', () => ({ infoApi: { getVisibility } }));

import LegalFooter from './LegalFooter';

const ALL_VISIBLE: InfoVisibility = {
  faq: true,
  rules: true,
  privacy: true,
  offer: true,
  recurrent: true,
};

function renderFooter() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <LegalFooter />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  getVisibility.mockReset();
});

describe('LegalFooter', () => {
  it('не показывает документ, выключенный для веба', async () => {
    getVisibility.mockResolvedValue({ ...ALL_VISIBLE, recurrent: false });
    renderFooter();

    await waitFor(() => expect(screen.queryByText('Рекуррентные платежи')).toBeNull());
    expect(screen.getByText('Публичная оферта')).toBeTruthy();
    expect(screen.getByText('Политика конфиденциальности')).toBeTruthy();
  });

  it('показывает все документы, когда все включены', async () => {
    getVisibility.mockResolvedValue(ALL_VISIBLE);
    renderFooter();

    await waitFor(() => expect(getVisibility).toHaveBeenCalled());
    expect(screen.getByText('Рекуррентные платежи')).toBeTruthy();
    expect(screen.getAllByRole('link')).toHaveLength(3);
  });

  it('оставляет все ссылки, если видимость не загрузилась', async () => {
    getVisibility.mockRejectedValue(new Error('network'));
    renderFooter();

    await waitFor(() => expect(getVisibility).toHaveBeenCalled());
    expect(screen.getAllByRole('link')).toHaveLength(3);
  });
});
