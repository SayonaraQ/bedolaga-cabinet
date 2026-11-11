import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/data-display/Card';
import { Button } from '@/components/primitives/Button';
import { CheckIcon, CopyIcon, GiftIcon, PercentIcon, ShareIcon } from '@/components/icons';
import { useCurrency } from '@/hooks/useCurrency';
import { useTheme } from '@/hooks/useTheme';
import { getGlassColors } from '@/utils/glassTheme';
import type { ReferralInfo, ReferralTerms } from '@/types';

export type ReferralLinkKind = 'bot' | 'cabinet';

interface InvitePerk {
  key: string;
  icon: ReactNode;
  title: string;
  hint: string;
}

/**
 * Главная карточка «Рефералов» (вариант B, 11.11.2026): заработок, условия
 * двумя строками, ссылка и «Поделиться» — как «На балансе» с пополнением на
 * странице «Баланс». Списки и прочее идут ниже отдельными карточками.
 */
export function ReferralInviteCard({
  info,
  terms,
  botLink,
  cabinetLink,
  copiedLink,
  onCopy,
  onShare,
}: {
  info: ReferralInfo;
  terms: ReferralTerms | undefined;
  botLink: string;
  cabinetLink: string;
  copiedLink: ReferralLinkKind | null;
  onCopy: (link: string, kind: ReferralLinkKind) => void;
  onShare: (link: string) => void;
}) {
  const { t } = useTranslation();
  const { formatAmount, formatWithCurrency, convertAmount, currencySymbol } = useCurrency();
  const { isDark } = useTheme();
  const g = getGlassColors(isDark);
  // Ссылка на бота — основная: клиенты приходят из Telegram. Кабинетная — запасная.
  const [kind, setKind] = useState<ReferralLinkKind>(botLink ? 'bot' : 'cabinet');
  const link = kind === 'bot' && botLink ? botLink : cabinetLink;
  const linkKind: ReferralLinkKind = kind === 'bot' && botLink ? 'bot' : 'cabinet';

  // Целые суммы условий — без «,00»: «+100 ₽», как быстрые суммы на «Балансе».
  const money = (rub: number) =>
    formatWithCurrency(rub, Number.isInteger(convertAmount(rub)) ? 0 : 2);

  const isLevels = terms?.scheme === 'levels';
  const isTiers = isLevels && terms?.levels_mode === 'tiers';
  const perks: InvitePerk[] = [];
  if (terms && !isLevels) {
    // Классическая схема: плоские поля и есть то, что платит бот.
    if (terms.first_topup_bonus_kopeks > 0) {
      perks.push({
        key: 'friend',
        icon: <GiftIcon className="h-[18px] w-[18px]" />,
        title: t('referral.invite.friend', { amount: money(terms.first_topup_bonus_rubles) }),
        hint:
          terms.minimum_topup_kopeks > 0
            ? t('referral.invite.friendHintMin', { min: money(terms.minimum_topup_rubles) })
            : t('referral.invite.friendHint'),
      });
    }
    // Процент — личный (у партнёра он выше общего), как в тексте «Поделиться».
    const rate = info.commission_percent ?? terms.commission_percent;
    const bonus = terms.inviter_bonus_kopeks > 0;
    const percent = rate > 0;
    if (bonus || percent) {
      const variant = bonus && percent ? 'youBoth' : bonus ? 'youBonus' : 'youPercent';
      perks.push({
        key: 'you',
        icon: <PercentIcon className="h-[18px] w-[18px]" />,
        title: t(`referral.invite.${variant}`, {
          amount: money(terms.inviter_bonus_rubles),
          percent: rate,
        }),
        hint: t(`referral.invite.${variant}Hint`),
      });
    }
  } else if (terms?.referee_bonus_description) {
    // Под уровнями процент задаёт таблица уровней (она ниже), а бонус другу
    // сервер присылает готовой строкой.
    perks.push({
      key: 'friend',
      icon: <GiftIcon className="h-[18px] w-[18px]" />,
      title: terms.referee_bonus_description,
      hint: t('referral.invite.friendHint'),
    });
  }

  const earnedDays = info.total_earnings_days ?? 0;

  return (
    <Card>
      <div className="mb-2 text-sm text-dark-400">{t('referral.hero.earned')}</div>
      <div className="text-4xl font-bold text-dark-50 sm:text-5xl">
        {formatAmount(info.total_earnings_rubles || 0)}
        <span className="ml-2 text-2xl text-dark-400">{currencySymbol}</span>
      </div>
      {earnedDays > 0 && (
        <div className="mt-1 text-sm font-semibold text-success-400">
          +{t('referral.stats.earnedDays', { count: earnedDays })}
        </div>
      )}
      <div className="mt-2 text-sm text-dark-400">
        {t('referral.hero.summary', {
          total: info.total_referrals || 0,
          paid: info.active_referrals || 0,
        })}
        {isTiers &&
          ` · ${t('referral.stats.yourLevel')}: ${
            terms?.tier_current_level == null
              ? t('referral.stats.levelNotReached')
              : terms.tier_current_level
          }`}
      </div>

      <div className="mt-6 space-y-4 border-t border-dark-700/50 pt-5">
        <h2 className="font-semibold text-dark-100">{t('referral.invite.title')}</h2>

        {perks.length > 0 && (
          <div
            data-testid="referral-perks"
            className="space-y-3 rounded-[14px] p-3.5"
            style={{ background: g.innerBg, border: `1px solid ${g.innerBorder}` }}
          >
            {perks.map((perk) => (
              <div key={perk.key} className="flex items-start gap-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-success-400"
                  style={{ background: 'rgba(var(--color-success-400), 0.1)' }}
                  aria-hidden="true"
                >
                  {perk.icon}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-dark-100">{perk.title}</div>
                  <div className="mt-0.5 text-xs text-dark-400">{perk.hint}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {isLevels && <p className="text-xs text-dark-400">{t('referral.shareHintLevels')}</p>}

        {botLink && (
          <div className="grid grid-cols-2 gap-2 sm:flex" role="group">
            {(['bot', 'cabinet'] as const).map((key) => (
              <Button
                key={key}
                size="sm"
                variant="secondary"
                aria-pressed={linkKind === key}
                className={`whitespace-nowrap ${linkKind === key ? 'border-accent-500 bg-accent-500/10 text-accent-400' : ''}`}
                onClick={() => setKind(key)}
              >
                {t(key === 'bot' ? 'referral.invite.linkBot' : 'referral.invite.linkCabinet')}
              </Button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <code
            data-testid="referral-link"
            className="block min-w-0 flex-1 truncate whitespace-nowrap rounded-[10px] px-3 py-2.5 font-mono text-[12px] text-dark-300"
            style={{ background: g.codeBg, border: `1px solid ${g.codeBorder}` }}
            title={link}
          >
            {link}
          </code>
          <button
            type="button"
            onClick={() => onCopy(link, linkKind)}
            disabled={!link}
            className="subscription-action-neutral flex shrink-0 items-center rounded-[10px] px-3 transition-colors disabled:opacity-50"
            aria-label={t('referral.copyLink')}
            title={t('referral.copyLink')}
          >
            {copiedLink === linkKind ? <CheckIcon /> : <CopyIcon />}
          </button>
        </div>

        <button
          type="button"
          onClick={() => onShare(link)}
          disabled={!link}
          className="cta-shine flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-accent-500 px-4 text-base font-bold text-on-accent transition-colors hover:bg-accent-600 disabled:opacity-50"
        >
          <ShareIcon className="h-[18px] w-[18px]" />
          {t('referral.invite.share')}
        </button>
      </div>
    </Card>
  );
}
