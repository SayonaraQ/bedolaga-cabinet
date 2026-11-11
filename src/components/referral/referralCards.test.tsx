// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReferralEarning } from '@/api/referral';
import ru from '@/locales/ru.json';
import type { ReferralInfo, ReferralTerms } from '@/types';
import { ReferralActivityCard, type ReferralListItem } from './ReferralActivityCard';
import { ReferralInviteCard } from './ReferralInviteCard';

/**
 * «Рефералы», вариант B (11.11.2026): заработок, условия, ссылка и «Поделиться»
 * в одной карточке, как на «Балансе»; приглашённые и начисления — вкладки.
 */

vi.mock('@/hooks/useCurrency', () => ({
  useCurrency: () => ({
    currencySymbol: '₽',
    convertAmount: (rub: number) => rub,
    formatAmount: (amount: number, decimals = 2) =>
      new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(amount),
    formatWithCurrency: (amount: number, decimals = 2) =>
      `${new Intl.NumberFormat('ru-RU', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(amount)} ₽`,
  }),
}));

vi.mock('@/platform', () => ({
  usePlatform: () => ({
    platform: 'web',
    openLink: vi.fn(),
    openTelegramLink: vi.fn(),
    haptic: { impact: vi.fn() },
  }),
}));
vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ isDark: true, isLight: false, season: null, seasonalActive: false }),
}));

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

const i18n = createInstance();
await i18n.init({ lng: 'ru', resources: { ru: { translation: ru } }, initAsync: false });

afterEach(cleanup);

/** Текст без различия обычных и неразрывных пробелов. */
const flat = (text: string | null) => (text ?? '').replace(/\s+/g, ' ');

const info = (over: Partial<ReferralInfo> = {}): ReferralInfo => ({
  referral_code: 'AbC123',
  referral_link: 'https://lk.example/?ref=AbC123',
  bot_referral_link: 'https://t.me/demo_bot?start=ref_AbC123',
  total_referrals: 7,
  active_referrals: 4,
  total_earnings_kopeks: 56090,
  total_earnings_rubles: 560.9,
  commission_percent: 5,
  available_balance_kopeks: 0,
  available_balance_rubles: 0,
  withdrawn_kopeks: 0,
  ...over,
});

// Настройки прода на 11.11.2026.
const terms = (over: Partial<ReferralTerms> = {}): ReferralTerms => ({
  is_enabled: true,
  commission_percent: 5,
  minimum_topup_kopeks: 20000,
  minimum_topup_rubles: 200,
  first_topup_bonus_kopeks: 10000,
  first_topup_bonus_rubles: 100,
  inviter_bonus_kopeks: 10000,
  inviter_bonus_rubles: 100,
  max_commission_payments: 0,
  scheme: 'legacy',
  ...over,
});

function renderInvite(props: Partial<Parameters<typeof ReferralInviteCard>[0]> = {}): {
  onCopy: ReturnType<typeof vi.fn>;
  onShare: ReturnType<typeof vi.fn>;
} {
  const onCopy = vi.fn();
  const onShare = vi.fn();
  render(
    <I18nextProvider i18n={i18n}>
      <ReferralInviteCard
        info={info()}
        terms={terms()}
        botLink={info().bot_referral_link ?? ''}
        cabinetLink={info().referral_link}
        copiedLink={null}
        onCopy={onCopy}
        onShare={onShare}
        {...props}
      />
    </I18nextProvider>,
  );
  return { onCopy, onShare };
}

describe('карточка приглашения', () => {
  it('заработок крупной суммой и счёт приглашённых', () => {
    renderInvite();

    expect(screen.getByText('Заработано на приглашениях')).toBeTruthy();
    expect(screen.getByText(/560,90/)).toBeTruthy();
    expect(screen.getByText('Приглашено 7 · оплатили 4')).toBeTruthy();
  });

  it('условия классической схемы — две строки, целые суммы без копеек', () => {
    renderInvite();

    const perks = flat(screen.getByTestId('referral-perks').textContent);
    expect(perks).toContain('Другу +100 ₽');
    expect(perks).toContain('к первому пополнению от 200 ₽');
    expect(perks).toContain('Вам +100 ₽ и 5%');
    expect(perks).toContain('за его первую оплату и с каждого пополнения');
    expect(perks).not.toMatch(/,00/);
  });

  it('процент — личный из info: у партнёра он выше общего', () => {
    renderInvite({ info: info({ commission_percent: 15 }) });

    expect(flat(screen.getByTestId('referral-perks').textContent)).toContain('Вам +100 ₽ и 15%');
  });

  it('без бонусов остаётся только процент', () => {
    renderInvite({
      terms: terms({ first_topup_bonus_kopeks: 0, inviter_bonus_kopeks: 0 }),
    });

    expect(screen.getByText('Вам 5%')).toBeTruthy();
    expect(screen.queryByText(/Другу/)).toBeNull();
  });

  it('под схемой уровней процент не обещается — только отсылка к уровням', () => {
    renderInvite({
      terms: terms({ scheme: 'levels', referee_bonus_description: '50 ₽ на баланс' }),
    });

    expect(screen.queryByText(/Вам/)).toBeNull();
    expect(screen.getByText('50 ₽ на баланс')).toBeTruthy();
    expect(screen.getByText(ru.referral.shareHintLevels)).toBeTruthy();
  });

  it('по умолчанию ссылка на бота; переключатель показывает кабинетную', () => {
    const { onCopy, onShare } = renderInvite();

    expect(screen.getByTestId('referral-link').textContent).toBe(
      'https://t.me/demo_bot?start=ref_AbC123',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Кабинет' }));
    expect(screen.getByTestId('referral-link').textContent).toBe('https://lk.example/?ref=AbC123');

    fireEvent.click(screen.getByRole('button', { name: ru.referral.copyLink }));
    expect(onCopy).toHaveBeenCalledWith('https://lk.example/?ref=AbC123', 'cabinet');
    // «Поделиться» отправляет ту ссылку, что выбрана.
    fireEvent.click(screen.getByRole('button', { name: 'Поделиться ссылкой' }));
    expect(onShare).toHaveBeenCalledWith('https://lk.example/?ref=AbC123');
  });

  it('без ссылки на бота переключателя нет', () => {
    renderInvite({ botLink: '' });

    expect(screen.queryByRole('button', { name: 'Telegram-бот' })).toBeNull();
    expect(screen.getByTestId('referral-link').textContent).toBe('https://lk.example/?ref=AbC123');
  });
});

const referrals: ReferralListItem[] = Array.from({ length: 7 }, (_, i) => ({
  id: 100 + i,
  username: null,
  first_name: `Друг ${i + 1}`,
  created_at: '2026-11-0' + ((i % 9) + 1) + 'T12:00:00Z',
  has_paid: i % 2 === 0,
}));

const earning = (over: Partial<ReferralEarning>): ReferralEarning => ({
  id: 1,
  amount_kopeks: 1740,
  amount_rubles: 17.4,
  reason: 'referral_commission_topup',
  referral_username: null,
  referral_first_name: 'Алиса',
  campaign_name: null,
  created_at: '2026-11-08T12:00:00Z',
  ...over,
});

function renderActivity(items: ReferralListItem[], earnings: ReferralEarning[]) {
  render(
    <I18nextProvider i18n={i18n}>
      <ReferralActivityCard
        referrals={items}
        earnings={earnings}
        formatEarning={(e) => `+${e.amount_rubles}`}
      />
    </I18nextProvider>,
  );
}

describe('карточка «Приглашённые / Начисления»', () => {
  it('показывает пять приглашённых и раскрывает остальных', () => {
    renderActivity(referrals, [earning({})]);

    expect(screen.getAllByTestId('referral-row')).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'Показать всех' }));
    expect(screen.getAllByTestId('referral-row')).toHaveLength(7);
    fireEvent.click(screen.getByRole('button', { name: 'Свернуть' }));
    expect(screen.getAllByTestId('referral-row')).toHaveLength(5);
  });

  it('отмечает оплативших и тех, кого ждём', () => {
    renderActivity(referrals.slice(0, 2), []);

    expect(screen.getByText(ru.referral.status.paid)).toBeTruthy();
    expect(screen.getByText('Ждём оплату')).toBeTruthy();
  });

  it('без начислений вкладок нет — только заголовок', () => {
    renderActivity(referrals, []);

    expect(screen.queryByRole('button', { name: 'Начисления' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Приглашённые' })).toBeTruthy();
  });

  it('вкладка начислений показывает строки и уровень цепочки', () => {
    renderActivity(referrals, [earning({ id: 1 }), earning({ id: 2, level: 2 })]);

    fireEvent.click(screen.getByRole('button', { name: 'Начисления' }));
    expect(screen.getAllByTestId('earning-row')).toHaveLength(2);
    expect(screen.getByText(/уровень 2|2 уровень|ур\. 2/i)).toBeTruthy();
  });

  it('пустой список говорит, что приглашённых пока нет', () => {
    renderActivity([], []);

    expect(screen.getByText(ru.referral.noReferrals)).toBeTruthy();
  });
});
